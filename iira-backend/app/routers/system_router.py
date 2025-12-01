import logging
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
from app.services.history import get_incident_history_from_db_paginated
from app.services.activity_log_service import get_activity_log_paginated
from app.services.embed_documents import count_sops
from app.services.scripts import count_scripts
from app.services.incidents import count_incidents
from app.state import agent_status

router = APIRouter(tags=["System"])
logger = logging.getLogger(__name__)

@router.get("/agent/status", summary="Get the current status of the background agent")
def get_agent_status():
    return JSONResponse(content=agent_status)

@router.get("/history")
def get_incident_history(page: int = Query(1), limit: int = Query(10)):
    try:
        result = get_incident_history_from_db_paginated(page, limit)
        return result
    except Exception as e:
        logger.error("Failed to retrieve incident history", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system/stats", summary="Get system-wide statistics")
def get_system_stats():
    try:
        sop_count = count_sops()
        script_count = count_scripts()
        incident_count = count_incidents()
        
        return JSONResponse(content={
            "total_sops": sop_count,
            "total_scripts": script_count,
            "total_incidents": incident_count,
        }, status_code=200)

    except Exception as e:
        logger.error("Failed to retrieve system stats", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve system statistics.")

@router.get("/activity_log", summary="Get the system activity log")
def get_activity_log_endpoint(page: int = Query(1, ge=1), limit: int = Query(5, ge=1, le=100)):
    try:
        result = get_activity_log_paginated(page, limit)
        return JSONResponse(content=result, status_code=200)
    except Exception as e:
        logger.error("Failed to retrieve activity log", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve activity log.")