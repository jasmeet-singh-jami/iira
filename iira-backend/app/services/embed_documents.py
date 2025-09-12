# iira/app/services/embed_documents.py

from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct, PointIdsList
from qdrant_client.http.models import PointsSelector
from sentence_transformers import SentenceTransformer
from app.config import settings
import uuid


qdrant_client = QdrantClient(
    host=settings.qdrant_host,
    port=settings.qdrant_port,
    #api_key=settings.qdrant_api_key
)

COLLECTION_NAME = "sop_documents"
MODEL_NAME = "all-MiniLM-L6-v2"

embedder = SentenceTransformer(MODEL_NAME)


def embed_and_store_sops(sops):
    if not qdrant_client.collection_exists(COLLECTION_NAME):
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE)
        )

    points = []
    for sop in sops:
        content = f"{sop['title']} {sop['issue']} " + " ".join(step["description"] for step in sop["steps"])
        vector = embedder.encode(content).tolist()
        point = PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload=sop
        )
        points.append(point)

    qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)


def get_all_sops():
    """
    Retrieves all SOP documents from the Qdrant collection using pagination.
    """
    sops = []
    offset = None
    try:
        # Loop to handle pagination, fetching documents in chunks until all are retrieved
        while True:
            scroll_result, next_page_offset = qdrant_client.scroll(
                collection_name=COLLECTION_NAME,
                limit=100,  # Fetch up to 100 at a time
                offset=offset,
                with_payload=True,
                with_vectors=False
            )
            
            sops.extend([{"id": point.id, **point.payload} for point in scroll_result])
            
            # If next_page_offset is None, we've reached the end of the collection
            if next_page_offset is None:
                break
            
            # Update the offset for the next scroll request
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
    print(f"Deleting SOP with ID '{sop_id}'")
    try:
        operation_info = qdrant_client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=PointIdsList(points=[sop_id])
        )
        # operation_info is an UpdateResult
        return operation_info.status.value == "acknowledged" or operation_info.status.value == "completed"
    except Exception as e:
        print(f"Error deleting SOP with ID '{sop_id}': {e}")
        return False