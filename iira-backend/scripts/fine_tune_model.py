# scripts/fine-tune-model.py
import sys
import os
import json # <<< ADD THIS
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import psycopg2
from sentence_transformers import SentenceTransformer, InputExample, losses
from torch.utils.data import DataLoader
from app.config import settings
import logging
from datetime import datetime
import random
from app.services.settings_service import load_setting # <<< ADD THIS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = settings.database_url
# --- UPDATED: Load the current model path dynamically ---
CURRENT_MODEL_PATH = load_setting("EMBEDDING_MODEL_PATH")
OUTPUT_MODEL_PATH = f"/app/ml_models/fine-tuned-model-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

# --- NEW: Helper function to write status ---
def update_task_status(path: str, status: dict):
    """Writes the current task status to the JSON file."""
    try:
        with open(path, 'w') as f:
            json.dump(status, f)
    except Exception as e:
        logger.error(f"Failed to write task status to {path}: {e}")

def fetch_all_agents_from_qdrant():
    """Fetch all agents from Qdrant"""
    from app.services.embed_documents import qdrant_client, SOP_COLLECTION_NAME
    
    all_agents = {}
    offset = None
    
    try:
        logger.info("Fetching all agents from Qdrant...")
        # ... (rest of this function is unchanged) ...
        while True:
            scroll_result, next_page_offset = qdrant_client.scroll(
                collection_name=SOP_COLLECTION_NAME,
                limit=100,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )
            
            for point in scroll_result:
                agent_id = str(point.id)
                payload = point.payload
                
                title = payload.get('title', '')
                issue = payload.get('issue', '')
                steps = payload.get('steps', [])
                
                step_contents = []
                for step in steps:
                    description = step.get('description', '')
                    script = step.get('script')
                    if script:
                        step_contents.append(f"{description} (using the script: {script})")
                    else:
                        step_contents.append(description)
                
                agent_text = f"Title: {title}. Issue: {issue}. Steps: {' '.join(step_contents)}"
                all_agents[agent_id] = {
                    'text': agent_text,
                    'title': title
                }
            
            if next_page_offset is None:
                break
            offset = next_page_offset
        
        logger.info(f"Loaded {len(all_agents)} agents from Qdrant")
        return all_agents
        
    except Exception as e:
        logger.error(f"Error fetching agents from Qdrant: {e}")
        return {}


