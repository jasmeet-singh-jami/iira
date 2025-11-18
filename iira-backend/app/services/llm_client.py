import json
import requests
import time
import re
import logging
from typing import List, Dict, Any
from app.config import settings
from fastapi import HTTPException

# Configure logger
logger = logging.getLogger(__name__)

# Default models to use for different tasks
DEFAULT_MODELS = {
    "plan": "llama3.1:8b",
    "param_extraction": "llama3.1:8b",
    "sop_parser": "llama3.1:8b"
}

# Default models (can be overridden by environment variables)
API_URL = settings.ollama_api_url
MODEL_PLAN = settings.model_plan
MODEL_PARAMS = settings.model_params
MODEL_SOP_PARSER = settings.model_sop_parser
MODEL_SOP_GENERATOR = settings.model_sop_parser

# -------------------------------------------------------------------
# CORE UTILITIES
# -------------------------------------------------------------------

def call_ollama(prompt: str, model: str) -> str:
    """
    Send a prompt to Ollama and return the raw response text.
    Includes simple retry with exponential backoff.
    """
    payload = {"model": model, "prompt": prompt, "stream": False}

    retries = 0
    max_retries = 5
    while retries < max_retries:
        try:
            response = requests.post(
                API_URL,
                headers={"Content-Type": "application/json"},
                data=json.dumps(payload),
                timeout=360
            )
            response.raise_for_status()
            response_json = response.json()
            return response_json.get("response", "")
        except requests.exceptions.RequestException as e:
            retries += 1
            if retries < max_retries:
                delay = 2 ** retries
                logger.warning(f"[Ollama] Retry {retries}/{max_retries} in {delay}s due to error: {e}")
                time.sleep(delay)
            else:
                logger.error(f"[Ollama] Failed after {max_retries} retries: {e}")
                return ""
    return ""

def extract_json_from_text(text: str) -> Dict:
    """Strictly extracts the first valid JSON object from the text."""
    try:
        start = text.index("{")
        end = text.rindex("}")
        json_str = text[start:end+1]
        return json.loads(json_str)
    except Exception as e:
        # Raise to allow auto-repair to handle it
        raise e

def auto_repair_json(text: str) -> Dict:
    """Attempts to repair common JSON errors from LLMs."""
    logger.info("Attempting JSON auto-repair...")
    try:
        start = text.find("{")
        end = text.rindex("}")
        if start == -1 or end == -1:
            raise ValueError("No JSON object found.")
        
        candidate = text[start:end + 1]
        # Remove non-ASCII chars
        candidate = re.sub(r"[^\x00-\x7F]+", "", candidate)
        # Remove trailing commas (common LLM error)
        candidate = re.sub(r",\s*([\]}])", r"\1", candidate)
        # Remove comments
        candidate = re.sub(r"//.*?\n", "", candidate)
        
        return json.loads(candidate)
    except Exception as e:
        logger.error(f"Auto-repair failed. JSON candidate was:\n{text}")
        raise e

def extract_json(response: str) -> str:
    """Legacy helper: Extract first JSON object string."""
    match = re.search(r"\{.*\}", response, re.DOTALL)
    if match:
        return match.group(0)
    raise ValueError("No JSON object found in response.")

# -------------------------------------------------------------------
# SOP PARSING LOGIC (FEW-SHOT)
# -------------------------------------------------------------------

