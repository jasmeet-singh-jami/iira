# app/services/long_term_learning.py
import psycopg2
import os
import sys
import asyncio
import logging
import json
import subprocess
from typing import Dict, List
import shutil

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.config import settings
from app.utils.redis_client import get_redis_key_for_incident, update_feedback_summary
from app.services.settings_service import update_setting, load_setting

# --- Configuration ---
DATABASE_URL = settings.database_url
CONFIDENCE_THRESHOLD = 3
CACHE_TTL_SECONDS = 60 * 60 * 24 * 30
TASK_STATUS_DIR = "/tmp" 

logger = logging.getLogger(__name__)

def analyze_feedback_data():
    # ... (this function is unchanged)
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("SELECT user_feedback_type, COUNT(*) FROM retrieval_feedback GROUP BY user_feedback_type;")
        accuracy_results = dict(cur.fetchall())
        correct = accuracy_results.get('Correct', 0)
        incorrect = accuracy_results.get('Incorrect', 0)
        total = correct + incorrect
        overall_accuracy = (correct / total) * 100 if total > 0 else 0
        cur.execute("""
            SELECT correct_agent_title, COUNT(*) FROM retrieval_feedback
            WHERE user_feedback_type = 'Correct' AND correct_agent_title IS NOT NULL
            GROUP BY correct_agent_title ORDER BY COUNT(*) DESC LIMIT 5;
        """)
        best_agents = [{"agent_title": row[0], "correct_selections": row[1]} for row in cur.fetchall()]
        cur.execute("""
            SELECT recommended_agent_title, COUNT(*) FROM retrieval_feedback
            WHERE user_feedback_type = 'Incorrect' AND recommended_agent_title IS NOT NULL
            GROUP BY recommended_agent_title ORDER BY COUNT(*) DESC LIMIT 5;
        """)
        worst_agents = [{"agent_title": row[0], "incorrect_recommendations": row[1]} for row in cur.fetchall()]
        cur.execute("""
            SELECT recommended_agent_title, correct_agent_title, COUNT(*)
            FROM retrieval_feedback WHERE user_feedback_type = 'Incorrect'
            AND recommended_agent_title IS NOT NULL AND correct_agent_title IS NOT NULL
            AND recommended_agent_title != correct_agent_title
            GROUP BY recommended_agent_title, correct_agent_title ORDER BY COUNT(*) DESC LIMIT 10;
        """)
        misclassifications = [{"recommended": row[0], "correct": row[1], "frequency": row[2]} for row in cur.fetchall()]
        return {
            "summary": {"total_feedback": total, "correct_recommendations": correct, "incorrect_recommendations": incorrect, "overall_accuracy": round(overall_accuracy, 2)},
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


async def populate_cache_from_feedback(task_id: str, task_statuses: Dict):
    # ... (this function is unchanged)
    task_statuses[task_id] = {"status": "running", "progress": 0, "total": 0}
    conn = None
    try:
        logger.info(f"Starting Redis cache pre-population task_id: {task_id}...")
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        query = "SELECT incident_short_description, incident_description, correct_agent_id, COUNT(*) FROM retrieval_feedback WHERE user_feedback_type = 'Correct' AND correct_agent_id IS NOT NULL GROUP BY incident_short_description, incident_description, correct_agent_id HAVING COUNT(*) >= %s;"
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
            await update_feedback_summary(redis_key=redis_key, feedback_type='Correct', agent_id=agent_id, ttl_seconds=CACHE_TTL_SECONDS)
            task_statuses[task_id]["progress"] = i + 1
            await asyncio.sleep(0.1)
        logger.info(f"Successfully pre-populated {total_items} items for task_id: {task_id}.")
        task_statuses[task_id] = {"status": "complete", "progress": total_items, "total": total_items, "message": f"Successfully cached {total_items} items."}
    except Exception as e:
        logger.error(f"Error during cache population for task_id {task_id}: {e}")
        task_statuses[task_id] = {"status": "error", "message": str(e)}
    finally:
        if conn:
            conn.close()


def run_script_in_background(script_path: str, task_status_file: str, args: list = []):
    """Runs a python script as a separate process."""
    command = [sys.executable, script_path, *args]
    logging.info(f"Executing background command: {' '.join(command)}")
    subprocess.Popen(command)

def monitor_task_status(task_id: str, task_statuses: Dict):
    """Reads a task's status file and updates the in-memory status dict."""
    status_file = os.path.join(TASK_STATUS_DIR, f"{task_id}.json")
    try:
        if os.path.exists(status_file):
            with open(status_file, 'r') as f:
                status_data = json.load(f)
                
                # Check if this is a finetuning task that has just completed
                if task_statuses.get(task_id, {}).get("status") != "complete" and status_data.get("status") == "complete":
                    if "new_model_path" in status_data:
                        new_path = status_data["new_model_path"]
                        try:
                            update_setting("EMBEDDING_MODEL_PATH", new_path)
                            logger.info(f"Successfully updated database with new model path: {new_path}")
                        except Exception as e:
                            logger.error(f"Failed to update model path in database: {e}")
                
                task_statuses[task_id] = status_data
                if status_data.get("status") in ["complete", "error"]:
                    os.remove(status_file)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        logging.warning(f"Could not read status file for task {task_id}: {e}")


async def trigger_re_embedding(task_id: str, task_statuses: Dict):
    """Triggers the re-embedding script as a background process."""
    model_path = load_setting("EMBEDDING_MODEL_PATH")
    if not model_path or not os.path.isdir(model_path):
        task_statuses[task_id] = {"status": "error", "message": f"Invalid or missing model path found in settings: {model_path}"}
        return
        
    task_status_file = os.path.join(TASK_STATUS_DIR, f"{task_id}.json")
    task_statuses[task_id] = {"status": "starting", "message": "Re-embedding process initiated..."}
    
    run_script_in_background(
        script_path="scripts/re_embed_documents.py",
        task_status_file=task_status_file,
        args=[model_path, task_status_file]
    )

async def trigger_model_finetuning(task_id: str, task_statuses: Dict):
    """Triggers the fine-tuning script as a background process."""
    task_status_file = os.path.join(TASK_STATUS_DIR, f"{task_id}.json")
    task_statuses[task_id] = {"status": "starting", "message": "Fine-tuning process initiated..."}
    
    run_script_in_background(
        script_path="scripts/fine_tune_model.py",
        task_status_file=task_status_file,
        args=[task_status_file]
    )

def get_model_management_info() -> List[Dict]:
    """
    Lists all fine-tuned models, identifies the active one, and returns
    a list for management purposes.
    """
    model_base_dir = "/app/ml_models"
    try:
        # Get the currently active model path from the database
        active_model_path = load_setting("EMBEDDING_MODEL_PATH")

        all_models = []
        for dir_name in os.listdir(model_base_dir):
            full_path = os.path.join(model_base_dir, dir_name)
            if os.path.isdir(full_path) and (dir_name.startswith("finetuned-") or dir_name.startswith("fine-tuned-")):
                is_active = (full_path == active_model_path)
                all_models.append({
                    "name": dir_name,
                    "path": full_path,
                    "isActive": is_active
                })
        
        # Sort by name for consistent ordering
        all_models.sort(key=lambda x: x['name'], reverse=True)
        return all_models

    except Exception as e:
        logger.error(f"Error getting model management info: {e}")
        return []

def delete_inactive_model(model_name: str) -> Dict:
    """
    Deletes a specified model directory, but only if it is not the
    currently active model.
    """
    model_base_dir = "/app/ml_models"
    target_path = os.path.join(model_base_dir, model_name)

    if not os.path.isdir(target_path):
        raise FileNotFoundError(f"Model directory '{model_name}' not found.")

    # Safety Check:
    active_model_path = load_setting("EMBEDDING_MODEL_PATH")
    if target_path == active_model_path:
        raise ValueError("Cannot delete the currently active model.")

    try:
        shutil.rmtree(target_path)
        logger.info(f"Successfully deleted model directory: {target_path}")
        return {"message": f"Model '{model_name}' deleted successfully."}
    except Exception as e:
        logger.error(f"Error deleting model '{model_name}': {e}")
        raise    