def create_training_data_with_cosine_loss(task_status_path: str): # <<< Pass status path
    """
    Alternative: Use CosineSimilarityLoss with binary labels (better for small datasets)
    """
    conn = None
    training_examples = []
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT 
                incident_short_description,
                incident_description,
                correct_agent_id
            FROM retrieval_feedback
            WHERE user_feedback_type = 'Correct'
              AND correct_agent_id IS NOT NULL
            ORDER BY id;
        """)
        
        feedback_entries = cur.fetchall()
        
        if len(feedback_entries) < 20:
            logger.error(f"Insufficient data: {len(feedback_entries)} examples")
            raise ValueError(f"Insufficient data: {len(feedback_entries)} examples. Need at least 20.")
        
        update_task_status(task_status_path, {"status": "running", "message": f"Fetched {len(feedback_entries)} feedback entries..."})
        
        all_agents = fetch_all_agents_from_qdrant()
        
        if len(all_agents) < 3: # Need at least one negative
            logger.error("Need at least 3 agents")
            raise ValueError("Need at least 3 agents in Qdrant to create negative samples.")
        
        update_task_status(task_status_path, {"status": "running", "message": f"Loaded {len(all_agents)} agents from Qdrant..."})

        positive_pairs = []
        negative_pairs = []
        
        for short_desc, full_desc, agent_id in feedback_entries:
            anchor = f"{short_desc} {full_desc}".strip()
            correct_agent_id = str(agent_id)
            
            if correct_agent_id not in all_agents:
                continue
            
            positive_text = all_agents[correct_agent_id]['text']
            
            positive_pairs.append(
                InputExample(texts=[anchor, positive_text], label=1.0)
            )
            
            other_agent_ids = [aid for aid in all_agents.keys() if aid != correct_agent_id]
            num_negatives = min(2, len(other_agent_ids))
            
            if num_negatives > 0:
                sampled_negative_ids = random.sample(other_agent_ids, num_negatives)
                for neg_id in sampled_negative_ids:
                    negative_text = all_agents[neg_id]['text']
                    negative_pairs.append(
                        InputExample(texts=[anchor, negative_text], label=0.0)
                    )
        
        training_examples = positive_pairs + negative_pairs
        random.shuffle(training_examples)
        
        logger.info(f"Created {len(positive_pairs)} positive pairs")
        logger.info(f"Created {len(negative_pairs)} negative pairs")
        
        return training_examples
        
    except Exception as e:
        logger.error(f"Error creating training data: {e}", exc_info=True)
        raise # Re-raise exception to be caught by main
    finally:
        if conn:
            conn.close()


def main(task_status_path: str): # <<< Accept task_status_path
    
    update_task_status(task_status_path, {"status": "running", "message": "Starting fine-tuning..."})
    
    try:
        logger.info("=" * 70)
        logger.info("IIRA Model Fine-Tuning")
        logger.info("=" * 70)
        
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM retrieval_feedback WHERE user_feedback_type = 'Correct'")
        feedback_count = cur.fetchone()[0]
        conn.close()
        
        logger.info(f"Available feedback entries: {feedback_count}")
        update_task_status(task_status_path, {"status": "running", "message": f"Found {feedback_count} feedback entries..."})
        
        if feedback_count < 20:
            message = f"Insufficient data: {feedback_count} examples. Need at least 20."
            logger.error(message)
            raise ValueError(message)
        
        # Load base model (dynamically)
        logger.info(f"Loading base model: {CURRENT_MODEL_PATH}")
        update_task_status(task_status_path, {"status": "running", "message": f"Loading model: {CURRENT_MODEL_PATH.split('/')[-1]}"})
        model = SentenceTransformer(CURRENT_MODEL_PATH)
        
        # Create training data
        logger.info("\nChoosing training approach...")
        logger.info("Using CosineSimilarityLoss (better for small datasets)")
        
        training_examples = create_training_data_with_cosine_loss(task_status_path)
        
        if len(training_examples) < 40:
            message = f"Could not create sufficient training examples ({len(training_examples)} created)."
            logger.error(message)
            raise ValueError(message)
        
        update_task_status(task_status_path, {"status": "running", "message": f"Created {len(training_examples)} training pairs..."})
        
        # Split data (80/20)
        split_idx = int(len(training_examples) * 0.8)
        train_data = training_examples[:split_idx]
        val_data = training_examples[split_idx:]
        
        logger.info(f"\nTraining set: {len(train_data)} examples")
        logger.info(f"Validation set: {len(val_data)} examples")
        
        train_dataloader = DataLoader(train_data, shuffle=True, batch_size=8)
        train_loss = losses.CosineSimilarityLoss(model)
        
        logger.info("\n" + "=" * 70)
        logger.info("Starting fine-tuning...")
        logger.info("=" * 70)
        update_task_status(task_status_path, {"status": "running", "message": "Starting model training..."})

        num_epochs = 2
        warmup_steps = int(len(train_dataloader) * num_epochs * 0.1)
        
        model.fit(
            train_objectives=[(train_dataloader, train_loss)],
            epochs=num_epochs,
            warmup_steps=warmup_steps,
            output_path=OUTPUT_MODEL_PATH,
            save_best_model=True,
            show_progress_bar=True,
            optimizer_params={'lr': 2e-5},
            weight_decay=0.01,
            checkpoint_save_steps=len(train_dataloader),
            checkpoint_save_total_limit=2
        )
        
        logger.info("\n" + "=" * 70)
        logger.info("Fine-tuning Complete!")
        logger.info("=" * 70)
        logger.info(f"Model saved to: {OUTPUT_MODEL_PATH}")
        
        # --- FINAL: Write success status ---
        update_task_status(task_status_path, {
            "status": "complete",
            "message": f"Model saved to: {OUTPUT_MODEL_PATH}",
            "new_model_path": OUTPUT_MODEL_PATH
        })

    except Exception as e:
        logger.error(f"An error occurred during fine-tuning: {e}", exc_info=True)
        # --- FINAL: Write error status ---
        update_task_status(task_status_path, {
            "status": "error",
            "message": str(e)
        })


if __name__ == "__main__":
    # --- UPDATED: Read task_status_path from command-line argument ---
    if len(sys.argv) > 1:
        task_status_path_arg = sys.argv[1]
        main(task_status_path_arg)
    else:
        logger.error("Error: Please provide a path for the task status file.")
        # If run without args, try to write a fail-safe error
        fallback_path = "/tmp/finetune_error.json"
        update_task_status(fallback_path, {"status": "error", "message": "Script started without task_status_path."})

