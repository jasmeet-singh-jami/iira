# iira/app/services/embed_documents.py

from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct, PointIdsList, UpdateStatus
from sentence_transformers import SentenceTransformer
from app.config import settings
import uuid
# --- NEW: Import the script fetching function ---
from app.services.scripts import get_scripts_from_db
# --- MODIFICATION: Import List and Dict for type hinting ---
from typing import List, Dict
# --- END MODIFICATION ---


qdrant_client = QdrantClient(
    host=settings.qdrant_host,
    port=settings.qdrant_port,
)

MODEL_PATH = "/app/ml_models/all-MiniLM-L6-v2"
# --- MODIFICATION: Define collection names as constants ---
SOP_COLLECTION_NAME = "sop_documents"
SCRIPT_COLLECTION_NAME = "available_scripts"
# --- END MODIFICATION ---

embedder = SentenceTransformer(MODEL_PATH)


def embed_and_store_sops(sops):
    # This function's existing logic for SOPs remains, but points to the correct collection
    if not qdrant_client.collection_exists(collection_name=SOP_COLLECTION_NAME):
        qdrant_client.create_collection(
            collection_name=SOP_COLLECTION_NAME,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE)
        )

    points = []
    print(f"📄 Executing embed_and_store_sops function for {len(sops)} SOPs")
    for sop in sops:
        content = f"Title: {sop['title']}. Issue: {sop['issue']}. " + " ".join(step["description"] for step in sop["steps"])
        vector = embedder.encode(content).tolist()
        point = PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload=sop
        )
        points.append(point)
        
    qdrant_client.upsert(collection_name=SOP_COLLECTION_NAME, points=points)
    print(f"✅ Stored {len(points)} SOP documents in Qdrant.")


# --- NEW: Function to sync scripts from PostgreSQL to Qdrant ---
def sync_scripts_to_qdrant():
    """
    Fetches all scripts from the PostgreSQL database and upserts them into a
    dedicated Qdrant collection for fast semantic search. This acts as a
    synchronization mechanism.
    """
    print("🔄 Starting sync from PostgreSQL to Qdrant script collection...")
    
    # 1. Create the collection if it doesn't exist
    if not qdrant_client.collection_exists(collection_name=SCRIPT_COLLECTION_NAME):
        qdrant_client.create_collection(
            collection_name=SCRIPT_COLLECTION_NAME,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE)
        )
        print(f"✅ Created new Qdrant collection: {SCRIPT_COLLECTION_NAME}")

    # 2. Fetch all scripts from the database
    all_scripts = get_scripts_from_db()
    if not all_scripts:
        print("⚠️ No scripts found in the database to sync.")
        return

    # 3. Create vector embeddings and PointStructs for each script
    points = []
    for script in all_scripts:
        content_to_embed = f"Name: {script['name']}. Description: {script['description']}"
        vector = embedder.encode(content_to_embed).tolist()
        
        point = PointStruct(
            id=int(script['id']),
            vector=vector,
            payload={ "name": script['name'], "id": int(script['id']) }
        )
        points.append(point)

    # 4. Upsert all points into Qdrant
    qdrant_client.upsert(
        collection_name=SCRIPT_COLLECTION_NAME,
        points=points,
        wait=True
    )
    print(f"✅ Successfully synced {len(points)} scripts to Qdrant.")
# --- END NEW ---

# --- NEW: Function to search for scripts based on a step description ---
def search_scripts_by_description(description: str, top_k: int = 1, score_threshold: float = 0.4) -> List[Dict]:
    """
    Performs a vector search on the dedicated scripts collection in Qdrant to find
    the best script match for a given SOP step description.
    """
    print(f"🔎 Searching for script matching description: \"{description[:50]}...\"")
    
    query_vector = embedder.encode(description).tolist()

    search_results = qdrant_client.search(
        collection_name=SCRIPT_COLLECTION_NAME,
        query_vector=query_vector,
        limit=top_k,
        score_threshold=score_threshold
    )
    
    if not search_results:
        print("🤷 No confident script match found.")
        return []
        
    best_match = search_results[0]
    print(f"🎯 Best match found: '{best_match.payload['name']}' (Score: {best_match.score:.4f})")
    
    # Return the minimal payload needed for the next step
    return [best_match.payload]
# --- END NEW ---


def get_all_sops():
    """
    Retrieves all SOP documents from the Qdrant collection using pagination.
    """
    # This function's existing logic remains, but points to the correct collection
    sops = []
    offset = None
    try:
        while True:
            scroll_result, next_page_offset = qdrant_client.scroll(
                collection_name=SOP_COLLECTION_NAME,
                limit=100,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )
            
            sops.extend([{"id": point.id, **point.payload} for point in scroll_result])
            
            if next_page_offset is None:
                break
            
            offset = next_page_offset
    
    except Exception as e:
        print(f"Error retrieving SOPs: {e}")
        return []
        
    return sops


def delete_sop_by_id(sop_id: str) -> bool:
    """
    Deletes an SOP from the Qdrant collection based on its unique ID.
    
    Returns:
        bool: True if the delete request was acknowledged, False otherwise.
    """
    # This function's existing logic remains, but points to the correct collection
    print(f"Deleting SOP with ID '{sop_id}'")
    try:
        operation_info = qdrant_client.delete(
            collection_name=SOP_COLLECTION_NAME,
            points_selector=PointIdsList(points=[sop_id])
        )
        return operation_info.status.value in [UpdateStatus.COMPLETED, "acknowledged"]
    except Exception as e:
        print(f"Error deleting SOP with ID '{sop_id}': {e}")
        return False

