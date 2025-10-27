# app/services/long_term_learning.py
import psycopg2
import os
import sys
import asyncio
import logging
from collections import defaultdict
from typing import Dict

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.config import settings
# VVV CHANGE IS HERE VVV
from app.utils.redis_client import get_redis_key_for_incident, update_feedback_summary

# --- REMOVED THE PROBLEMATIC ASYNCIO.RUN() LINE ---

# --- Configuration ---
DATABASE_URL = settings.database_url
CONFIDENCE_THRESHOLD = 3  # Min "Correct" votes for cache pre-population
CACHE_TTL_SECONDS = 60 * 60 * 24 * 30 # 30 days

logger = logging.getLogger(__name__)

# --- 1. Feedback Analysis ---
def analyze_feedback_data():
    """
    Connects to PostgreSQL and performs a comprehensive analysis of the
    retrieval_feedback table.
    """
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Overall Accuracy
        cur.execute("""
            SELECT user_feedback_type, COUNT(*) FROM retrieval_feedback GROUP BY user_feedback_type;
        """)
        accuracy_results = dict(cur.fetchall())
        correct = accuracy_results.get('Correct', 0)
        incorrect = accuracy_results.get('Incorrect', 0)
        total = correct + incorrect
        overall_accuracy = (correct / total) * 100 if total > 0 else 0

        # Best Performing Agents
        cur.execute("""
            SELECT correct_agent_title, COUNT(*) FROM retrieval_feedback
            WHERE user_feedback_type = 'Correct' AND correct_agent_title IS NOT NULL
            GROUP BY correct_agent_title ORDER BY COUNT(*) DESC LIMIT 5;
        """)
        best_agents = [{"agent_title": row[0], "correct_selections": row[1]} for row in cur.fetchall()]

        # Worst Performing Agents
        cur.execute("""
            SELECT recommended_agent_title, COUNT(*) FROM retrieval_feedback
            WHERE user_feedback_type = 'Incorrect' AND recommended_agent_title IS NOT NULL
            GROUP BY recommended_agent_title ORDER BY COUNT(*) DESC LIMIT 5;
        """)
        worst_agents = [{"agent_title": row[0], "incorrect_recommendations": row[1]} for row in cur.fetchall()]

        # Common Misclassifications
        cur.execute("""
            SELECT recommended_agent_title, correct_agent_title, COUNT(*)
            FROM retrieval_feedback WHERE user_feedback_type = 'Incorrect'
            AND recommended_agent_title IS NOT NULL AND correct_agent_title IS NOT NULL
            AND recommended_agent_title != correct_agent_title
            GROUP BY recommended_agent_title, correct_agent_title ORDER BY COUNT(*) DESC LIMIT 10;
        """)
        misclassifications = [{
            "recommended": row[0],
            "correct": row[1],
            "frequency": row[2]
        } for row in cur.fetchall()]

        return {
            "summary": {
                "total_feedback": total,
                "correct_recommendations": correct,
                "incorrect_recommendations": incorrect,
                "overall_accuracy": round(overall_accuracy, 2)
            },
            "best_performing_agents": best_agents,
            "worst_performing_agents": worst_agents,
            "common_misclassifications": misclassifications
        }
    except Exception as e:
        logger.error(f"Error during feedback analysis: {e}")
        raise
    finally:
        if conn:
            conn.close()


# --- 2. Redis Cache Pre-population ---
async def populate_cache_from_feedback(task_id: str, task_statuses: Dict):
    """
    Finds high-confidence mappings and populates Redis, updating the task status dict.
    """
    task_statuses[task_id] = {"status": "running", "progress": 0, "total": 0}
    conn = None
    try:
        logger.info(f"Starting Redis cache pre-population task_id: {task_id}...")
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        query = """
            SELECT incident_short_description, incident_description, correct_agent_id, COUNT(*)
            FROM retrieval_feedback WHERE user_feedback_type = 'Correct' AND correct_agent_id IS NOT NULL
            GROUP BY incident_short_description, incident_description, correct_agent_id
            HAVING COUNT(*) >= %s;
        """
        cur.execute(query, (CONFIDENCE_THRESHOLD,))
        items = cur.fetchall()
        total_items = len(items)
        task_statuses[task_id]["total"] = total_items

        if not items:
            logger.info("No high-confidence items found to pre-populate.")
            task_statuses[task_id] = {"status": "complete", "progress": 0, "total": 0, "message": "No high-confidence items found to cache."}
            return

        for i, row in enumerate(items):
            short_desc, full_desc, agent_id, _ = row
            redis_key = get_redis_key_for_incident(short_desc, full_desc)
            
            await update_feedback_summary(
                redis_key=redis_key,
                feedback_type='Correct',
                agent_id=agent_id,
                ttl_seconds=CACHE_TTL_SECONDS
            )
            # Update progress
            task_statuses[task_id]["progress"] = i + 1
            await asyncio.sleep(0.1) # Simulate work

        logger.info(f"Successfully pre-populated {total_items} items for task_id: {task_id}.")
        task_statuses[task_id] = {"status": "complete", "progress": total_items, "total": total_items, "message": f"Successfully cached {total_items} items."}

    except Exception as e:
        logger.error(f"Error during cache population for task_id {task_id}: {e}")
        task_statuses[task_id] = {"status": "error", "message": str(e)}
    finally:
        if conn:
            conn.close()


# --- 3. Model Fine-Tuning ---
async def trigger_model_finetuning():
    """
    Placeholder function to simulate triggering a model fine-tuning pipeline.
    """
    logger.info("--- Model Fine-Tuning Job Triggered ---")
    await asyncio.sleep(10) 
    logger.info("--- Model Fine-Tuning Job 'Completed' ---")
    return {
        "status": "triggered",
        "message": "Model fine-tuning pipeline has been successfully triggered. Monitor your ML Ops platform for progress.",
        "next_steps": [
            "1. Wait for the training pipeline to complete.",
            "2. Update the environment variable to point to the new model path.",
            "3. Run a script to re-embed all Agents using the new model.",
            "4. Restart the backend service."
        ]
    }