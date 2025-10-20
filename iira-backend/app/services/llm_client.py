# iira/app/services/llm_client.py
import json
import requests
import time
import re
import logging
from typing import List, Dict, Any
from app.config import settings

# Configure logger
logger = logging.getLogger(__name__)

# Default models to use for different tasks
DEFAULT_MODELS = {
    "plan": "llama3:latest",
    "param_extraction": "llama3:latest",
    "sop_parser": "llama3:latest"
}

# Default models (can be overridden by environment variables)
API_URL = settings.ollama_api_url
MODEL_PLAN = settings.model_plan
MODEL_PARAMS = settings.model_params
MODEL_SOP_PARSER = settings.model_sop_parser
MODEL_SOP_GENERATOR = settings.model_sop_parser

import re
import json
import logging

logger = logging.getLogger(__name__)

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
    """
    Safely extract the first JSON object from a string.
    """
    try:
        json_start = text.find('{')
        json_end = text.rfind('}')
        if json_start != -1 and json_end != -1:
            return json.loads(text[json_start: json_end + 1])
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        logger.error("----- Text That Failed to Parse -----\n%s\n-------------------------------------", text)
    return {}


def get_llm_plan(query: str, context: List[Dict], model: str = MODEL_PLAN) -> Dict:
    """
    Generates a structured step-by-step plan using the given model.
    """
    context_string = ""
    for i, sop in enumerate(context):
        title = sop.get('title', 'N/A')
        issue = sop.get('issue', 'N/A')
        steps = sop.get('steps', [])
        step_list = "\n".join([f"- {step.get('description', 'N/A')} (Tool: {step.get('script', 'N/A')})"
                               for step in steps])
        context_string += f"Context Document {i+1}:\nTitle: {title}\nIssue: {issue}\nSteps:\n{step_list}\n\n"

    logger.info(f"TOOL: context_string: {context_string}")        

    prompt = f"""
    You are an AI assistant acting as an Incident Resolution Manager.
    Task: Convert a query + SOP context into a JSON plan with actionable steps. Do not skip, summarize, or rephrase any steps.
    
    Query: "{query}"
    Context:
    {context_string}
    
    Response MUST be valid JSON:
    {{
      "steps": [
        {{"description": "string", "tool": "string"}},
        ...
      ]
    }}
    Do not include any comments in the json.
    """

    response_text = call_ollama(prompt, model=model)
    
    logger.debug("\n---------- LLM Raw Response for Plan ----------\n%s\n---------------------------------------------\n", response_text)
    
    return extract_json_from_text(response_text) or {"steps": []}


def extract_parameters_with_llm(incident_data: Dict, script_params: List[Dict], model: str = MODEL_PARAMS) -> Dict:
    params_to_find = [
        f"- param_name: '{p.get('param_name')}', type: '{p.get('param_type')}', required: {p.get('required')}"
        for p in script_params if isinstance(p, dict)
    ]
    params_to_find_str = "\n".join(params_to_find)

    prompt = f"""
    You are an AI assistant helping to extract script parameters from incident data.
    Always produce valid JSON as output — no explanations, no extra text.

    Incident Data:
    {json.dumps(incident_data, indent=2)}

    Parameters to Extract:
    {params_to_find_str}

    Extraction Rules:
    1. Carefully analyze the incident data (short_description, description, cmdb_ci, business_service, notes, 
    and any previous script outputs if present).
    2. For each parameter:
    - If the value is explicitly mentioned, extract it exactly.
    - If the value can be inferred (e.g., hostname, port, service name), infer it from the incident context.
    - If the parameter has a default_value (provided separately by the system), you may leave it null here 
      and the system will backfill it.
    - If required and not available, return `null` (never invent random values).
    3. Respect the parameter type:
    - string → plain text
    - integer → numeric value
    - boolean → true/false
    - path/directory → OS path format
    4. Do not include extra keys, comments, or explanations in the output.
    5. If you are unsure, set the value to `null`.

    Output Format (strict JSON only):
    {{
    "param_name_1": value1,
    "param_name_2": value2,
    ...
    }}
    """


    response_text = call_ollama(prompt, model=model)
    return extract_json_from_text(response_text) or {}

