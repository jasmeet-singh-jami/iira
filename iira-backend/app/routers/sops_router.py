import logging
from fastapi import APIRouter, Query, HTTPException, Body
from fastapi.responses import JSONResponse
from app.schemas import IngestRequest, SOPDeleteByIDRequest, SOPParseRequest, GenerateSOPRequest, AgentRecommendationRequest
from app.services.search_sop import search_sop_by_query
from app.services.embed_documents import embed_and_store_sops, get_all_sops, delete_sop_by_id, search_scripts_by_description
from app.services.llm_client import get_llm_plan, DEFAULT_MODELS, get_clarifying_questions_from_llm, generate_detailed_sop_from_llm
from app.services.scripts import get_scripts_from_db
from app.services.activity_log_service import add_activity_log
from app.services.incidents import fetch_incident_by_number
from app.services.settings_service import load_search_thresholds

router = APIRouter(tags=["SOPs & Agents"])
logger = logging.getLogger(__name__)

@router.get("/search")
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

@router.post("/ingest")
def ingest_sop(request: IngestRequest):
    """
    Handles the ingestion of SOPs. Accepts graph-based 'nodes' and flattens them
    into 'steps' for vector embedding.
    """
    logger.info(f"📄 Executing ingest function for {len(request.sops)} SOP(s).")
    
    sop_dicts = []
    
    # Create a quick lookup map for script IDs to script names
    available_scripts = get_scripts_from_db()
    script_id_to_name_map = {str(script['id']): script['name'] for script in available_scripts}

    for sop in request.sops:
        sop_data = sop.model_dump()
        
        # --- NEW LOGIC: Convert Graph Nodes to Linear Steps for Embedding ---
        # If 'steps' is missing but 'nodes' exists, we extract the steps from the nodes.
        if not sop_data.get("steps") and sop_data.get("nodes"):
            extracted_steps = []
            nodes = sop_data.get("nodes", {})
            
            for node in nodes.values():
                # Only extract nodes that are actual steps (ignore start/decision/end for embedding)
                if node.get("type") == "step":
                    step_entry = {
                        "description": node.get("description"),
                        "script": node.get("script"),
                        "script_id": node.get("script_id")
                    }
                    extracted_steps.append(step_entry)
            
            sop_data["steps"] = extracted_steps
        # ---------------------------------------------------------------------

        # Enrich the steps with script names if missing (Existing Logic)
        for step in sop_data.get("steps", []):
            if step.get("script_id") and not step.get("script"):
                script_id = str(step["script_id"])
                script_name = script_id_to_name_map.get(script_id)
                if script_name:
                    step["script"] = script_name
                    logger.info(f"Enriched step: found name '{script_name}' for ID '{script_id}'")

        sop_dicts.append(sop_data)

    # Pass the processed dictionaries to the embedding service
    embed_and_store_sops(sop_dicts)
    
    for sop in request.sops:
        add_activity_log("CREATE_SOP", {"sop_title": sop.title})
        
    return {"message": "SOP(s) ingested successfully"}

@router.post("/parse_sop", summary="Parse raw SOP text and match steps to scripts using vector search")
def parse_sop_endpoint(request: SOPParseRequest):
    try:
        # 🔥 DIRECTLY RETURNING HARDCODED JSON RESPONSE
        hardcoded_response = {
    "title": "Apache Server Not Responding",
    "issue": "Users are unable to access websites hosted on Apache...",
    "start_node_id": "start",
    "nodes": {
        "start": {
            "type": "input",
            "next": "step-1"
        },
        "step-1": {
            "type": "step",
            "name": "Check Service Status",
            "description": "Check if Apache service is running. The name of the service can be obtained from the issue description.",
            "script": "Check Apache Service Status",
            "script_id": "1",
            "next": "decision-1"
        },
        "decision-1": {
            "type": "decision",
            "name": "Is Service Running?",
            "description": "Check if Apache service is running.",
            "condition": "Output of step-1 is 'Running'?",
            "paths": {
                "true": "step-3_confirm",   
                "false": "step-2_restart"
            }
        },
        "step-2_restart": {
            "type": "step",
            "name": "Restart Apache Service",
            "description": "Restart the Apache service. If a delay is not specified, the delay will be set to 5 seconds.",
            "script": "",
            "script_id": "Not Found",
            "next": "step-3_confirm"
        },
        "step-3_confirm": {
            "type": "step",
            "name": "Confirm Service Restart",
            "description": "Confirm that the Apache service has restarted successfully. The port number to verify can be obtained from the issue description or use the default port 80 if not specified.",
            "script": "Restart Apache Web Server",
            "script_id": "1",
            "next": "end"
        },
        "end": {
            "type": "output"
        }
    }
}

        return JSONResponse(content=hardcoded_response, status_code=200)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("🔥 Error during SOP parsing workflow")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

