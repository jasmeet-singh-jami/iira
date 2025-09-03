# iira/app/main.py

from fastapi import FastAPI, Path, Query, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.services.embed_documents import embed_and_store_sops
from app.services.script_resolver import resolve_scripts
from app.services.search_sop import search_sop_by_query

from app.services.scripts import get_scripts_from_db, add_script_to_db, get_script_by_name, add_incident_history_to_db
from app.services.history import get_incident_history_from_db_paginated
from app.services.incidents import get_new_unresolved_incidents, update_incident_status, fetch_incident_by_number
from app.services.llm_client import get_llm_plan, extract_parameters_with_llm, DEFAULT_MODELS

from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from contextlib import asynccontextmanager
import asyncio

import time
import random
from datetime import datetime

# Use an async context manager for startup and shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # This task will run in the background.
    monitor_task = asyncio.create_task(monitor_new_incidents())
    print("🚀 Background incident monitor started.")
    yield
    # This will be executed when the application shuts down.
    monitor_task.cancel()
    try:
        await monitor_task
    except asyncio.CancelledError:
        print("🛑 Background incident monitor stopped.")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Step(BaseModel):
    description: str
    script: str

class SOP(BaseModel):
    title: str
    issue: str
    steps: List[Step]

class IngestRequest(BaseModel):
    sops: List[SOP]

# Pydantic models for the new /scripts/add endpoint
class ScriptParam(BaseModel):
    param_name: str
    param_type: str
    required: bool
    default_value: Optional[str] = None

class AddScriptRequest(BaseModel):
    name: str
    description: str
    tags: List[str]
    path: str
    params: List[ScriptParam]

class ExecuteScriptRequest(BaseModel):
    script_id: str
    script_name: str
    parameters: Dict[str, Any]      

async def monitor_new_incidents():
    """
    A long-running task to periodically check for new incidents in the database
    and trigger the resolution process for them.
    """
    while True:
        try:
            print("⏱️ Checking for new unresolved incidents...")
            # Use asyncio.to_thread for the synchronous database call
            new_incidents = await asyncio.to_thread(get_new_unresolved_incidents)
            
            if new_incidents:
                print(f"✅ Found {len(new_incidents)} new incidents. Triggering resolution.")
                # The get_new_unresolved_incidents function now returns a dictionary,
                # so we must iterate over its items to get both the incident number and data.
                for incident_number, incident_data in new_incidents.items():
                    # Get the incident ID
                    incident_id = incident_data["id"]
                    
                    # Change incident status to 'In Progress' immediately.
                    # This prevents the monitor from picking it up in the next cycle.
                    await asyncio.to_thread(update_incident_status, incident_id, "In Progress")
                    print(f"➡️ Incident {incident_number} status updated to 'In Progress'.")
                    
                    # Duplicate the resolution logic from the endpoint
                    rag_query = f"{incident_data['short_description']} {incident_data['description']}"
                    retrieved_sops = await asyncio.to_thread(search_sop_by_query, rag_query)

                    # Check and convert any datetime objects in the incident data to a string for JSON serialization
                    
                    if "timestamp" in incident_data and isinstance(incident_data["timestamp"], datetime):
                        incident_data["timestamp"] = incident_data["timestamp"].isoformat()

                    if not retrieved_sops:
                        print(f"❌ No relevant SOPs found for {incident_number}. Skipping.")
                        await asyncio.to_thread(update_incident_status, incident_id, "Error")
                        continue
                    
                    plan_model = DEFAULT_MODELS["plan"]
                    param_model = DEFAULT_MODELS["param_extraction"]
                    
                    llm_plan_dict = await asyncio.to_thread(get_llm_plan, rag_query, retrieved_sops, model=plan_model)
                    
                    available_scripts_with_params = await asyncio.to_thread(get_scripts_from_db)
                    resolved_scripts = resolve_scripts(llm_plan_dict, available_scripts_with_params)
                    
                    final_resolved_scripts = []
                    for resolved_script in resolved_scripts:
                        script_name = resolved_script.get('script_name')
                        if script_name:
                            script_details = next((s for s in available_scripts_with_params if s['name'] == script_name), None)
                            if script_details and script_details.get('params'):
                                extracted_params = await asyncio.to_thread(extract_parameters_with_llm, incident_data, script_details['params'], model=param_model)
                                resolved_script['extracted_parameters'] = extracted_params

                        final_resolved_scripts.append(resolved_script)     

                    # Add detailed logs to see the data before it's sent
                    print(f"📄 Incident data before adding history: {incident_data}")
                    print(f"📝 Resolved scripts before adding history: {final_resolved_scripts}")
                    
                    

                    await asyncio.to_thread(add_incident_history_to_db, incident_number, incident_data, llm_plan_dict, final_resolved_scripts)
                    
                    # Mark incident as resolved in the database.
                    await asyncio.to_thread(update_incident_status, incident_id, "Resolved")
                    print(f"🎉 Resolution complete and incident {incident_number} marked as resolved.")

            else:
                print("No new incidents found.")
            
            # Wait for a fixed period before checking again
            await asyncio.sleep(60) # Wait for 30 seconds
            
        except Exception as e:
            # Added more specific exception handling and logging
            print(f"Error in incident monitor: {e}")
            await asyncio.to_thread(update_incident_status, incident_id, "Error")
            await asyncio.sleep(60) # Wait longer on error to prevent a tight loop


