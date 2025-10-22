# iira/app/main.py

from fastapi import FastAPI, Path, Query, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.services.search_sop import search_sop_by_query

from app.agents.resolver_agent import ResolverAgent
from app.services.embed_documents import (
    delete_sop_by_id,
    embed_and_store_sops,
    get_all_sops,
    sync_scripts_to_qdrant,
    search_scripts_by_description,
    count_sops
)
from app.services.scripts import (
    get_scripts_from_db,
    add_script_to_db,
    update_script_in_db,
    add_incident_history_to_db,
    update_incident_history,
    delete_script_from_db,
    get_script_by_id,
    count_scripts
)
from app.services.activity_log_service import add_activity_log, get_activity_log_paginated
from app.services.history import get_incident_history_from_db_paginated
from app.services.incidents import (
    get_new_unresolved_incidents,
    update_incident_status,
    fetch_incident_by_number,
    count_incidents
)
from app.services.llm_client import (
    DEFAULT_MODELS,
    get_structured_sop_from_llm,
    generate_detailed_sop_from_llm,
    get_clarifying_questions_from_llm,
    get_llm_plan,
    generate_script_from_context_llm,
    generate_script_from_description_llm
)

from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from contextlib import asynccontextmanager
import asyncio
import logging
import datetime

# Configure logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

