# iira/app/services/embed_documents.py

from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct
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
