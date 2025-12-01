import logging
from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from app.schemas import RetrievalFeedbackRequest
from app.state import task_statuses
from app.services.long_term_learning import analyze_feedback_data, populate_cache_from_feedback, trigger_model_finetuning, trigger_re_embedding, monitor_task_status, get_model_management_info, delete_inactive_model
from app.services.feedback_service import add_retrieval_feedback
import uuid

router = APIRouter(tags=["Learning"])

logger = logging.getLogger(__name__)

@router.post("/feedback/retrieval")
async def submit_retrieval_feedback(request: RetrievalFeedbackRequest):
    """Stores user feedback about Agent retrieval accuracy in the database and updates cache."""
    logger.info(f"Received retrieval feedback: Type='{request.user_feedback_type}', Recommended='{request.recommended_agent_title or 'N/A'}'")

    session_id = request.session_id or str(uuid.uuid4())

    success = await add_retrieval_feedback(
        incident_short_description=request.incident_short_description,
        incident_description=request.incident_description,
        recommended_agent_id=request.recommended_agent_id,
        recommended_agent_title=request.recommended_agent_title,
        search_score=request.search_score,
        user_feedback_type=request.user_feedback_type,
        correct_agent_id=request.correct_agent_id,
        correct_agent_title=request.correct_agent_title,
        incident_number=request.incident_number,
        session_id=session_id
    )

    if success:
        return JSONResponse(content={"message": "Feedback submitted successfully.", "session_id": session_id}, status_code=201)
    else:
        # Consider more specific error logging if possible from add_retrieval_feedback
        raise HTTPException(status_code=500, detail="Failed to store feedback in the database.")

@router.post("/learning/fine-tune-model")
async def run_model_finetuning(background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    background_tasks.add_task(trigger_model_finetuning, task_id, task_statuses)
    return JSONResponse(content={"message": "Started.", "task_id": task_id}, status_code=202)

@router.get("/learning/feedback-report", summary="Get a comprehensive report on agent feedback")
def get_feedback_report():
    """
    Analyzes the retrieval_feedback table and returns a structured report.
    """
    try:
        report = analyze_feedback_data()
        return JSONResponse(content=report, status_code=200)
    except Exception as e:
        logger.error("Failed to generate feedback report", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


@router.post("/learning/populate-cache", summary="Pre-populate Redis cache with high-confidence mappings")
async def run_cache_population(background_tasks: BackgroundTasks):
    """
    Triggers a background task for cache population and returns a task ID for status polling.
    """
    task_id = str(uuid.uuid4())
    task_statuses[task_id] = {"status": "starting", "progress": 0, "total": 0}
    background_tasks.add_task(populate_cache_from_feedback, task_id, task_statuses)
    return JSONResponse(content={"message": "Redis cache pre-population task started.", "task_id": task_id}, status_code=202)


@router.post("/learning/fine-tune-model", summary="Trigger the model fine-tuning pipeline")
async def run_model_finetuning(background_tasks: BackgroundTasks):
    """Triggers the fine-tuning background process."""
    task_id = str(uuid.uuid4())
    background_tasks.add_task(trigger_model_finetuning, task_id, task_statuses)
    return JSONResponse(content={"message": "Model fine-tuning process has been started.", "task_id": task_id}, status_code=202)

@router.post("/learning/re-embed-agents", summary="Trigger re-embedding of all agents")
async def run_re_embedding(background_tasks: BackgroundTasks):
    """Triggers the agent re-embedding background process with the new model."""
    task_id = str(uuid.uuid4())
    background_tasks.add_task(trigger_re_embedding, task_id, task_statuses)
    return JSONResponse(content={"message": "Agent re-embedding process has been started.", "task_id": task_id}, status_code=202)

@router.get("/learning/task-status/{task_id}", summary="Get the status of a background task")
def get_task_status(task_id: str): # <<< REMOVED background_tasks from here
    """Poll this endpoint to get task progress."""
    # The monitor function will read the file and update the in-memory dict
    monitor_task_status(task_id, task_statuses)

    status = task_statuses.get(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Task ID not found or expired.")
    return JSONResponse(content=status)

@router.get("/learning/models", summary="List all fine-tuned models")
def list_all_models():
    """Returns a list of all models in the ml_models directory and identifies the active one."""
    logger.info(":::::::::::Inside list_all_models:::::::::::")
    try:
        models = get_model_management_info()
        return JSONResponse(content={"models": models})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/learning/models/{model_name}", summary="Delete an inactive fine-tuned model")
def delete_a_model(model_name: str):
    """Deletes a model directory, but prevents deletion of the active model."""
    try:
        result = delete_inactive_model(model_name)
        return JSONResponse(content=result)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e: # For trying to delete the active model
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