agent_status = {
    "status": "initializing",
    "current_incident": None,
    "last_checked": None
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Application starting up. Performing initial script sync to Qdrant...")
    agent_status["status"] = "initializing"
    await asyncio.to_thread(sync_scripts_to_qdrant)
    logger.info("✅ Initial script sync complete.")

    monitor_task = asyncio.create_task(monitor_new_incidents())
    logger.info("🚀 Background incident monitor started.")
    yield
    monitor_task.cancel()
    try:
        await monitor_task
    except asyncio.CancelledError:
        logger.info("🛑 Background incident monitor stopped.")
        agent_status["status"] = "stopped"

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:30000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
class Step(BaseModel):
    description: str
    script: Optional[str] = None
    script_id: Optional[str] = None

class SOP(BaseModel):
    title: str
    issue: str
    tags: Optional[List[str]] = []
    steps: List[Step]

class IngestRequest(BaseModel):
    sops: List[SOP]

class ScriptParam(BaseModel):
    param_name: str
    param_type: str
    required: bool
    default_value: Optional[str] = None

class AddScriptRequest(BaseModel):
    name: str
    description: str
    tags: List[str]
    content: str
    script_type: str
    params: List[ScriptParam]

class UpdateScriptRequest(BaseModel):
    id: int
    name: str
    description: str
    tags: List[str]
    content: str
    script_type: str
    params: List[ScriptParam]

class SOPDeleteByIDRequest(BaseModel):
    sop_id: str

class SOPParseRequest(BaseModel):
    document_text: str

class MatchScriptRequest(BaseModel):
    description: str

class GenerateSOPRequest(BaseModel):
    problem_description: str
    answers: Optional[Dict[str, str]] = None

class GenerateScriptContext(BaseModel):
    title: str
    issue: str
    steps: List[str]
    target_step_description: str    

class GenerateSimpleScriptRequest(BaseModel):
    description: str    

async def monitor_new_incidents():
    """
    A long-running task that finds new incidents and passes them to the
    ResolverAgent for processing.
    """
    while True:
        try:
            logger.info("⏱️  [Monitor] Checking for new unresolved incidents...")
            agent_status["status"] = "monitoring"
            agent_status["current_incident"] = None
            agent_status["last_checked"] = datetime.datetime.utcnow().isoformat()
            new_incidents = await asyncio.to_thread(get_new_unresolved_incidents)

            if new_incidents:
                logger.info(f"✅  [Monitor] Found {len(new_incidents)} new incidents. Triggering resolution agents.")

                for incident_number, incident_data in new_incidents.items():
                    logger.info(f"--- Processing Incident: {incident_number} ---")
                    agent_status["status"] = "resolving"
                    agent_status["current_incident"] = incident_number
                    
                    try:
                        incident_id = incident_data["id"]
                        await asyncio.to_thread(update_incident_status, incident_id, "In Progress")
                        logger.info(f"➡️  [Monitor] Incident {incident_number} status updated to 'In Progress'.")
                        
                        await asyncio.to_thread(add_incident_history_to_db, incident_number, incident_data, None, None)
                        
                        # Instantiate and run the Resolver Agent
                        resolver_agent = ResolverAgent()
                        agent_result = await asyncio.to_thread(resolver_agent.run, incident_data)
                        
                        # Update history and status based on the agent's final report
                        final_status = agent_result.get("status")
                        llm_plan = agent_result.get("plan")
                        execution_trace = agent_result.get("frontend_trace")

                        await asyncio.to_thread(update_incident_history, incident_number, llm_plan, execution_trace)
                        await asyncio.to_thread(update_incident_status, incident_id, final_status)
                        
                        logger.info(f"🏁  [Monitor] Finalized process for {incident_number} with status: {final_status}")

                    except Exception as e:
                        logger.exception(f"💥  [Monitor] Unhandled error during agent-based resolution for {incident_number}: {e}")
                        # Mark incident as error in case of unexpected failure
                        if 'incident_id' in locals():
                            await asyncio.to_thread(update_incident_status, incident_id, "Error")
            else:
                logger.info("...no new incidents found.")
            
            agent_status["status"] = "idle"
            agent_status["current_incident"] = None
            await asyncio.sleep(60)
            
        except Exception as e:
            logger.critical(f"🔥  [Monitor] Critical error in main loop: {e}", exc_info=True)
            agent_status["status"] = "error"
            await asyncio.sleep(60)

@app.get("/agent/status", summary="Get the current status of the background agent")
def get_agent_status():
    return JSONResponse(content=agent_status)

@app.post("/ingest")
def ingest_sop(request: IngestRequest):
    """
    Handles the ingestion of SOPs. This endpoint is now responsible for
    enriching the SOP data by looking up script names from script_ids
    before storing the document.
    """
    logger.info(f"📄 Executing ingest function for {len(request.sops)} SOP(s).")
    
    # Convert Pydantic models to dictionaries to make them mutable
    sop_dicts = [sop.model_dump() for sop in request.sops]
    
    # Create a quick lookup map for script IDs to script names
    available_scripts = get_scripts_from_db()
    script_id_to_name_map = {str(script['id']): script['name'] for script in available_scripts}

    # Enrich the SOP dictionaries with the script names
    for sop in sop_dicts:
        for step in sop.get("steps", []):
            # If the step has an ID but no name, look it up and add it.
            if step.get("script_id") and not step.get("script"):
                script_id = str(step["script_id"])
                script_name = script_id_to_name_map.get(script_id)
                if script_name:
                    step["script"] = script_name
                    logger.info(f"Enriched step: found name '{script_name}' for ID '{script_id}'")

    # Now, pass the fully enriched dictionaries to be stored
    embed_and_store_sops(sop_dicts)
    
    for sop in request.sops:
        add_activity_log("CREATE_SOP", {"sop_title": sop.title})
        
    return {"message": "SOP(s) ingested successfully"}

@app.post("/scripts/add")
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

@app.put("/scripts/update")
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

@app.get("/scripts")
def get_scripts():
    scripts = get_scripts_from_db()
    return JSONResponse(content={"scripts": scripts})

# --- REMOVED: The /execute_script endpoint is no longer needed as its logic is in the ExecutionAgent ---

@app.get("/search")
async def search_sop(q: str = Query(..., min_length=3), model: str = Query(DEFAULT_MODELS["plan"], description="LLM model for plan generation")):
    from app.services.script_resolver import resolve_scripts # Keep for manual search
    retrieved_sops = search_sop_by_query(q)
    if not retrieved_sops:
        return JSONResponse(content={"results": [], "message": "No relevant SOPs found."}, status_code=200)
    
    llm_plan_dict = get_llm_plan(q, retrieved_sops, model=model)
    available_scripts = get_scripts_from_db()
    resolved_scripts = resolve_scripts(llm_plan_dict, available_scripts)

    return JSONResponse(content={
        "query": q, "llm_plan": llm_plan_dict, "resolved_scripts": resolved_scripts,
        "retrieved_sops": retrieved_sops, "model_used": model  
    }, status_code=200)


@app.get("/incident/{incident_number}")
async def resolve_incident_by_number(
    incident_number: str = Path(..., min_length=3),
    source: Optional[str] = Query(None, description="Source of the request, e.g., 'test_bed'")
):
    incident_data = fetch_incident_by_number(incident_number.upper())
    if not incident_data:
        raise HTTPException(status_code=404, detail=f"Incident {incident_number} not found.")

    # Instantiate and run the Resolver Agent for the Test Bed
    resolver_agent = ResolverAgent()
    agent_result = await asyncio.to_thread(resolver_agent.run, incident_data)
    
    if source != 'test_bed':
        logger.info(f"📝 Logging Test Bed incident '{incident_number}' to history.")
        add_incident_history_to_db(
            incident_number, 
            incident_data, 
            agent_result.get("plan"), 
            agent_result.get("frontend_trace")
        )
    else:
        logger.info(f"🚫 Skipping history log for Test Bed incident '{incident_number}'")

    return JSONResponse(content={
        "incident_number": incident_number,
        "incident_data": incident_data,
        "llm_plan": agent_result.get("plan"),
        "resolved_scripts": agent_result.get("frontend_trace"),
    }, status_code=200)

@app.get("/history")
def get_incident_history(page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=100)):
    try:
        result = get_incident_history_from_db_paginated(page, limit)
        return result
    except Exception as e:
        logger.error("Failed to retrieve incident history", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sops/all", summary="Get all existing SOPs")
def get_all_sops_endpoint():
    sops = get_all_sops()
    return JSONResponse(content=sops, status_code=200)
    
@app.post("/delete_sop", summary="Delete an SOP by ID")
def delete_sop(request: SOPDeleteByIDRequest):
    all_sops = get_all_sops()
    sop_to_delete = next((sop for sop in all_sops if sop['id'] == request.sop_id), None)
    
    if not sop_to_delete:
        raise HTTPException(status_code=404, detail=f"No SOP found with the sop_id '{request.sop_id}'.")

    deleted = delete_sop_by_id(request.sop_id)
    if deleted:
        add_activity_log("DELETE_SOP", {"sop_id": request.sop_id, "sop_title": sop_to_delete.get('title', 'N/A')})
        return JSONResponse(content={"message": f"SOP with sop_id '{request.sop_id}' deleted successfully."}, status_code=200)
    else:
        raise HTTPException(status_code=404, detail=f"Failed to delete SOP with the sop_id '{request.sop_id}'.")

@app.post("/parse_sop", summary="Parse raw SOP text and match steps to scripts using vector search")
def parse_sop_endpoint(request: SOPParseRequest):
    try:
        logger.info("--- Starting Two-Step SOP Parsing Workflow ---")
        structured_sop = get_structured_sop_from_llm(request.document_text)
        
        final_steps = []
        
        logger.info("🔍  Starting Step B: Matching parsed steps to scripts via vector search...")
        for i, step in enumerate(structured_sop.get("steps", [])):
            description = step.get("description")
            if not description:
                continue

            logger.info(f"--- Matching Step {i+1} ---")
            search_results = search_scripts_by_description(description, top_k=1)
            
            best_match = search_results[0] if search_results else None
            
            final_steps.append({
                "description": description,
                "script": best_match['name'] if best_match else None,
                "script_id": str(best_match['id']) if best_match else "Not Found"
            })
        
        final_sop = {
            "title": structured_sop.get("title", ""),
            "issue": structured_sop.get("issue", ""),
            "steps": final_steps
        }
        
        logger.info("✅  Successfully completed two-step SOP parsing.")
        return JSONResponse(content=final_sop, status_code=200)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("🔥  Error during SOP parsing workflow")
        raise HTTPException(status_code=500, detail=f"An error occurred during AI parsing: {str(e)}")


@app.delete("/scripts/delete/{script_id}")
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
    
@app.post("/scripts/match", summary="Find the best script match for a single description")
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

@app.post("/generate_sop", summary="Generate a new SOP from a problem description using AI")
def generate_sop_endpoint(request: GenerateSOPRequest):
    try:
        if not request.answers:
            logger.info("--- Starting Stage 1: Analyze and Question ---")
            questions_data = get_clarifying_questions_from_llm(request.problem_description)
            
            if questions_data.get("questions"):
                logger.info(f"❓ Found {len(questions_data['questions'])} clarifying questions. Sending to user.")
                return JSONResponse(content={
                    "status": "clarification_needed",
                    "questions": questions_data["questions"]
                }, status_code=200)
            
            logger.info("✅ Initial description is sufficient. Proceeding directly to generation.")
            final_context = request.problem_description
        
        else:
            logger.info("--- Starting Stage 3: Generate and Match with User Answers ---")
            answers_str = "\n".join([f"- {q}: {a}" for q, a in request.answers.items()])
            final_context = f"Original Problem: {request.problem_description}\n\nUser's Answers to Clarifying Questions:\n{answers_str}"

        detailed_sop = generate_detailed_sop_from_llm(final_context)
        
        final_steps = []
        
        logger.info("🔍  Starting Script Matching sub-stage...")
        for i, step in enumerate(detailed_sop.get("steps", [])):
            description = step.get("description")
            if not description:
                continue

            logger.info(f"--- Matching Step {i+1} ---")
            search_results = search_scripts_by_description(description, top_k=1, score_threshold=0.6)
            best_match = search_results[0] if search_results else None
            
            final_steps.append({
                "description": description,
                "script": best_match['name'] if best_match else None,
                "script_id": str(best_match['id']) if best_match else "Not Found"
            })
            
        final_sop = {
            "title": detailed_sop.get("title", ""),
            "issue": detailed_sop.get("issue", ""),
            "steps": final_steps,
            "status": "sop_generated"
        }
            
        logger.info("✅ Successfully generated and resolved a new SOP.")
        return JSONResponse(content=final_sop, status_code=200)

    except Exception as e:
        logger.exception(f"🔥 Error during SOP generation workflow: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred during AI-powered SOP generation: {str(e)}")
    
@app.get("/system/stats", summary="Get system-wide statistics")
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

@app.get("/activity_log", summary="Get the system activity log")
def get_activity_log_endpoint(page: int = Query(1, ge=1), limit: int = Query(5, ge=1, le=100)):
    try:
        result = get_activity_log_paginated(page, limit)
        return JSONResponse(content=result, status_code=200)
    except Exception as e:
        logger.error("Failed to retrieve activity log", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve activity log.")

@app.post("/scripts/generate_from_context", summary="Generate a script from SOP context using AI")
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
    
@app.post("/scripts/generate_simple", summary="Generate a script from a simple description")
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