FEW_SHOT_EXAMPLES = """
### FEW-SHOT EXAMPLE 1
Input SOP:
Title: Restart Apache Web Server
Steps:
1. Check if Apache service is running.
2. If it is not running, start the service.
3. Verify the service status again.
4. If verification fails, escalate to L2.

Output JSON:
{
  "title": "Restart Apache Web Server",
  "issue": "Resolves cases where Apache service stops responding.",
  "nodes": [
    { "id": "1", "type": "start", "title": "Start", "description": "", "x": 400, "y": 50 },
    { "id": "2", "type": "action", "title": "Check Apache", "description": "Check if Apache service is running", "x": 400, "y": 180 },
    { "id": "3", "type": "condition", "title": "Is Apache running?", "description": "Determine if service is active", "x": 400, "y": 310 },
    { "id": "4", "type": "action", "title": "Start Apache", "description": "Start the Apache service", "x": 250, "y": 440 },
    { "id": "5", "type": "action", "title": "Verify status", "description": "Verify the service status again", "x": 550, "y": 440 },
    { "id": "6", "type": "condition", "title": "Verification OK?", "description": "Did verification succeed?", "x": 550, "y": 570 },
    { "id": "7", "type": "action", "title": "Escalate", "description": "Escalate to L2", "x": 700, "y": 700 },
    { "id": "8", "type": "end", "title": "End", "description": "", "x": 400, "y": 830 }
  ],
  "connections": [
    { "from": "1", "to": "2" },
    { "from": "2", "to": "3" },
    { "from": "3", "to": "4", "label": "No" },
    { "from": "3", "to": "8", "label": "Yes" },
    { "from": "4", "to": "5" },
    { "from": "5", "to": "6" },
    { "from": "6", "to": "8", "label": "Yes" },
    { "from": "6", "to": "7", "label": "No" },
    { "from": "7", "to": "8" }
  ]
}

### FEW-SHOT EXAMPLE 2
Input SOP:
Title: Database Connectivity Troubleshooting
Steps:
1. Check if DB host is reachable.
2. If reachable, check if credentials are valid.
3. If credentials invalid, reset password.
4. If reachable and credentials valid, run connectivity test.
5. If connectivity test fails, restart DB service.

Output JSON:
{
  "title": "Database Connectivity Troubleshooting",
  "issue": "Fixes common database connection failures.",
  "nodes": [
    { "id": "1", "type": "start", "title": "Start", "description": "", "x": 400, "y": 50 },
    { "id": "2", "type": "action", "title": "Check Host Reachable", "description": "Verify DB host ping/reachability", "x": 400, "y": 180 },
    { "id": "3", "type": "condition", "title": "Host reachable?", "description": "Is the DB host reachable?", "x": 400, "y": 310 },
    { "id": "4", "type": "action", "title": "Check Credentials", "description": "Verify DB username/password", "x": 250, "y": 440 },
    { "id": "5", "type": "condition", "title": "Credentials valid?", "description": "Are credentials correct?", "x": 250, "y": 570 },
    { "id": "6", "type": "action", "title": "Reset Password", "description": "Reset DB credentials", "x": 100, "y": 700 },
    { "id": "7", "type": "action", "title": "Run Connectivity Test", "description": "Verify DB connectivity", "x": 550, "y": 440 },
    { "id": "8", "type": "condition", "title": "Test OK?", "description": "Did test pass?", "x": 550, "y": 570 },
    { "id": "9", "type": "action", "title": "Restart DB Service", "description": "Restart DB system service", "x": 700, "y": 700 },
    { "id": "10", "type": "end", "title": "End", "description": "", "x": 400, "y": 830 }
  ],
  "connections": [
    { "from": "1", "to": "2" },
    { "from": "2", "to": "3" },
    { "from": "3", "to": "4", "label": "Yes" },
    { "from": "3", "to": "10", "label": "No" },
    { "from": "4", "to": "5" },
    { "from": "5", "to": "6", "label": "No" },
    { "from": "5", "to": "7", "label": "Yes" },
    { "from": "6", "to": "10" },
    { "from": "7", "to": "8" },
    { "from": "8", "to": "10", "label": "Yes" },
    { "from": "8", "to": "9", "label": "No" },
    { "from": "9", "to": "10" }
  ]
}
"""

