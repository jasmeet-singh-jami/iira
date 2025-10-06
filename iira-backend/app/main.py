# iira/app/main.py

from fastapi import FastAPI, Path, Query, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.services.embed_documents import (
    delete_sop_by_id, 
    embed_and_store_sops, 
    get_all_sops,
    sync_scripts_to_qdrant,
    search_scripts_by_description
)
from app.services.script_resolver import resolve_scripts
from app.services.search_sop import search_sop_by_query

from app.services.scripts import get_scripts_from_db, add_script_to_db, get_script_by_name, update_script_in_db, add_incident_history_to_db, update_incident_history, delete_script_from_db, get_script_by_id
from app.services.history import get_incident_history_from_db_paginated
from app.services.incidents import get_new_unresolved_incidents, update_incident_status, fetch_incident_by_number
from app.services.llm_client import get_llm_plan, extract_parameters_with_llm, DEFAULT_MODELS, get_structured_sop_from_llm

from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from contextlib import asynccontextmanager
import asyncio

import tempfile
import json
import os
import subprocess

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- MODIFICATION: Sync scripts on startup ---
    print("🚀 Application starting up. Performing initial script sync to Qdrant...")
    # This ensures the script search index is ready when the application starts.
    await asyncio.to_thread(sync_scripts_to_qdrant)
    print("✅ Initial script sync complete.")
    # --- END MODIFICATION ---
    
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
    allow_origins=["http://localhost:3000", "http://localhost:30000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
class Step(BaseModel):
    description: str
    script: Optional[str] = None
    script_id: Optional[str] = None # This is used by the frontend

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

# --- MODIFICATION: Pydantic models now use 'content' instead of 'path' ---
class AddScriptRequest(BaseModel):
    name: str
    description: str
    tags: List[str]
    content: str
    params: List[ScriptParam]

class UpdateScriptRequest(BaseModel):
    id: int
    name: str
    description: str
    tags: List[str]
    content: str
    params: List[ScriptParam]

class ExecuteScriptRequest(BaseModel):
    script_id: str
    script_name: str
    parameters: Dict[str, Any]      

class SOPDeleteByIDRequest(BaseModel):
    sop_id: str

class SOPParseRequest(BaseModel):
    document_text: str    

class MatchScriptRequest(BaseModel):
    description: str    

async def monitor_new_incidents():
    """
    A long-running task to periodically check for new incidents in the database
    and trigger the resolution process for them.
    """
    while True:
        try:
            print("⏱️  [Monitor] Checking for new unresolved incidents...")
            new_incidents = await asyncio.to_thread(get_new_unresolved_incidents)

            if new_incidents:
                print(f"✅  [Monitor] Found {len(new_incidents)} new incidents. Triggering resolution.")

                for incident_number, incident_data in new_incidents.items():
                    print(f"--- Processing Incident: {incident_number} ---")
                    resolution_failed = False
                    sop_not_found = False
                    executed_scripts = []
                    llm_plan_dict = None

                    try:
                        incident_id = incident_data["id"]
                        await asyncio.to_thread(update_incident_status, incident_id, "In Progress")
                        print(f"➡️  [Monitor] Incident {incident_number} status updated to 'In Progress'.")
                        
                        await asyncio.to_thread(add_incident_history_to_db, incident_number, incident_data, None, None)
                        
                        rag_query = f"{incident_data['short_description']} {incident_data['description']}"
                        retrieved_sops = await asyncio.to_thread(search_sop_by_query, rag_query)

                        if not retrieved_sops:
                            print(f"❌  [Monitor] No relevant SOPs found for {incident_number}. Skipping.")
                            resolution_failed = True
                            sop_not_found = True
                            continue

                        llm_plan_dict = await asyncio.to_thread(get_llm_plan, rag_query, retrieved_sops, model=DEFAULT_MODELS["plan"])
                        
                        if not llm_plan_dict or not llm_plan_dict.get("steps"):
                            print(f"⚠️  [Monitor] LLM failed to generate a valid plan for {incident_number}. Marking as Error.")
                            resolution_failed = True
                            continue
                        
                        await asyncio.to_thread(update_incident_history, incident_number, llm_plan_dict, executed_scripts)

                        available_scripts_with_params = await asyncio.to_thread(get_scripts_from_db)
                        resolved_scripts = resolve_scripts(llm_plan_dict, available_scripts_with_params)

                        accumulated_context = incident_data.copy()

                        for i, resolved_script in enumerate(resolved_scripts):
                            print(f"--- [Monitor] Executing Step {i+1} for {incident_number} ---")
                            script_name = resolved_script.get('script_name')
                            
                            if resolution_failed:
                                resolved_script['status'] = 'skipped'
                                executed_scripts.append(resolved_script)
                                await asyncio.to_thread(update_incident_history, incident_number, llm_plan_dict, executed_scripts)
                                continue

                            if script_name:
                                script_details = next((s for s in available_scripts_with_params if s['name'] == script_name), None)
                                extracted_params = {}

                                if script_details and script_details.get('params'):
                                    extracted_params = await asyncio.to_thread(
                                        extract_parameters_with_llm, 
                                        accumulated_context, 
                                        script_details['params'], 
                                        model=DEFAULT_MODELS["param_extraction"]
                                    )
                                    
                                    missing_params = [
                                        p['param_name'] for p in script_details['params']
                                        if p['required'] and not extracted_params.get(p['param_name']) and not p.get('default_value')
                                    ]
                                    
                                    if missing_params:
                                        error_message = f"❌  [Monitor] Failed to extract required parameters for script '{script_name}': {', '.join(missing_params)}. Cancelling execution."
                                        print(error_message)
                                        resolved_script['status'] = "error"
                                        resolved_script['output'] = error_message
                                        resolution_failed = True
                                    
                                    resolved_script['extracted_parameters'] = extracted_params

                                if not resolution_failed:
                                    execution_request = ExecuteScriptRequest(
                                        script_id=str(resolved_script.get('script_id')),
                                        script_name=script_name,
                                        parameters=extracted_params
                                    )
                                    
                                    response = await asyncio.to_thread(execute_script, execution_request)
                                    response_body = json.loads(response.body.decode())
                                    
                                    if response_body.get("status") == "error":
                                        resolved_script['status'] = "error"
                                        resolved_script['output'] = response_body.get("output", "Script failed.")
                                        resolution_failed = True
                                    else:
                                        resolved_script['status'] = "success"
                                        resolved_script['output'] = response_body.get("output", "Script executed successfully with no output.")
                                        accumulated_context[f"{script_name}_output"] = resolved_script['output']
                                
                            executed_scripts.append(resolved_script)
                            
                            print(f"💾  [Monitor] Updating history for {incident_number} after Step {i+1}.")
                            await asyncio.to_thread(update_incident_history, incident_number, llm_plan_dict, executed_scripts)

                    except Exception as e:
                        print(f"💥  [Monitor] Unhandled error during incident {incident_number} resolution: {e}")
                        resolution_failed = True
                        
                    finally:
                        print(f"🏁  [Monitor] Finalizing process for {incident_number}.")
                        await asyncio.to_thread(update_incident_history, incident_number, llm_plan_dict, executed_scripts)

                        if sop_not_found:
                            await asyncio.to_thread(update_incident_status, incident_id, "SOP not found")
                        elif resolution_failed:
                            await asyncio.to_thread(update_incident_status, incident_id, "Error")
                        else:
                            await asyncio.to_thread(update_incident_status, incident_id, "Resolved")
            else:
                print("...no new incidents found.")
            
            await asyncio.sleep(60)
            
        except Exception as e:
            print(f"🔥  [Monitor] Critical error in main loop: {e}")
            await asyncio.sleep(60)


@app.post("/ingest")
def ingest_sop(request: IngestRequest):
    """
    Handles the ingestion of one or more SOP documents.
    """
    # This function's existing logic remains unchanged.
    print(f"📄 Executing ingest function for {len(request.sops)} SOP(s).")
    sop_dicts = [sop.model_dump() for sop in request.sops]
    embed_and_store_sops(sop_dicts)
    return {"message": "SOP(s) ingested successfully"}

# --- MODIFICATION: Sync Qdrant after adding, updating, or deleting scripts ---
@app.post("/scripts/add")
def add_script(request: AddScriptRequest):
    """
    Adds a new script to the database and triggers a sync with the Qdrant search index.
    """
    try:
        print(f"➕ Adding new script: '{request.name}'")
        add_script_to_db(request.name, request.description, request.tags, request.content, request.params)
        print("🔄 Triggering Qdrant sync after add...")
        sync_scripts_to_qdrant()
        return JSONResponse(content={"message": "Script added successfully"}, status_code=200)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add script: {str(e)}")

@app.put("/scripts/update")
def update_script(request: UpdateScriptRequest):
    """
    Updates an existing script in the database and triggers a sync with the Qdrant search index.
    """
    try:
        print(f"📝 Updating script ID: {request.id}")
        update_script_in_db(
            script_id=request.id,
            name=request.name,
            description=request.description,
            tags=request.tags,
            content=request.content,
            params=request.params
        )
        print("🔄 Triggering Qdrant sync after update...")
        sync_scripts_to_qdrant()
        return JSONResponse(content={"message": "Script updated successfully"}, status_code=200)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update script: {str(e)}")
# --- END MODIFICATION ---

@app.get("/scripts")
def get_scripts():
    """
    Returns a list of all available scripts from the database.
    """
    # This function's existing logic remains unchanged.
    scripts = get_scripts_from_db()
    return JSONResponse(content={"scripts": scripts})

@app.post("/execute_script")
def execute_script(request: ExecuteScriptRequest):
    """
    Executes a script by writing its content from the database to a temporary file.
    Includes detailed logging for debugging.
    """
    # This function's existing logic remains unchanged.
    script_details = get_script_by_name(request.script_name)
    if not script_details:
        raise HTTPException(status_code=404, detail=f"Script '{request.script_name}' not found.")

    script_content = script_details.get('content')
    if not script_content:
        raise HTTPException(status_code=500, detail=f"Script content not found for '{request.script_name}'.")

    temp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.sh', dir='/tmp') as temp_file:
            temp_file_path = temp_file.name
            temp_file.write(script_content)
            temp_file.flush()
        
        os.chmod(temp_file_path, 0o755)

        command = [temp_file_path]
        for param in script_details.get('params', []):
            param_name = param['param_name']
            param_value = request.parameters.get(param_name)
            if param_value is not None:
                command.append(str(param_value))

        print(f"📄 Executing temporary script: {' '.join(command)}")
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        
        if result.returncode == 0:
            print(f"✅ Script '{request.script_name}' executed successfully. Return Code: {result.returncode}")
            print(f"   📄 Output (stdout):\n---\n{result.stdout.strip()}\n---")
            return JSONResponse(
                content={"status": "success", "output": result.stdout.strip() or "Script executed successfully."},
                status_code=200,
            )
        else:
            error_output = (result.stdout.strip() + "\n" + result.stderr.strip()).strip()
            print(f"❌ Script '{request.script_name}' execution failed. Return Code: {result.returncode}")
            print(f"   📄 Error Output (stdout/stderr):\n---\n{error_output}\n---")
            return JSONResponse(
                content={"status": "error", "output": f"Script failed. Error: {error_output}"},
                status_code=200,
            )

    except Exception as e:
        print(f"💥 An unhandled exception occurred during script execution: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred during script execution: {str(e)}")
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
            print(f"✅ Cleaned up temporary file: {temp_file_path}")


@app.get("/search")
async def search_sop(q: str = Query(..., min_length=3), model: str = Query(DEFAULT_MODELS["plan"], description="LLM model for plan generation")):
    """
    Searches for relevant SOPs based on a query.
    """
    # This function's existing logic remains unchanged.
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
async def resolve_incident_by_number(incident_number: str = Path(..., min_length=3), plan_model: str = Query(DEFAULT_MODELS["plan"], description="Model for plan generation"), param_model: str = Query(DEFAULT_MODELS["param_extraction"], description="Model for param extraction")):
    """
    Resolves a specific incident by number, orchestrating the RAG, planning, and execution process.
    """
    # This function's existing logic remains unchanged.
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

@app.get("/history")
def get_incident_history(page: int = Query(1, ge=1, description="Page number"), limit: int = Query(10, ge=1, le=100, description="Records per page")):
    """
    Retrieves incident resolution history with pagination.
    """
    # This function's existing logic remains unchanged.
    try:
        result = get_incident_history_from_db_paginated(page, limit)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sops/all", summary="Get all existing SOPs")
def get_all_sops_endpoint():
    """
    Retrieves all SOP documents from the Qdrant collection.
    """
    # This function's existing logic remains unchanged.
    sops = get_all_sops()
    return JSONResponse(content=sops, status_code=200)
    
@app.post("/delete_sop", summary="Delete an SOP by ID")
def delete_sop(request: SOPDeleteByIDRequest):
    """
    Deletes an SOP document from the Qdrant collection.
    """
    # This function's existing logic remains unchanged.
    deleted = delete_sop_by_id(request.sop_id)
    if deleted:
        return JSONResponse(content={"message": f"SOP with sop_id '{request.sop_id}' deleted successfully."}, status_code=200)
    else:
        raise HTTPException(status_code=404, detail=f"No SOP found with the sop_id '{request.sop_id}'.")

@app.post("/parse_sop", summary="Parse raw SOP text and match steps to scripts using vector search")
def parse_sop_endpoint(request: SOPParseRequest):
    """
    Implements a two-step RAG approach for parsing and matching SOPs.
    Step A: An LLM parses the raw text into a structured format (without script IDs).
    Step B: Each parsed step's description is used to perform a vector search
            against a collection of available scripts to find the best match.
    """
    try:
        print("--- Starting Two-Step SOP Parsing Workflow ---")
        # Step A: Parse the raw text to get a structured SOP with descriptions only.
        structured_sop = get_structured_sop_from_llm(request.document_text)
        
        final_steps = []
        
        # Step B: For each step, perform a vector search to find the best script match.
        print("🔍  Starting Step B: Matching parsed steps to scripts via vector search...")
        for i, step in enumerate(structured_sop.get("steps", [])):
            description = step.get("description")
            if not description:
                continue

            print(f"--- Matching Step {i+1} ---")
            search_results = search_scripts_by_description(description, top_k=1)
            
            best_match = search_results[0] if search_results else None
            
            if best_match:
                # If a confident match is found, add the full script details to the step
                final_steps.append({
                    "description": description,
                    "script": best_match['name'],
                    "script_id": str(best_match['id'])
                })
            else:
                # If no match is found, mark it for manual selection in the UI
                final_steps.append({
                    "description": description,
                    "script": None,
                    "script_id": "Not Found"
                })
        
        # Construct the final response for the frontend
        final_sop = {
            "title": structured_sop.get("title", ""),
            "issue": structured_sop.get("issue", ""),
            "steps": final_steps
        }
        
        print("✅  Successfully completed two-step SOP parsing.")
        return JSONResponse(content=final_sop, status_code=200)

    except HTTPException:
        raise
    except Exception as e:
        print(f"🔥  Error during SOP parsing workflow: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred during AI parsing: {str(e)}")


@app.delete("/scripts/delete/{script_id}")
def delete_script(script_id: int = Path(..., ge=1)):
    """
    Deletes a script from the database and triggers a sync with the Qdrant search index.
    """
    try:
        print(f"🗑️ Deleting script with ID: {script_id}")
        deleted_rows = delete_script_from_db(script_id)
        if deleted_rows == 0:
            raise HTTPException(status_code=404, detail=f"Script with ID {script_id} not found.")
        
        print("🔄 Triggering Qdrant sync after delete...")
        sync_scripts_to_qdrant()
        
        return JSONResponse(content={"message": f"Script with ID {script_id} deleted successfully."}, status_code=200)
    except Exception as e:
        # Catch any other potential database errors
        raise HTTPException(status_code=500, detail=f"Failed to delete script: {str(e)}")
    
@app.post("/scripts/match", summary="Find the best script match for a single description")
def match_script_endpoint(request: MatchScriptRequest):
    """
    Takes a single step description and performs a vector search to find the best script match.
    This is used for re-matching a step after a user edits the description.
    """
    try:
        print(f"⚡️ Received request to match description: \"{request.description[:50]}...\"")
        search_results = search_scripts_by_description(request.description, top_k=1)
        
        best_match = search_results[0] if search_results else None
        
        if best_match:
            full_script_details = get_script_by_id(best_match['id'])
            if full_script_details:
                return JSONResponse(content={
                    "script_name": full_script_details['name'],
                    "script_id": str(full_script_details['id'])
                }, status_code=200)

        # If no match or details found, return a null response
        return JSONResponse(content={
            "script_name": None,
            "script_id": "Not Found"
        }, status_code=200)

    except Exception as e:
        print(f"🔥  Error during single script matching: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during script matching.")    

