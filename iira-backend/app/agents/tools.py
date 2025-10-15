#app/agents/tools.py
import subprocess
import tempfile
import os
import json
import logging
from typing import List, Dict, Any

from app.services.search_sop import search_sop_by_query
from app.services.llm_client import get_llm_plan, extract_parameters_with_llm
from app.services.scripts import get_script_by_name

logger = logging.getLogger(__name__)

# --- Tool 1: Find Relevant SOPs ---
def find_sop_tool(query: str) -> List[Dict]:
    """Finds relevant Standard Operating Procedures for a given query."""
    logger.info(f"TOOL: Executing find_sop_tool with query: '{query[:50]}...'")
    return search_sop_by_query(query)

# --- Tool 2: Generate a Resolution Plan ---
def generate_plan_tool(query: str, context: List[Dict]) -> Dict:
    """Generates a step-by-step resolution plan using an LLM."""
    logger.info("TOOL: Executing generate_plan_tool...")
    return get_llm_plan(query, context)

# --- Tool 3: Extract Parameters for a Script ---
def extract_parameters_tool(incident_data: Dict, script_params: List[Dict]) -> Dict:
    """Extracts parameters for a script from incident data using an LLM."""
    logger.info("TOOL: Executing extract_parameters_tool...")
    return extract_parameters_with_llm(incident_data, script_params)

# --- Tool 4: Execute a Shell Script ---
def execute_shell_script_tool(script_name: str, parameters: Dict[str, Any]) -> Dict:
    """
    A tool that executes a given shell script with specified parameters.
    """
    logger.info(f"TOOL: Executing shell_script_tool for '{script_name}'")
    
    script_details = get_script_by_name(script_name)
    if not script_details:
        return {"status": "error", "output": f"Script '{script_name}' not found."}

    script_content = script_details.get('content')
    if not script_content:
        return {"status": "error", "output": f"Script content for '{script_name}' is empty."}

    temp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.sh', dir='/tmp') as temp_file:
            temp_file_path = temp_file.name
            temp_file.write(script_content)
        
        os.chmod(temp_file_path, 0o755)

        command = [temp_file_path]
        for param in script_details.get('params', []):
            param_name = param['param_name']
            # Use default value if parameter not provided
            param_value = parameters.get(param_name, param.get('default_value'))
            if param_value is not None:
                command.append(str(param_value))

        logger.info(f"TOOL: Running command: {' '.join(command)}")
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        
        if result.returncode == 0:
            output = result.stdout.strip() or "Script executed successfully with no output."
            logger.info(f"TOOL: Script '{script_name}' executed successfully.")
            return {"status": "success", "output": output}
        else:
            error_output = (result.stdout.strip() + "\n" + result.stderr.strip()).strip()
            logger.error(f"TOOL: Script '{script_name}' failed. Output:\n{error_output}")
            return {"status": "error", "output": error_output}

    except Exception as e:
        logger.exception("TOOL: An unhandled exception occurred during script execution")
        return {"status": "error", "output": f"An unexpected error occurred: {str(e)}"}
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

# --- Future Scalability Example ---
# def execute_python_script_tool(script_name: str, parameters: Dict[str, Any]) -> Dict:
#     """
#     A tool that would execute a given python script.
#     """
#     # ... logic to execute a python script ...
#     logger.info(f"TOOL: Executing python_script for '{script_name}'")
#     return {"status": "success", "output": "Python script finished."}