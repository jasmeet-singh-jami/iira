# iira/app/main.py

from fastapi import FastAPI, Path, Query, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.services.embed_documents import embed_and_store_sops
from app.services.script_resolver import resolve_scripts
from app.services.search_sop import search_sop_by_query

from app.services.scripts import get_scripts_from_db, add_script_to_db, get_script_by_name, add_incident_history_to_db, update_incident_history
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
import json


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
            # Step 1: Use asyncio.to_thread for the synchronous database call
            new_incidents = await asyncio.to_thread(get_new_unresolved_incidents)
            
            if new_incidents:
                print(f"✅ Found {len(new_incidents)} new incidents. Triggering resolution.")
                
                # Step 2: Immediately update the status of all new incidents to 'In Progress'
                # This prevents them from being picked up again in the next cycle.
                for incident_number, incident_data in new_incidents.items():
                    incident_id = incident_data["id"]
                    await asyncio.to_thread(update_incident_status, incident_id, "In Progress")
                    print(f"➡️ Incident {incident_number} status updated to 'In Progress'.")
                
                # Step 3: Now, process each incident
                for incident_number, incident_data in new_incidents.items():
                    incident_id = incident_data["id"]
                    
                    await asyncio.to_thread(add_incident_history_to_db, incident_number, incident_data, None, None)
                    
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
                    
                    if not llm_plan_dict or not llm_plan_dict.get("steps"):
                        print(f"⚠️ LLM failed to generate a valid plan for {incident_number}. Marking as Error.")
                        await asyncio.to_thread(update_incident_status, incident_id, "Error")
                        await asyncio.to_thread(update_incident_history, incident_number, llm_plan_dict, [])
                        continue
                    
                    available_scripts_with_params = await asyncio.to_thread(get_scripts_from_db)
                    resolved_scripts = resolve_scripts(llm_plan_dict, available_scripts_with_params)
                    
                    executed_scripts = []
                    accumulated_context = incident_data.copy()
                    
                    # ➕ ADDED: Flag to track if any script failed
                    resolution_failed = False

                    for resolved_script in resolved_scripts:
                        script_name = resolved_script.get('script_name')
                        
                        if script_name and not resolution_failed:
                            script_details = next((s for s in available_scripts_with_params if s['name'] == script_name), None)
                            extracted_params = {}
                            
                            if script_details and script_details.get('params'):
                                print(f"🔍 Parameters required for '{script_name}'. Extracting...")
                                extracted_params = await asyncio.to_thread(
                                    extract_parameters_with_llm, 
                                    accumulated_context, 
                                    script_details['params'], 
                                    model=param_model
                                )

                                missing_params = []
                                # ➕ MODIFIED: Check for empty string or None for required params
                                for param in script_details['params']:
                                    param_name = param['param_name']
                                    is_required = param['required']
                                    has_default = param.get('default_value') is not None
                                    
                                    if is_required:
                                        # Check if parameter is missing OR its value is an empty string/None
                                        param_value = extracted_params.get(param_name)
                                        if not param_value:  # This correctly handles None and empty strings
                                            if has_default:
                                                extracted_params[param_name] = param['default_value']
                                                print(f"⚠️ Required parameter '{param_name}' not extracted. Using default value: {param['default_value']}")
                                            else:
                                                missing_params.append(param_name)

                                if missing_params:
                                    error_message = f"❌ Failed to extract required parameters for script '{script_name}': {', '.join(missing_params)}. Cancelling execution."
                                    print(error_message)
                                    resolved_script['status'] = "error"
                                    resolved_script['output'] = error_message
                                    resolution_failed = True # Set flag to true
                                
                                resolved_script['extracted_parameters'] = extracted_params
                            else:
                                print(f"✅ No parameters required for '{script_name}'. Skipping extraction.")

                            # If a parameter extraction failure was found, the process should be halted.
                            if not resolution_failed:
                                print(f"⚙️ Executing script: '{script_name}' with parameters: {extracted_params}")
                                
                                execution_request = ExecuteScriptRequest(
                                    script_id=str(resolved_script.get('script_id')),
                                    script_name=script_name,
                                    parameters=extracted_params
                                )
                                
                                response = execute_script(execution_request)
                                response_body = json.loads(response.body.decode())
                                
                                script_output = response_body.get("output", "No output from script.")
                                
                                # ➕ ADDED: Check if the script's output indicates a failure
                                if "failed to execute" in script_output.lower():
                                    resolved_script['status'] = "error"
                                    resolved_script['output'] = script_output
                                    print(f"❌ Script '{script_name}' reported a failure. Halting resolution process.")
                                    resolution_failed = True # Set flag to true
                                else:
                                    resolved_script['status'] = "success"
                                    resolved_script['output'] = script_output
                                    accumulated_context[f"{script_name}_output"] = script_output
                                    print(f"📝 Script '{script_name}' execution output: {script_output}")
                            
                        executed_scripts.append(resolved_script)
                    
                    print(f"📄 Incident data before updating history: {incident_data}")
                    print(f"💾 Resolved and executed scripts before updating history: {executed_scripts}")
                    
                    await asyncio.to_thread(update_incident_history, incident_number, llm_plan_dict, executed_scripts)
                    
                    # ➕ MODIFIED: Final status check based on the resolution_failed flag
                    if resolution_failed:
                        await asyncio.to_thread(update_incident_status, incident_id, "Error")
                        print(f"❗ Resolution process for {incident_number} failed. Incident status updated to 'Error'.")
                    else:
                        await asyncio.to_thread(update_incident_status, incident_id, "Resolved")
                        print(f"🎉 Resolution complete and incident {incident_number} marked as resolved.")

            else:
                print("No new incidents found.")
            
            await asyncio.sleep(60)
            
        except Exception as e:
            print(f"Error in incident monitor: {e}")
            await asyncio.to_thread(update_incident_status, incident_id, "Error")
            await asyncio.sleep(60)


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
    model: str = Query(DEFAULT_MODELS["plan"], description="LLM model for plan generation")
):
    """
    Orchestration Engine: performs RAG, generates LLM plan, maps to scripts.
    """
    retrieved_sops = search_sop_by_query(q)
    if not retrieved_sops:
        return JSONResponse(content={"results": [], "message": "No relevant SOPs found."}, status_code=200)

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
    param_model: str = Query(DEFAULT_MODELS["param_extraction"], description="Model for param extraction")
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

    llm_plan_dict = get_llm_plan(rag_query, retrieved_sops, model=plan_model)

    available_scripts_with_params = get_scripts_from_db()
    resolved_scripts = resolve_scripts(llm_plan_dict, available_scripts_with_params)

    final_resolved_scripts = []
    for resolved_script in resolved_scripts:
        script_name = resolved_script.get('script_name')
        if script_name:
            script_details = next((s for s in available_scripts_with_params if s['name'] == script_name), None)
            if script_details and script_details.get('params'):
                extracted_params = extract_parameters_with_llm(incident_data, script_details['params'], model=param_model)
                resolved_script['extracted_parameters'] = extracted_params

        final_resolved_scripts.append(resolved_script)

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
    - 5-second artificial delay
    - 80% success / 20% failure outcome
    """
    time.sleep(5)

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