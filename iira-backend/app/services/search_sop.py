from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer
from app.config import settings
from app.services.llm_client import generate_hypothetical_sop
# --- NEW: Import the settings loader ---
from app.services.settings_service import load_search_thresholds
# --- END NEW ---

# --- MODIFICATION: Load thresholds from the database instead of hardcoding ---
SEARCH_THRESHOLDS = load_search_thresholds()
MODEL_PATH = "/app/ml_models/all-MiniLM-L6-v2"
COLLECTION_NAME = "sop_documents"
# --- END MODIFICATION ---

# --- Initialize Clients ---
qdrant_client = QdrantClient(
    host=settings.qdrant_host,
    port=settings.qdrant_port,
)

embedder = SentenceTransformer(MODEL_PATH)


def search_sop_by_query(query, top_k=3):
    """
    Performs a hybrid two-stage search for the most relevant SOP.

    Stage 1: A fast, direct vector search using the raw incident query.
    Stage 2 (Fallback): If the first search yields no results, it escalates
             to an advanced HyDE search, using an LLM to generate a more
             descriptive document for embedding.
    """
    print("--- Starting Hybrid Search Workflow ---")
    
    # --- Stage 1: Fast, Direct Vector Search ---
    print("🚀 Stage 1: Performing direct vector search...")
    direct_query_vector = embedder.encode(query).tolist()

    direct_search_results = qdrant_client.search(
        collection_name=COLLECTION_NAME,
        query_vector=direct_query_vector,
        limit=top_k
    )

    filtered_results = []
    print("--- Direct Search Results ---")
    for result in direct_search_results:
        payload = result.payload
        print(f"Result Score: {result.score:.4f} — Title: {payload.get('title')}")
        # --- MODIFICATION: Use dynamic threshold from database ---
        if result.score >= SEARCH_THRESHOLDS['INITIAL_SEARCH_THRESHOLD']:
        # --- END MODIFICATION ---
            filtered_results.append({
                "title": payload.get("title", ""),
                "issue": payload.get("issue", ""),
                "steps": payload.get("steps", []),
                "tags": payload.get("tags", []),
                "score": result.score
            })

    # If the direct search found good matches, return them immediately.
    if filtered_results:
        print("✅ Found high-confidence match in direct search. Returning results.")
        return filtered_results

    # --- Stage 2: Fallback to Advanced HyDE Search ---
    print("\n⚠️ Direct search did not yield high-confidence results. Escalating to HyDE search...")
    
    # Generate the hypothetical SOP document from the incident query
    hypothetical_doc = generate_hypothetical_sop(query)
    
    # Create a vector embedding from the hypothetical document
    print("📄 Creating vector from hypothetical document...")
    hyde_query_vector = embedder.encode(hypothetical_doc).tolist()

    # Use the new vector to search Qdrant
    print("🚀 Stage 2: Searching Qdrant with the HyDE vector...")
    hyde_search_results = qdrant_client.search(
        collection_name=COLLECTION_NAME,
        query_vector=hyde_query_vector,
        limit=top_k
    )

    hyde_filtered_results = []
    print("--- HyDE Search Results ---")
    for result in hyde_search_results:
        payload = result.payload
        print(f"Result Score: {result.score:.4f} — Title: {payload.get('title')}")
        # --- MODIFICATION: Use dynamic threshold from database ---
        if result.score >= SEARCH_THRESHOLDS['HYDE_SEARCH_THRESHOLD']:
        # --- END MODIFICATION ---
            hyde_filtered_results.append({
                "title": payload.get("title", ""),
                "issue": payload.get("issue", ""),
                "steps": payload.get("steps", []),
                "tags": payload.get("tags", []),
                "score": result.score
            })
            
    if hyde_filtered_results:
        print("✅ Found relevant match using advanced HyDE search.")
    else:
        print("❌ No relevant SOPs found even after advanced search.")

    return hyde_filtered_results

