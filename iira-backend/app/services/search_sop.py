from qdrant_client import QdrantClient, models
from sentence_transformers import SentenceTransformer
from app.config import settings
from app.services.llm_client import MODEL_SOP_GENERATOR, call_ollama
from app.services.settings_service import load_search_thresholds
import logging
import asyncio # Import asyncio
from app.utils.redis_client import get_redis_key_for_incident, get_feedback_summary # Import Redis utils
from typing import List, Dict, Optional # Import List, Dict, Optional

logger = logging.getLogger(__name__)

# --- Load thresholds dynamically ---
SEARCH_THRESHOLDS = load_search_thresholds()
MODEL_PATH = "/app/ml_models/all-MiniLM-L6-v2"
COLLECTION_NAME = "sop_documents"
# Fetch more results initially for re-ranking pool
INITIAL_FETCH_K = 10 # Fetch top 10 for re-ranking

# --- Initialize Clients ---
try:
    qdrant_client = QdrantClient(
        host=settings.qdrant_host,
        port=settings.qdrant_port,
        # api_key=settings.qdrant_api_key, # Uncomment if using API key
        timeout=20 # Added timeout
    )
    logger.info(f"Qdrant client initialized for host: {settings.qdrant_host}")
except Exception as e:
    logger.error(f"Failed to initialize Qdrant client: {e}", exc_info=True)
    # Consider raising exception or setting a flag to prevent searches

try:
    embedder = SentenceTransformer(MODEL_PATH)
    logger.info(f"SentenceTransformer model loaded from: {MODEL_PATH}")
except Exception as e:
    logger.error(f"Failed to load SentenceTransformer model: {e}", exc_info=True)
    # Consider raising exception or setting a flag

# --- Hypothetical Document Generation ---
def generate_hypothetical_sop_for_hyde(query_text: str, model: str = MODEL_SOP_GENERATOR) -> str:
    """Uses LLM for HyDE: generates a hypothetical SOP summary from an incident query."""
    prompt = f"""
    You are an expert Site Reliability Engineer. Based on the following incident description, write a concise, one-paragraph summary of an ideal Standard Operating Procedure (SOP) that would help resolve this issue. Focus ONLY on the core problem and key steps. Do not add introductory or concluding sentences.

    Incident Description: "{query_text}"

    Hypothetical SOP Summary:
    """
    logger.info("📝 Generating hypothetical document for HyDE query: \"%s\"", query_text[:100] + "...")
    hypothetical_doc = call_ollama(prompt, model=model).strip() # Use call_ollama
    hypothetical_doc = hypothetical_doc.strip('"') # Basic cleaning
    logger.info("✅ Generated HyDE Document:\n---\n%s\n---", hypothetical_doc)
    return hypothetical_doc

