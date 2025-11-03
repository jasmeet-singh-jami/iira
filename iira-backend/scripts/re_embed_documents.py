# iira-backend/scripts/re_embed_documents.py
import os
import sys
import json
import logging
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient, models

# --- Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.config import settings
from app.services.embed_documents import SOP_COLLECTION_NAME

def main(model_path: str, task_status_path: str):
    task_status = {"status": "running", "progress": 0, "total": 0, "message": "Starting re-embedding process..."}
    with open(task_status_path, 'w') as f:
        json.dump(task_status, f)
        
    try:
        logging.info(f"Loading new model from: {model_path}")
        embedder = SentenceTransformer(model_path)

        logging.info(f"Connecting to Qdrant at {settings.qdrant_host}:{settings.qdrant_port}")
        qdrant_client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
        
        count_result = qdrant_client.count(collection_name=SOP_COLLECTION_NAME, exact=True)
        total_docs = count_result.count
        task_status["total"] = total_docs
        
        logging.info(f"Found {total_docs} documents to re-embed in collection '{SOP_COLLECTION_NAME}'.")
        
        points_to_update = []
        offset = None
        processed_count = 0
        
        while True:
            scroll_result, next_page_offset = qdrant_client.scroll(
                collection_name=SOP_COLLECTION_NAME,
                limit=50,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )
            
            if not scroll_result:
                break

            for point in scroll_result:
                sop = point.payload
                step_contents = [f"{step.get('description', '')} (using the script: {step.get('script')})" if step.get('script') else step.get('description', '') for step in sop.get('steps', [])]
                content = f"Title: {sop.get('title', '')}. Issue: {sop.get('issue', '')}. Steps: {' '.join(step_contents)}"
                
                new_vector = embedder.encode(content).tolist()
                
                points_to_update.append(models.PointStruct(id=point.id, vector=new_vector, payload=point.payload))
                processed_count += 1

            # Update progress
            task_status["progress"] = processed_count
            with open(task_status_path, 'w') as f:
                json.dump(task_status, f)

            if next_page_offset is None:
                break
            offset = next_page_offset
        
        if points_to_update:
            logging.info(f"Upserting {len(points_to_update)} points with new vectors...")
            qdrant_client.upsert(collection_name=SOP_COLLECTION_NAME, points=points_to_update, wait=True)

        message = f"Successfully re-embedded {processed_count} documents."
        logging.info(f"✅ {message}")
        task_status.update({"status": "complete", "message": message, "progress": processed_count})
        with open(task_status_path, 'w') as f:
            json.dump(task_status, f)

    except Exception as e:
        logging.error(f"An error occurred during re-embedding: {e}", exc_info=True)
        task_status.update({"status": "error", "message": str(e)})
        with open(task_status_path, 'w') as f:
            json.dump(task_status, f)

if __name__ == "__main__":
    if len(sys.argv) > 2:
        main(model_path=sys.argv[1], task_status_path=sys.argv[2])
    else:
        print("Error: Please provide a model_path and a task_status_path.")