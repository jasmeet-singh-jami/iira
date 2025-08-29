# iira/app/main.py

from fastapi import FastAPI, Path, Query, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.services.embed_documents import embed_and_store_sops
from app.services.script_resolver import resolve_scripts
from app.services.search_sop import search_sop_by_query

from app.services.scripts import get_scripts_from_db, add_script_to_db, get_script_by_name, add_incident_history_to_db
from app.services.history import get_incident_history_from_db
from app.services.llm_client import get_llm_plan, extract_parameters_with_llm, DEFAULT_MODELS

from pydantic import BaseModel
from typing import List, Dict, Optional, Any

import time
import random


app = FastAPI()

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

# MOCK ServiceNow incident data
MOCK_INCIDENTS = {
    "INC001": {
        "number": "INC001",
        "short_description": "Apache Server Not Responding",
        "description": "The web server running Apache is not responding to any HTTP requests. The service appears to be down and needs immediate attention. The host is `web-server-01.example.com`.",
        "assigned_to": "John Doe",
        "state": "In Progress",
        "host": "web-server-01.example.com",
    },
    "INC002": {
        "number": "INC002",
        "short_description": "DNS Resolution Failure",
        "description": "Users are reporting that they cannot access internal company resources by hostname. DNS resolution appears to be failing on the primary DNS server `dns-server-02.internal.com`.",
        "assigned_to": "Jane Smith",
        "state": "In Progress",
        "host": "dns-server-02.internal.com",
    },
    "INC003": {
        "number": "INC003",
        "short_description": "PostgreSQL Not Starting After System Reboot",
        "description": "The PostgreSQL service failed to start automatically after a system reboot of the database server. The host is `db-server-03.example.com`. Investigation into logs is required.",
        "assigned_to": "John Doe",
        "state": "New",
        "host": "db-server-03.example.com",
    },
}

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
        "model_used": model  # ✅ useful for debugging
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
    incident_data = MOCK_INCIDENTS.get(incident_number.upper())
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
def get_incident_history():
    """
    Retrieves all incident history from the database.
    """
    try:
        history = get_incident_history_from_db()
        return {"history": history}
    except Exception as e:
        print(f"Error fetching history: {e}")
        raise HTTPException(status_code=500, detail=str(e))