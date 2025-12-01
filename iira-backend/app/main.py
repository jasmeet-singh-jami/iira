# iira/app/main.py

import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Services & Utils
from app.utils.redis_client import init_redis_pool, close_redis_pool
from app.services.embed_documents import sync_scripts_to_qdrant
from app.services.monitor import monitor_new_incidents

# Global State
from app.state import agent_status

# Routers
from app.routers import scripts_router, sops_router, learning_router, system_router

# Configure logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Application starting up. Performing initial script sync to Qdrant...")
    agent_status["status"] = "initializing"
    
    await init_redis_pool()
    await asyncio.to_thread(sync_scripts_to_qdrant)
    
    logger.info("✅ Initial script sync complete.")

    # Start the background monitor
    monitor_task = asyncio.create_task(monitor_new_incidents())
    logger.info("🚀 Background incident monitor started.")
    
    yield
    
    # Shutdown
    monitor_task.cancel()
    try:
        await monitor_task
    except asyncio.CancelledError:
        logger.info("🛑 Background incident monitor stopped.")
        agent_status["status"] = "stopped"
    
    await close_redis_pool()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:30000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(scripts_router.router)
app.include_router(sops_router.router)
app.include_router(learning_router.router)
app.include_router(system_router.router)

@app.get("/", summary="Health Check")
def health_check():
    return JSONResponse(content={"status": "running", "message": "IIRA Backend is active"})