# --- NEW: Re-ranking Logic ---
async def rerank_with_feedback(short_desc: str, description: Optional[str], initial_results: List[models.ScoredPoint]) -> List[models.ScoredPoint]:
    """Applies boost/penalty based on Redis feedback summary."""
    if not initial_results:
        return []

    redis_key = get_redis_key_for_incident(short_desc, description)
    feedback_summary = await get_feedback_summary(redis_key)

    if not feedback_summary:
        logger.debug(f"No feedback summary in Redis for key '{redis_key}', returning original ranking.")
        return initial_results # No feedback, no change

    logger.info(f"Applying feedback from Redis for key '{redis_key}': {feedback_summary}")

    # Define Boost/Penalty Values (tune these)
    CONFIRMED_BOOST = 0.2
    PENALTY = -0.15 # Slightly stronger penalty
    MIN_CONFIRM_THRESHOLD = 1 # Min difference between correct/incorrect counts to apply boost/penalty confidently

    adjusted_results = []
    for result in initial_results:
        agent_id = str(result.id) # Ensure ID is string for matching keys
        current_score = result.score
        adjusted_score = current_score

        # Check counts from Redis hash
        # Specific counts for this agent being marked correct
        correct_key = f"correct_agent:{agent_id}"
        correct_count = feedback_summary.get(correct_key, 0)

        # Specific counts for this agent being recommended BUT marked incorrect by user picking *another* agent
        incorrect_key = f"incorrect_recommendation:{agent_id}"
        specific_incorrect_count = feedback_summary.get(incorrect_key, 0)

        # Apply Boost: Significant positive feedback for this specific agent
        if correct_count > specific_incorrect_count + MIN_CONFIRM_THRESHOLD:
            adjusted_score += CONFIRMED_BOOST
            logger.info(f"Boosting agent {agent_id} (Correct: {correct_count} vs Incorrect Rec: {specific_incorrect_count}). New score: {adjusted_score:.4f}")

        # Apply Penalty: Significant negative feedback for this specific agent recommendation
        elif specific_incorrect_count > correct_count + MIN_CONFIRM_THRESHOLD:
             adjusted_score += PENALTY
             logger.info(f"Penalizing agent {agent_id} (Incorrect Rec: {specific_incorrect_count} vs Correct: {correct_count}). New score: {adjusted_score:.4f}")

        # Clip scores to valid range (e.g., 0 to 1 if using cosine similarity)
        adjusted_score = max(0.0, min(1.0, adjusted_score))

        # Create a new ScoredPoint with the adjusted score
        adjusted_point = models.ScoredPoint(
            id=result.id, version=result.version, score=round(adjusted_score, 4),
            payload=result.payload, vector=result.vector, shard_key=result.shard_key
        )
        adjusted_results.append(adjusted_point)

    # Re-sort by the new adjusted score (descending)
    adjusted_results.sort(key=lambda x: x.score, reverse=True)
    logger.info("Re-ranking complete based on feedback.")

    return adjusted_results
# --- END Re-ranking Logic ---

