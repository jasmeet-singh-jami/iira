from fastapi import APIRouter, HTTPException, Path, Body
from fastapi.responses import JSONResponse
from app.schemas import AddScriptRequest, UpdateScriptRequest, MatchScriptRequest, GenerateScriptContext, GenerateSimpleScriptRequest
from app.services.scripts import get_scripts_from_db, add_script_to_db, update_script_in_db, delete_script_from_db, get_script_by_id
from app.services.activity_log_service import add_activity_log
from app.services.embed_documents import sync_scripts_to_qdrant, search_scripts_by_description
from app.services.llm_client import generate_script_from_context_llm, generate_script_from_description_llm
import logging

router = APIRouter(prefix="/scripts", tags=["Scripts"])
logger = logging.getLogger(__name__)

@router.get("")
def get_scripts():
    scripts = get_scripts_from_db()
    return JSONResponse(content={"scripts": scripts})

@router.post("/scripts/generate_simple", summary="Generate a script from a simple description")
def generate_script_simple(request: GenerateSimpleScriptRequest):
    """
    Takes a simple description and uses an LLM to generate a complete script
    object, including a name, content, and parameters.
    """
    try:
        script_object = generate_script_from_description_llm(request.description)
        return JSONResponse(content=script_object, status_code=200)
    except Exception as e:
        logger.exception("🔥 Error during simple AI-powered script generation")
        raise HTTPException(status_code=500, detail=f"An error occurred during script generation: {str(e)}")   

@router.post("/scripts/add")
def add_script(request: AddScriptRequest):
    try:
        logger.info(f"➕ Adding new script: '{request.name}'")
        add_script_to_db(
            name=request.name, description=request.description, tags=request.tags,
            content=request.content, script_type=request.script_type, params=request.params
        )
        logger.info("🔄 Triggering Qdrant sync after add...")
        sync_scripts_to_qdrant()
        add_activity_log("CREATE_SCRIPT", {"script_name": request.name})
        return JSONResponse(content={"message": "Script added successfully"}, status_code=200)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.error("Failed to add script", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add script: {str(e)}")

@router.put("/scripts/update")
def update_script(request: UpdateScriptRequest):
    try:
        logger.info(f"📝 Updating script ID: {request.id}")
        update_script_in_db(
            script_id=request.id, name=request.name, description=request.description,
            tags=request.tags, content=request.content, script_type=request.script_type,
            params=request.params
        )
        logger.info("🔄 Triggering Qdrant sync after update...")
        sync_scripts_to_qdrant()
        add_activity_log("UPDATE_SCRIPT", {"script_id": request.id, "script_name": request.name})
        return JSONResponse(content={"message": "Script updated successfully"}, status_code=200)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to update script with ID {request.id}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update script: {str(e)}")
    
@router.delete("/scripts/delete/{script_id}")
def delete_script(script_id: int = Path(..., ge=1)):
    try:
        script_details = get_script_by_id(script_id)
        if not script_details:
             raise HTTPException(status_code=404, detail=f"Script with ID {script_id} not found.")

        logger.info(f"🗑️ Deleting script with ID: {script_id}")
        deleted_rows = delete_script_from_db(script_id)
        if deleted_rows == 0:
            raise HTTPException(status_code=404, detail=f"Script with ID {script_id} not found.")
        
        logger.info("🔄 Triggering Qdrant sync after delete...")
        sync_scripts_to_qdrant()

        add_activity_log("DELETE_SCRIPT", {"script_id": script_id, "script_name": script_details.get('name', 'N/A')})
        
        return JSONResponse(content={"message": f"Script with ID {script_id} deleted successfully."}, status_code=200)
    except Exception as e:
        logger.error(f"Failed to delete script with ID {script_id}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete script: {str(e)}")
    
@router.post("/scripts/match", summary="Find the best script match for a single description")
def match_script_endpoint(request: MatchScriptRequest):
    try:
        logger.info(f"⚡️ Received request to match description: \"{request.description[:50]}...\"")
        search_results = search_scripts_by_description(request.description, top_k=1)
        
        best_match = search_results[0] if search_results else None
        
        if best_match:
            full_script_details = get_script_by_id(best_match['id'])
            if full_script_details:
                return JSONResponse(content={
                    "script_name": full_script_details['name'],
                    "script_id": str(full_script_details['id'])
                }, status_code=200)

        return JSONResponse(content={
            "script_name": None,
            "script_id": "Not Found"
        }, status_code=200)

    except Exception as e:
        logger.exception("🔥  Error during single script matching")
        raise HTTPException(status_code=500, detail="An error occurred during script matching.")       
    
@router.post("/scripts/generate_from_context", summary="Generate a script from SOP context using AI")
def generate_script_endpoint(context: GenerateScriptContext):
    """
    Takes the context of an SOP draft and a target step, and uses an LLM
    to generate a complete script object to automate that step.
    """
    try:
        script_object = generate_script_from_context_llm(context.model_dump())
        return JSONResponse(content=script_object, status_code=200)
    except Exception as e:
        logger.exception("🔥 Error during AI-powered script generation")
        raise HTTPException(status_code=500, detail=f"An error occurred during script generation: {str(e)}")    