# Function to parse raw text into a structured SOP
def get_structured_sop_from_llm(document_text: str) -> Dict:
    """
    Uses an LLM to parse raw SOP text into a structured JSON format with title, issue,
    and a list of step descriptions. It does NOT attempt to match scripts.
    """
    prompt = f"""
    You are an AI assistant that converts raw Standard Operating Procedure (SOP) text into a structured JSON object.

    Your task:
    - Parse the "Raw SOP Text" below and extract the `title`, `issue`, and an ordered list of `steps`.
    - For the `issue`, provide a complete and detailed description of the SOP's purpose and scope.
    - For each step in the `steps` array, provide a `description` only. Do not include a `script_id` field.

    Rules:
    - Your entire response must be a single, valid JSON object. Do not include any other text, explanations, or markdown.
    - The JSON structure must be exactly:
    {{
      "title": "string",
      "issue": "string",
      "steps": [
        {{ "description": "string" }}
      ]
    }}

    Raw SOP Text:
    {document_text}

    JSON Output:
    """
    
    logger.info("📝 Calling LLM to parse SOP text (Step A) using model: %s", MODEL_SOP_PARSER)

    response = call_ollama(prompt, model=MODEL_SOP_PARSER)

    logger.debug(f"LLM Response (Parse Only): {response}")
    parsed_json = extract_json_from_text(response)
    if not parsed_json or "steps" not in parsed_json:
        raise ValueError("Invalid JSON response from LLM during parsing step.")
    
    logger.info("✅ Successfully parsed SOP text into a structured format.")
    return parsed_json

    
def extract_json(response: str) -> str:
    """
    Extract the first valid JSON object from a string.
    """
    match = re.search(r"\{.*\}", response, re.DOTALL)
    if match:
        return match.group(0)
    raise ValueError("No JSON object found in response.")

def generate_hypothetical_sop(query: str, model: str = DEFAULT_MODELS["sop_parser"]) -> str:
    """
    Uses an LLM to generate a hypothetical SOP document based on an incident query.
    This expanded text is then used to create a more effective search vector.
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
    
    parsed_json = extract_json_from_text(response_text)
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
    
    parsed_json = extract_json_from_text(response_text)
    if "questions" not in parsed_json:
        return {"questions": []} 
        
    logger.info(f"✅ LLM analysis complete. Found {len(parsed_json['questions'])} questions.")
    return parsed_json

def generate_script_from_context_llm(sop_context: Dict) -> Dict:
    """
    Generates a complete, structured script object from the context of an SOP draft.
    """
    # Unpack the context for the prompt
    title = sop_context.get("title")
    issue = sop_context.get("issue")
    all_steps = "\n".join([f"- {step}" for step in sop_context.get("steps", [])])
    target_step = sop_context.get("target_step_description")

    prompt = f"""
    You are an expert DevOps engineer and a master scriptwriter. Your task is to author a complete, production-ready shell script based on the context of a Standard Operating Procedure (SOP) and a specific step.

    Your output MUST be a single, valid JSON object with no other text or explanations. This step is an absolute must.

    **Full SOP Context:**
    - **Title:** {title}
    - **Issue:** {issue}
    - **All Steps:**
    {all_steps}

    **Your Target:**
    Your goal is to create a script that automates the following specific step:
    - **Target Step:** "{target_step}"

    **Instructions:**
    Based on all the information above, generate a JSON object with the following structure:
    {{
      "name": "string (a descriptive, short name for the script, e.g., 'check-disk-space.sh')",
      "description": "string (a clear, one-sentence description of what the script does)",
      "content": "string (the full #!/bin/bash script content, formatted as a SINGLE-LINE JSON string with all newlines properly escaped as \\n)",
      "params": [
        {{
          "param_name": "string (e.g., 'HOSTNAME')",
          "param_type": "string (e.g., 'string', 'integer', 'boolean')",
          "required": "boolean (true if the script cannot run without this parameter)"
        }}
      ]
    }}

    **Parameter Rules:**
    - Identify any variables in the target step that would need to be passed as arguments to the script. These are your parameters.
    - Use clear, uppercase parameter names (e.g., 'TARGET_DIRECTORY', 'SERVICE_NAME').

    **Final JSON Output:**
    """
    
    logger.info("🤖 Calling LLM to generate a new script from SOP context...")
    response_text = call_ollama(prompt, model=settings.model_sop_parser)
    logger.debug("LLM Response (Script Generation): %s", response_text)
    
    # Use a regular expression to find the JSON block, ignoring surrounding text
    json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
    if not json_match:
        logger.error(f"No JSON object found in LLM response. Raw output: {response_text}")
        raise ValueError("Invalid or incomplete JSON response from LLM: No JSON object found.")

    json_string = json_match.group(0)
    
    try:
        # The JSON from the LLM should now be valid thanks to the improved prompt
        parsed_json = json.loads(json_string)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse extracted JSON string. Error: {e}. String: {json_string}")
        raise ValueError("Invalid or incomplete JSON response from LLM: Failed to parse JSON.")

    if not all(k in parsed_json for k in ["name", "description", "content", "params"]):
        raise ValueError("Invalid or incomplete JSON response from LLM during script generation: Missing required keys.")
    
    logger.info(f"✅ Successfully generated script draft: '{parsed_json.get('name')}'")
    return parsed_json