def build_optimized_prompt(document_text: str) -> str:
    return f"""
You are a specialized SOP-to-Workflow parser. Convert the SOP document into a fully structured JSON workflow.

### OUTPUT RULES
- Return ONLY a valid JSON object.
- No markdown, no commentary, no explanation.
- Must follow the exact schema.

### JSON TEMPLATE
{{
  "title": "",
  "issue": "",
  "nodes": [],
  "connections": []
}}

### EXTRACTION LOGIC
- Convert sequential steps → "action" nodes
- Convert decision/if/else/verify/check → "condition" nodes
- Exactly two branches per condition: "Yes" and "No"
- All paths must eventually reach an "end" node

### POSITIONING RULES
- Start node at (400, 50)
- Increase Y by 130–150 per level
- Left branch = x - 150
- Right branch = x + 150

### FEW-SHOT EXAMPLES
{FEW_SHOT_EXAMPLES}

### SOP DOCUMENT
{document_text}
""".strip()

def get_structured_sop_from_llm(document_text: str) -> Dict:
    """
    Parses raw SOP text into a structured JSON workflow for the frontend.
    Uses Few-Shot prompting + Auto-Repair for maximum reliability.
    """
    logger.info("Parsing SOP using Optimized Few-Shot Pipeline...")
    
    prompt = build_optimized_prompt(document_text)

    try:
        response_text = call_ollama(prompt, model=MODEL_SOP_PARSER)
        if not response_text:
            raise ValueError("Received empty response from Ollama")

        logger.info(f"Raw LLM Response:\n{response_text}")

        # Try strict extraction first, then fallback to repair
        try:
            response_json = extract_json_from_text(response_text)
        except Exception:
            logger.warning("Strict JSON parsing failed. Attempting auto-repair...")
            response_json = auto_repair_json(response_text)
        
        logger.info(f"Parsed JSON: {json.dumps(response_json, indent=2)}")

        # Add basic validation
        if not response_json or not all(key in response_json for key in ['title', 'nodes', 'connections']):
           logger.warning(f"Invalid workflow structure: {response_json}")
           raise ValueError("Invalid workflow structure: Missing title, nodes, or connections")
           
        return response_json

    except Exception as e:
        logger.exception(f"Error in get_structured_sop_from_llm: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------------------------
#  OTHER FUNCTIONS (Standard App Logic)
# -------------------------------------------------------------------

def get_llm_plan(query: str, context: List[Dict], model: str = MODEL_PLAN) -> Dict:
    """Generates a structured step-by-step plan."""
    context_string = ""
    for i, sop in enumerate(context):
        title = sop.get('title', 'N/A')
        issue = sop.get('issue', 'N/A')
        steps = sop.get('steps', [])
        step_list = "\n".join([f"- {step.get('description', 'N/A')} (Tool: {step.get('script', 'N/A')})"
                                for step in steps])
        context_string += f"Context Document {i+1}:\nTitle: {title}\nIssue: {issue}\nSteps:\n{step_list}\n\n"

    prompt = f"""
    You are an AI assistant acting as an Incident Resolution Manager.
    Task: Convert a query + SOP context into a JSON plan.
    Query: "{query}"
    Context:
    {context_string}
    Response MUST be valid JSON: {{ "steps": [ {{"description": "string", "tool": "string"}} ] }}
    """
    response_text = call_ollama(prompt, model=model)
    try:
        return extract_json_from_text(response_text) or {"steps": []}
    except Exception:
        return auto_repair_json(response_text) or {"steps": []}

def extract_parameters_with_llm(incident_data: Dict, script_params: List[Dict], model: str = MODEL_PARAMS) -> Dict:
    params_to_find = [
        f"- param_name: '{p.get('param_name')}', type: '{p.get('param_type')}', required: {p.get('required')}"
        for p in script_params if isinstance(p, dict)
    ]
    params_to_find_str = "\n".join(params_to_find)

    prompt = f"""
    Extract script parameters from incident data into JSON.
    Incident Data: {json.dumps(incident_data, indent=2)}
    Parameters to Extract: {params_to_find_str}
    Output Format: {{ "param_name": value }}
    """
    response_text = call_ollama(prompt, model=model)
    try:
        return extract_json_from_text(response_text) or {}
    except Exception:
        return auto_repair_json(response_text) or {}

def generate_hypothetical_sop(query: str, model: str = MODEL_SOP_PARSER) -> str:
    """
    Uses an LLM to generate a hypothetical SOP document based on an incident query.
    """
    prompt = f"""
    You are an expert Site Reliability Engineer. Based on the following incident description, write a concise, one-paragraph summary of an ideal Standard Operating Procedure (SOP) that would help in debugging and finally to resolve this issue.
    Focus on the general problem type and the key steps required for debugging as well as resolution. Do not invent specific script names or parameters.

    Incident Description: "{query}"

    Hypothetical SOP Summary:
    """
    logger.info("📝 Generating hypothetical document for query: \"%s\"", query)
    hypothetical_doc = call_ollama(prompt, model=model)
    logger.info("✅ Generated Document:\n---\n%s\n---", hypothetical_doc)
    return hypothetical_doc

def generate_detailed_sop_from_llm(problem_description: str) -> Dict:
    """
    Uses an LLM to generate a complete, detailed, and script-agnostic SOP from a
    high-level problem description.
    """
    prompt = f"""
    You are an expert Site Reliability Engineer tasked with authoring a new, comprehensive Standard Operating Procedure (SOP).
    Based on the user's problem description, you will generate a complete, structured SOP in a single JSON object.

    Your task:
    1.  **Analyze the Problem:** Deeply understand the core issue, potential causes, and impacts from the "Problem Description".
    2.  **Create a Title:** Write a clear, concise `title` for the new SOP.
    3.  **Write an Issue Description:** Create a detailed `issue` description that explains the problem, its impact, and the goal of this SOP.
    4.  **Generate Detailed Steps:** Formulate a logical, step-by-step resolution plan. The steps should be thorough enough for a junior engineer to follow. Include:
        - Initial diagnostic commands (e.g., how to check disk space, what logs to look at).
        - Common remediation actions (e.g., how to find and delete large files, how to restart a service).
        - Verification steps to confirm the issue is resolved.
        - **IMPORTANT**: Do NOT invent script names or refer to script IDs. Focus only on the manual commands and actions a human would perform.

    Rules:
    - Your entire response must be a single, valid JSON object with no other text or explanations.
    - The final JSON structure must be exactly:
    {{
        "title": "string",
        "issue": "string",
        "steps": [
            {{
                "description": "string"
            }}
        ]
    }}

    Problem Description:
    "{problem_description}"

    JSON Output:
    """
    
    logger.info("📝 Calling LLM to GENERATE new detailed SOP using model: %s", MODEL_SOP_GENERATOR)

    response_text = call_ollama(prompt, model=MODEL_SOP_GENERATOR)
    logger.debug("LLM Response (SOP Generation): %s", response_text)
    
    try:
        parsed_json = extract_json_from_text(response_text)
    except Exception:
        parsed_json = auto_repair_json(response_text)

    if not parsed_json or "steps" not in parsed_json:
        raise ValueError("Invalid or incomplete JSON response from LLM during SOP generation.")
    
    logger.info("✅ Successfully generated a detailed, script-agnostic SOP.")
    return parsed_json

def get_clarifying_questions_from_llm(problem_description: str) -> Dict:
    """
    Analyzes an initial problem description and generates clarifying questions if it's too vague
    for creating a generalized SOP.
    """
    prompt = f"""
    You are an expert Senior Site Reliability Engineer whose job is to turn an initial incident/problem description into a reusable, generalized Standard Operating Procedure (SOP).

    INSTRUCTIONS:
    1. Read the provided "Problem Description" carefully and extract every explicit fact from it.
    2. Produce ONLY one JSON object (no surrounding text) with a single key "questions" whose value is an array of strings:
    {{
        "questions": [ "question1", "question2", ... ]
    }}
    If no clarifying questions are needed to create a general SOP, output exactly:
    {{"questions": []}}

    3. Do NOT ask about any fact that is explicitly stated in the Problem Description. If a fact is present but incomplete/ambiguous, ask **one** concise confirmatory question that references the ambiguous fact.

    4. Ask at most 12 questions, ordered by priority (highest first). Each question should be concise (ideally <140 characters) and actionable — answers should directly feed into an SOP template (placeholders, paths, commands, checks, rollback actions, verification).

    5. Prefer questions that produce answers useful for templates, e.g.:
    - service category/type (web server, database, cache, message broker)
    - OS/distribution and version
    - environment (production/staging/dev)
    - hostnames or naming patterns and preferred placeholder names (e.g., TARGET_HOST)
    - log file paths and example log lines
    - key config file paths and sample config keys to check
    - monitoring/alert conditions and typical alert text
    - commands to check health and expected outputs
    - dependencies (databases, storage, load balancers)
    - required permissions/credentials/tools to run checks/repairs
    - expected normal behaviour and how to verify recovery
    - safe rollback or mitigation steps and business impact

    6. Prefer open-but-specific questions (not pure yes/no) unless a yes/no is necessary to choose a remediation path. When asking for placeholder names, suggest an example in parentheses (e.g., "What placeholder should we use for hostname (e.g., TARGET_HOST)?").

    7. If the description mentions a specific error message or log excerpt, ask for a minimal example of that log line or error code to include in the SOP.

    8. Output only JSON, no markdown, no commentary, no extra fields. Each array element must be the question text only (you may include a very short parenthetical hint).

    Problem Description:
    "{problem_description}"

    JSON Output:
    """
    
    logger.info("📝 Calling LLM to analyze problem and generate clarifying questions...")
    response_text = call_ollama(prompt, model=MODEL_SOP_GENERATOR)
    
    try:
        parsed_json = extract_json_from_text(response_text)
    except Exception:
        parsed_json = auto_repair_json(response_text)

    if "questions" not in parsed_json:
        return {"questions": []} 
        
    logger.info(f"✅ LLM analysis complete. Found {len(parsed_json['questions'])} questions.")
    return parsed_json

def generate_script_from_context_llm(sop_context: Dict, model: str = settings.model_sop_parser) -> Dict:
    """
    Generates a complete, structured worker task object from the context of an Agent (SOP) draft.
    """
    title = sop_context.get("title", "N/A")
    target_step = sop_context.get("target_step_description", "N/A")
    
    prompt = f"""
    You are **"DevOps Architect X"**, a world-class DevOps engineer.
    Your Task: Generate **only a single valid JSON object** that defines a complete worker task (shell script) designed to automate the **"Target Step"** below.

    **Agent (SOP) Title:** {title}
    **Target Step to Automate:** "{target_step}"

    **Output Format (MANDATORY):**
    ```json
    {{
      "name": "string (Human-readable action, e.g., 'Check Disk Space')",
      "description": "string (One-sentence summary)",
      "content": "string (Full #!/bin/bash script, single line, newlines as \\n)",
      "params": [
        {{
          "param_name": "string (UPPERCASE, e.g., 'SERVICE_NAME')",
          "param_type": "string (string | integer | boolean)",
          "required": "boolean",
          "default_value": "string | integer | boolean | null"
        }}
      ]
    }}
    ```
    """

    logger.info("🤖 Calling LLM to generate a new worker task from Agent context...")
    response_text = call_ollama(prompt, model=model) 
    logger.debug("LLM Response (Worker Task Generation from Context): %s", response_text)

    try:
        parsed_json = extract_json_from_text(response_text)
    except Exception:
        parsed_json = auto_repair_json(response_text)

    # Validate the structure
    if not isinstance(parsed_json, dict) or not all(k in parsed_json for k in ["name", "description", "content", "params"]):
        logger.error(f"Invalid JSON structure received from LLM for context-based task generation. Response: {response_text}")
        raise ValueError("Invalid or incomplete JSON response from LLM: Missing required keys or not a dict.")
    if not isinstance(parsed_json.get("params"), list):
        logger.error(f"Invalid 'params' field in LLM response (not a list). Response: {response_text}")
        raise ValueError("Invalid response from LLM: 'params' field must be a list.")

    for param in parsed_json.get("params", []):
         if not isinstance(param, dict) or not all(k in param for k in ["param_name", "param_type", "required"]):
               logger.error(f"Invalid parameter structure within 'params' list. Param: {param}. Response: {response_text}")
               raise ValueError("Invalid response from LLM: Malformed item in 'params' list.")

    logger.info(f"✅ Successfully generated worker task draft: '{parsed_json.get('name')}'")
    return parsed_json

def generate_script_from_description_llm(description: str) -> Dict:
    """
    Generates a complete, structured worker task object from a single description string.
    """
    prompt = f"""
    You are an expert DevOps engineer and a master scriptwriter. Your task is to author a complete, production-ready shell script based *only* on the user's description of what the script should do.

    Your output MUST be a single, valid JSON object with no other text or explanations.

    **User's Worker Task Description:**
    "{description}"

    **Instructions:**
    Based on the description above, generate a JSON object with the following structure:
    {{
      "name": "string (a descriptive, human-readable name for the task, e.g., 'Check Disk Space')",
      "description": "string (this should be the same as the user's provided description)",
      "content": "string (the full #!/bin/bash script content, formatted as a SINGLE-LINE JSON string with all newlines properly escaped as \\n)",
      "params": [
        {{
          "param_name": "string (e.g., 'HOSTNAME')",
          "param_type": "string (e.g., 'string', 'integer', 'boolean')",
          "required": "boolean (true if the script cannot run without this parameter)",
          "default_value": "string | null (optional default value)"
        }}
      ]
    }}

    **Naming Rule:**
    - The "name" should be human-readable and describe the action (e.g., "Restart Web Server", "Check Database Connection"). Do NOT include file extensions like '.sh'.

    **Parameter Rules:**
    - Identify any variables *implied* or *likely needed* based on the description that would need to be passed as arguments to the script. These are your parameters.
    - Use clear, uppercase parameter names (e.g., 'TARGET_DIRECTORY', 'SERVICE_NAME').
    - If no parameters seem necessary based on the description, provide an empty array: "params": []
    - Add a `default_value` only if it makes obvious sense (e.g., a default path or flag). Otherwise, omit it or set to null.

    **Final JSON Output:**
    """

    logger.info("🤖 Calling LLM to generate a new worker task from a simple description...")
    response_text = call_ollama(prompt, model=settings.model_sop_parser)
    logger.debug("LLM Response (Simple Worker Task Generation): %s", response_text)

    try:
        parsed_json = extract_json_from_text(response_text)
    except Exception:
        parsed_json = auto_repair_json(response_text)

    # Validate the structure
    if not isinstance(parsed_json, dict) or not all(k in parsed_json for k in ["name", "description", "content", "params"]):
        logger.error(f"Invalid JSON structure received from LLM for simple script generation. Response: {response_text}")
        raise ValueError("Invalid or incomplete JSON response from LLM: Missing required keys or not a dict.")
    if not isinstance(parsed_json.get("params"), list):
         logger.error(f"Invalid 'params' field in LLM response (not a list). Response: {response_text}")
         raise ValueError("Invalid response from LLM: 'params' field must be a list.")

    logger.info(f"✅ Successfully generated worker task draft: '{parsed_json.get('name')}'")
    return parsed_json