# --- UPDATED SEARCH FUNCTION (Now Async) ---
async def search_sop_by_query(
    query: str,                     # Corresponds to short_description
    description: Optional[str],     # Corresponds to full description
    top_k: int = 3,                 # Final number of results to return
    apply_threshold: bool = True    # Filter final results by score threshold?
) -> List[Dict]:
    """
    Performs a hybrid two-stage search for relevant Agents (SOPs),
    incorporating feedback-based re-ranking via Redis.

    Args:
        query (str): The incident short description query.
        description (Optional[str]): The full incident description.
        top_k (int): The maximum number of final results to return.
        apply_threshold (bool): If True, filters final re-ranked results based on configured score thresholds.
                                If False, returns the top_k re-ranked results regardless of score (for Agent Trainer).
    Returns:
        List[Dict]: A list of matching Agent documents with their final scores.
    """
    logger.info(f"--- Starting Hybrid Search --- Query: '{query[:50]}...', Desc Exists: {bool(description)}, Apply Threshold: {apply_threshold}")

    # Check if clients are initialized (add error handling if they failed)
    if 'embedder' not in globals() or 'qdrant_client' not in globals():
        logger.error("Embedder or Qdrant client not initialized. Cannot perform search.")
        return []

    current_thresholds = load_search_thresholds()
    initial_threshold = current_thresholds.get('INITIAL_SEARCH_THRESHOLD', 0.55)
    hyde_threshold = current_thresholds.get('HYDE_SEARCH_THRESHOLD', 0.50)
    logger.info(f"Thresholds - Initial: {initial_threshold}, HyDE: {hyde_threshold}")

    # Combine query and description for embedding
    search_query_text = f"{query or ''} {description or ''}".strip()
    if not search_query_text:
        logger.warning("Empty search query provided.")
        return []

    final_results: List[Dict] = []
    stage_used = "Unknown"

    # --- Stage 1: Fast, Direct Vector Search ---
    try:
        logger.info("🚀 Stage 1: Performing direct vector search...")
        direct_query_vector = embedder.encode(search_query_text).tolist()
        direct_search_results_raw = qdrant_client.search(
            collection_name=COLLECTION_NAME,
            query_vector=direct_query_vector,
            limit=INITIAL_FETCH_K # Fetch more initially
        )
        logger.info(f"Stage 1 Qdrant Raw Results Count: {len(direct_search_results_raw)}")

        # --- Apply Re-ranking ---
        direct_search_results_reranked = await rerank_with_feedback(query, description, direct_search_results_raw)

        stage_1_processed = []
        logger.info("--- Direct Search Re-ranked & Filtered Results ---")
        for result in direct_search_results_reranked:
            payload = result.payload or {}
            score = result.score # Already rounded in rerank function
            logger.info(f"Score: {score} | Title: {payload.get('title', 'N/A')}")
            # --- CONDITIONAL THRESHOLD CHECK ---
            if not apply_threshold or score >= initial_threshold:
                stage_1_processed.append({
                    "id": result.id, "title": payload.get("title", ""), "issue": payload.get("issue", ""),
                    "steps": payload.get("steps", []), "tags": payload.get("tags", []), "score": score
                })
            else:
                 logger.info(f"  -> Below initial threshold ({initial_threshold}), skipped (apply_threshold={apply_threshold}).")

        # Check if Stage 1 is sufficient
        found_high_confidence_stage1 = any(r['score'] >= initial_threshold for r in stage_1_processed)
        if stage_1_processed and (not apply_threshold or found_high_confidence_stage1):
            logger.info(f"✅ Stage 1 sufficient. Finalizing results.")
            final_results = stage_1_processed
            stage_used = "Direct"

    except Exception as e:
        logger.error(f"Error during Stage 1 search or re-ranking: {e}", exc_info=True)
        # Allow fallback to HyDE if Stage 1 fails completely

    # --- Stage 2: Fallback to Advanced HyDE Search (if Stage 1 wasn't sufficient) ---
    if not final_results: # Only run if Stage 1 didn't produce final results
        stage_used = "HyDE"
        logger.warning("⚠️ Stage 1 results insufficient or failed. Escalating to HyDE search...")
        try:
            hypothetical_doc = generate_hypothetical_sop_for_hyde(search_query_text)
            if not hypothetical_doc:
                logger.error("HyDE generation failed, cannot proceed.")
                return []

            logger.info("📄 Creating vector from HyDE document...")
            hyde_query_vector = embedder.encode(hypothetical_doc).tolist()

            logger.info("🚀 Stage 2: Searching Qdrant with HyDE vector...")
            hyde_search_results_raw = qdrant_client.search(
                collection_name=COLLECTION_NAME,
                query_vector=hyde_query_vector,
                limit=INITIAL_FETCH_K # Fetch more initially
            )
            logger.info(f"Stage 2 Qdrant Raw Results Count: {len(hyde_search_results_raw)}")

            # --- Apply Re-ranking to HyDE results ---
            hyde_search_results_reranked = await rerank_with_feedback(query, description, hyde_search_results_raw)

            stage_2_processed = []
            logger.info("--- HyDE Search Re-ranked & Filtered Results ---")
            for result in hyde_search_results_reranked:
                payload = result.payload or {}
                score = result.score # Already rounded
                logger.info(f"Score: {score} | Title: {payload.get('title', 'N/A')}")
                # --- CONDITIONAL THRESHOLD CHECK ---
                if not apply_threshold or score >= hyde_threshold:
                    stage_2_processed.append({
                        "id": result.id, "title": payload.get("title", ""), "issue": payload.get("issue", ""),
                        "steps": payload.get("steps", []), "tags": payload.get("tags", []), "score": score
                    })
                else:
                    logger.info(f"  -> Below HyDE threshold ({hyde_threshold}), skipped (apply_threshold={apply_threshold}).")

            final_results = stage_2_processed # Assign HyDE results as final

        except Exception as e:
            logger.error(f"Error during Stage 2 (HyDE) search or re-ranking: {e}", exc_info=True)
            return [] # Return empty on HyDE error

    # Log final outcome and limit to top_k
    if final_results:
        logger.info(f"✅ Final results determined using '{stage_used}' stage. Returning top {top_k}.")
    else:
        logger.warning(f"❌ No relevant Agents found after '{stage_used}' stage (Threshold Applied: {apply_threshold}).")

    return final_results[:top_k]