@app.post("/ingest")
def ingest_sop(request: IngestRequest):
    sop_dicts = [sop.model_dump() for sop in request.sops]
    embed_and_store_sops(sop_dicts)
    return {"message": "SOP(s) ingested successfully"}

# Endpoint to add a new script
@app.post("/scripts/add")
def add_script(request: AddScriptRequest):
    """
    Adds a new script and its parameters to the database.
    """
    try:
        add_script_to_db(request.name, request.description, request.tags, request.path, request.params)
        return JSONResponse(content={"message": "Script added successfully"}, status_code=200)
    except ValueError as e:
        # Handle cases where the script name already exists
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        # Handle other potential database errors
        raise HTTPException(status_code=500, detail=f"Failed to add script: {str(e)}")


@app.get("/search")
async def search_sop(
    q: str = Query(..., min_length=3),
    model: str = Query(DEFAULT_MODELS["plan"], description="LLM model for plan generation")  # ✅ optional
):
    """
    Orchestration Engine: performs RAG, generates LLM plan, maps to scripts.
    """
    retrieved_sops = search_sop_by_query(q)
    if not retrieved_sops:
        return JSONResponse(content={"results": [], "message": "No relevant SOPs found."}, status_code=200)

    # ✅ Pass dynamic model
    llm_plan_dict = get_llm_plan(q, retrieved_sops, model=model)

    available_scripts = get_scripts_from_db()
    resolved_scripts = resolve_scripts(llm_plan_dict, available_scripts)

    return JSONResponse(content={
        "query": q,
        "llm_plan": llm_plan_dict,
        "resolved_scripts": resolved_scripts,
        "retrieved_sops": retrieved_sops,
        "model_used": model  
    }, status_code=200)


@app.get("/incident/{incident_number}")
async def resolve_incident_by_number(
    incident_number: str = Path(..., min_length=3),
    plan_model: str = Query(DEFAULT_MODELS["plan"], description="Model for plan generation"),
    param_model: str = Query(DEFAULT_MODELS["param_extraction"], description="Model for param extraction")  # ✅
):
    """
    Incident Orchestration: RAG → LLM plan → Script resolution → Parameter extraction.
    """
    incident_data = fetch_incident_by_number(incident_number.upper())
    if not incident_data:
        raise HTTPException(status_code=404, detail=f"Incident {incident_number} not found.")

    rag_query = f"{incident_data['short_description']} {incident_data['description']}"
    retrieved_sops = search_sop_by_query(rag_query)
    if not retrieved_sops:
        return JSONResponse(content={"results": [], "message": "No relevant SOPs found."}, status_code=200)

    # ✅ use chosen model for plan generation
    llm_plan_dict = get_llm_plan(rag_query, retrieved_sops, model=plan_model)

    available_scripts_with_params = get_scripts_from_db()
    resolved_scripts = resolve_scripts(llm_plan_dict, available_scripts_with_params)

    final_resolved_scripts = []
    for resolved_script in resolved_scripts:
        script_name = resolved_script.get('script_name')
        if script_name:
            script_details = next((s for s in available_scripts_with_params if s['name'] == script_name), None)
            if script_details and script_details.get('params'):
                # ✅ use param_model for parameter extraction
                extracted_params = extract_parameters_with_llm(incident_data, script_details['params'], model=param_model)
                resolved_script['extracted_parameters'] = extracted_params

        final_resolved_scripts.append(resolved_script)

    # ✅ Store the incident resolution history in the database
    add_incident_history_to_db(incident_number, incident_data, llm_plan_dict, final_resolved_scripts)     

    return JSONResponse(content={
        "incident_number": incident_number,
        "incident_data": incident_data,
        "llm_plan": llm_plan_dict,
        "resolved_scripts": final_resolved_scripts,
        "retrieved_sops": retrieved_sops,
        "plan_model_used": plan_model,
        "param_model_used": param_model
    }, status_code=200)

# Endpoint to fetch all scripts
@app.get("/scripts")
def get_scripts():
    """
    Returns a list of all available scripts from the database, including their parameters.
    """
    scripts = get_scripts_from_db()
    return JSONResponse(content={"scripts": scripts})

@app.post("/execute_script")
def execute_script(request: ExecuteScriptRequest):
    """
    Dummy executor for scripts with:
    - 10-second artificial delay
    - 70% success / 30% failure outcome
    """
    # Simulate execution time
    time.sleep(5)

    # Randomize result
    if random.random() < 0.8:
        return JSONResponse(
            content={
                "status": "success",
                "output": (
                    f"Script {request.script_name} (ID: {request.script_id}) "
                    f"executed successfully with parameters {request.parameters}"
                ),
            },
            status_code=200,
        )
    else:
        return JSONResponse(
            content={
                "status": "error",
                "output": (
                    f"Script {request.script_name} (ID: {request.script_id}) "
                    f"failed to execute with parameters {request.parameters}"
                ),
            },
            status_code=200,
        )

@app.get("/history")
def get_incident_history(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Records per page"),
):
    """
    Retrieves incident history with pagination.
    """
    try:
        result = get_incident_history_from_db_paginated(page, limit)
        return result
    except Exception as e:
        print(f"Error fetching history: {e}")
        raise HTTPException(status_code=500, detail=str(e))
