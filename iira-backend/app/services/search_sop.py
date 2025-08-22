from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer
from app.config import settings

QDRANT_COLLECTION_NAME = "sop_documents"
MIN_SCORE_THRESHOLD = 0.5

MODEL_NAME = "all-MiniLM-L6-v2"
COLLECTION_NAME = "sop_documents"

qdrant_client = QdrantClient(
    host=settings.qdrant_host,
    port=settings.qdrant_port,
    #api_key=settings.qdrant_api_key
)

embedder = SentenceTransformer(MODEL_NAME)


def search_sop_by_query(query, top_k=3):
    query_vector = embedder.encode(query).tolist()

    search_results = qdrant_client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=top_k
    )

    filtered_results = []
    for result in search_results:
        payload = result.payload
        print(f"Result Score: {result.score} — Title: {payload.get('title')}")
        if result.score >= MIN_SCORE_THRESHOLD:
            

            filtered_results.append({
                "title": payload.get("title", ""),
                "issue": payload.get("issue", ""),
                "steps": payload.get("steps", []),
                "score": result.score
            })

    return filtered_results