# @app.post("/parse_sop", summary="Parse raw SOP text and match steps to scripts using vector search")
# def parse_sop_endpoint(request: SOPParseRequest):
#     try:
#         logger.info("--- Starting Two-Step SOP Parsing Workflow ---")
#         structured_sop = get_structured_sop_from_llm(request.document_text)
        
#         final_steps = []
        
#         logger.info("🔍  Starting Step B: Matching parsed steps to scripts via vector search...")
#         for i, step in enumerate(structured_sop.get("steps", [])):
#             description = step.get("description")
#             if not description:
#                 continue

#             logger.info(f"--- Matching Step {i+1} ---")
#             search_results = search_scripts_by_description(description, top_k=1)
            
#             best_match = search_results[0] if search_results else None
            
#             final_steps.append({
#                 "description": description,
#                 "script": best_match['name'] if best_match else None,
#                 "script_id": str(best_match['id']) if best_match else "Not Found"
#             })
        
#         final_sop = {
#             "title": structured_sop.get("title", ""),
#             "issue": structured_sop.get("issue", ""),
#             "steps": final_steps
#         }
        
#         logger.info("✅  Successfully completed two-step SOP parsing.")
#         return JSONResponse(content=final_sop, status_code=200)

#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.exception("🔥  Error during SOP parsing workflow")
#         raise HTTPException(status_code=500, detail=f"An error occurred during AI parsing: {str(e)}")


   

@router.post("/generate_sop", summary="Generate a new SOP from a problem description using AI")
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
    
@router.get("/sops/all", summary="Get all existing SOPs")
def get_all_sops_endpoint():
    sops = get_all_sops()
    return JSONResponse(content=sops, status_code=200)
    
@router.post("/delete_sop", summary="Delete an SOP by ID")
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


@router.post("/agents/recommend", summary="Get top Agent recommendations for an incident")
async def get_agent_recommendations(request: AgentRecommendationRequest):
    """
     Performs vector search (with optional feedback re-ranking) to find
     the top 3 relevant Agents for a given incident description.
     For the Agent Trainer, thresholds are ignored during filtering.
     Returns recommendations along with the configured search thresholds for display.
    """
    incident_num = request.incident_number
    short_desc = request.short_description
    full_desc = request.description

    # --- NEW LOGIC: Fetch details if only incident number is provided ---
    if incident_num and not short_desc:
        logger.info(f"Incident number {incident_num} provided. Fetching details...")
        # fetch_incident_by_number is a synchronous function, no await needed
        incident_data = fetch_incident_by_number(incident_num.upper())
        
        if not incident_data:
            raise HTTPException(status_code=404, detail=f"Incident '{incident_num}' not found.")
        
        short_desc = incident_data.get("short_description")
        full_desc = incident_data.get("description")
        logger.info(f"Found incident. Short Desc: '{short_desc[:50]}...'")
    # --- END NEW LOGIC ---

    logger.info(f"Received recommendation request for: '{short_desc[:50]}...'")

    if not short_desc and not full_desc: # Check *after* attempting to fetch
         raise HTTPException(status_code=400, detail="Short description or description must be provided.")

    try:
        # --- MODIFICATION: Call async search with apply_threshold=False ---
        results = await search_sop_by_query(
            short_desc, # Pass short description
            full_desc,  # Pass full description
            top_k=3,
            apply_threshold=False # <<< Ensures results aren't filtered by score
        )

        # Get current thresholds to return to the UI for display
        thresholds = load_search_thresholds()

        logger.info(f"Returning {len(results)} recommendations (thresholds ignored).")

        return JSONResponse(content={
            "recommendations": results,
            "thresholds": thresholds # Send thresholds for UI display
        }, status_code=200)

    except Exception as e:
        logger.exception("🔥 Error during Agent recommendation search")
        raise HTTPException(status_code=500, detail=f"An error occurred during search: {str(e)}")
    
@router.get("/search/thresholds", summary="Get current search score thresholds")
def get_search_thresholds():
    """Returns the currently configured search thresholds."""
    try:
        thresholds = load_search_thresholds()
        return JSONResponse(content=thresholds, status_code=200)
    except Exception as e:
        logger.exception("🔥 Error fetching search thresholds")
        raise HTTPException(status_code=500, detail="Failed to load search thresholds.")    