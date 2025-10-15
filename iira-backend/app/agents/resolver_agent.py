import logging
from typing import Dict, List
from app.agents.tools import find_sop_tool, generate_plan_tool, extract_parameters_tool
from app.agents.execution_agent import ExecutionAgent
from app.services.scripts import get_scripts_from_db, update_incident_history

logger = logging.getLogger(__name__)

class ResolverAgent:
    """
    The main agent responsible for orchestrating incident resolution.
    It uses tools to find knowledge, create plans, and delegates execution.
    """
    def __init__(self):
        self.execution_agent = ExecutionAgent()
        self.available_scripts = get_scripts_from_db()

    def _transform_trace_for_frontend(self, trace: List[Dict]) -> List[Dict]:
        """
        Transforms the agent's internal execution trace into the legacy 
        'resolved_scripts' format that the frontend component expects.
        """
        frontend_trace = []
        for trace_item in trace:
            script_name = None
            action = trace_item.get("action", "")
            if "Execute script: " in action:
                script_name = action.replace("Execute script: ", "")

            script_details = next((s for s in self.available_scripts if s['name'] == script_name), {})

            frontend_item = {
                "step_description": trace_item.get("description"),
                "script_name": script_name,
                "script_id": script_details.get("id"),
                "parameters": script_details.get("params", []),
                "extracted_parameters": trace_item.get("parameters", {}),
                "status": trace_item.get("status"),
                "output": trace_item.get("output"),
            }
            frontend_trace.append(frontend_item)
        return frontend_trace

    def run(self, incident_data: Dict) -> Dict:
        """
        Runs the full "Think-Act-Observe" loop to resolve an incident.
        """
        incident_number = incident_data.get("number")
        logger.info(f"AGENT: ResolverAgent starting run for incident: {incident_number}")
        
        execution_trace = []
        accumulated_context = incident_data.copy()
        plan = {}
        
        try:
            rag_query = f"{incident_data['short_description']} {incident_data['description']}"
            sops = find_sop_tool(rag_query)
            if not sops:
                logger.warning(f"AGENT: No SOPs found for {incident_number}.")
                frontend_trace = self._transform_trace_for_frontend(execution_trace)
                return {"status": "SOP not found", "trace": execution_trace, "frontend_trace": frontend_trace, "plan": plan}

            plan = generate_plan_tool(rag_query, sops)
            if not plan or not plan.get("steps"):
                logger.error(f"AGENT: Failed to generate a valid plan for {incident_number}.")
                frontend_trace = self._transform_trace_for_frontend(execution_trace)
                return {"status": "Error", "trace": execution_trace, "frontend_trace": frontend_trace, "plan": plan}
            
            logger.info(f"TOOL: Generated plan for {incident_number}:\n {plan}")
            frontend_trace = self._transform_trace_for_frontend(execution_trace)
            update_incident_history(incident_number, plan, frontend_trace)
            logger.info(f"AGENT: Updated history for {incident_number} with the initial plan.")

            for i, step in enumerate(plan.get("steps", [])):
                script_name = step.get("tool")
                step_description = step.get("description")
                
                if not script_name:
                    execution_trace.append({"step": i + 1, "description": step_description, "action": "Manual step, no script.", "status": "skipped"})
                    frontend_trace = self._transform_trace_for_frontend(execution_trace)
                    update_incident_history(incident_number, plan, frontend_trace)
                    continue

                logger.info(f"AGENT: Processing step {i+1}: {step_description}")
                script_details = next((s for s in self.available_scripts if s['name'] == script_name), None)

                if not script_details:
                    error_msg = f"Script '{script_name}' planned but not found in available scripts."
                    logger.error(f"AGENT: {error_msg}")
                    execution_trace.append({"step": i + 1, "description": step_description, "action": f"Execute script: {script_name}", "status": "error", "output": error_msg})
                    frontend_trace = self._transform_trace_for_frontend(execution_trace)
                    update_incident_history(incident_number, plan, frontend_trace)
                    return {"status": "Error", "trace": execution_trace, "frontend_trace": frontend_trace, "plan": plan}
                
                # --- INTELLIGENCE UPGRADE: Dynamically determine the tool to use ---
                tool_to_use = script_details.get("script_type")
                if not tool_to_use:
                    error_msg = f"Script '{script_name}' is missing a 'script_type' and cannot be executed."
                    logger.error(f"AGENT: {error_msg}")
                    execution_trace.append({"step": i + 1, "description": step_description, "action": f"Execute script: {script_name}", "status": "error", "output": error_msg})
                    frontend_trace = self._transform_trace_for_frontend(execution_trace)
                    update_incident_history(incident_number, plan, frontend_trace)
                    return {"status": "Error", "trace": execution_trace, "frontend_trace": frontend_trace, "plan": plan}
                # --- END UPGRADE ---

                parameters = {}
                if script_details.get("params"):
                    parameters = extract_parameters_tool(accumulated_context, script_details["params"])
                    
                    missing_params = [p['param_name'] for p in script_details['params'] if p['required'] and not parameters.get(p['param_name']) and not p.get('default_value')]
                    if missing_params:
                        error_msg = f"Failed to extract required parameters: {', '.join(missing_params)}."
                        logger.error(f"AGENT: {error_msg}")
                        execution_trace.append({"step": i + 1, "description": step_description, "action": f"Execute script: {script_name}", "status": "error", "output": error_msg, "parameters": parameters})
                        frontend_trace = self._transform_trace_for_frontend(execution_trace)
                        update_incident_history(incident_number, plan, frontend_trace)
                        return {"status": "Error", "trace": execution_trace, "frontend_trace": frontend_trace, "plan": plan}

                logger.info(f"AGENT: Delegating execution of '{script_name}' via tool '{tool_to_use}' to ExecutionAgent.")
                
                # --- INTELLIGENCE UPGRADE: Pass the dynamic tool_name to the agent ---
                execution_result = self.execution_agent.run(
                    tool_name=tool_to_use, 
                    script_name=script_name, 
                    parameters=parameters
                )
                # --- END UPGRADE ---

                execution_trace.append({
                    "step": i + 1, "description": step_description, "action": f"Execute script: {script_name}",
                    "parameters": parameters, "status": execution_result["status"], "output": execution_result["output"]
                })
                
                frontend_trace = self._transform_trace_for_frontend(execution_trace)
                update_incident_history(incident_number, plan, frontend_trace)
                logger.info(f"AGENT: Updated history for {incident_number} after step {i+1}.")

                if execution_result["status"] == "error":
                    logger.error(f"AGENT: Execution of '{script_name}' failed. Halting resolution.")
                    return {"status": "Error", "trace": execution_trace, "frontend_trace": frontend_trace, "plan": plan}
                
                accumulated_context[f"{script_name}_output"] = execution_result["output"]
            
            logger.info(f"AGENT: Successfully completed all steps for incident {incident_number}.")
            frontend_trace = self._transform_trace_for_frontend(execution_trace)
            return {"status": "Resolved", "trace": execution_trace, "frontend_trace": frontend_trace, "plan": plan}

        except Exception as e:
            logger.exception(f"AGENT: An unexpected error occurred during resolution for {incident_number}")
            frontend_trace = self._transform_trace_for_frontend(execution_trace)
            return {"status": "Error", "trace": execution_trace, "frontend_trace": frontend_trace, "plan": plan, "error": str(e)}

