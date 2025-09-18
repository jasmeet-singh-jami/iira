# iira/app/services/llm_client.py
import json
import requests
import time
import re
from typing import List, Dict, Any
from app.config import settings
import json

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
                timeout=60
            )
            response.raise_for_status()
            response_json = response.json()
            return response_json.get("response", "")
        except requests.exceptions.RequestException as e:
            retries += 1
            if retries < max_retries:
                delay = 2 ** retries
                print(f"[Ollama] Retry {retries}/{max_retries} in {delay}s due to error: {e}")
                time.sleep(delay)
            else:
                print(f"[Ollama] Failed after {max_retries} retries: {e}")
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
    # --- MODIFICATION START ---
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        print("----- Text That Failed to Parse -----")
        print(text)
        print("-------------------------------------")
    # --- MODIFICATION END ---
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

    prompt = f"""
    You are an AI assistant acting as an Incident Resolution Manager.
    Task: Convert a query + SOP context into a JSON plan with actionable steps.
    
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
    # --- MODIFICATION START ---
    print("\n---------- LLM Raw Response for Plan ----------")
    print(response_text)
    print("---------------------------------------------\n")
    # --- MODIFICATION END ---
    return extract_json_from_text(response_text) or {"steps": []}


def extract_parameters_with_llm(incident_data: Dict, script_params: List[Dict], model: str = MODEL_PARAMS) -> Dict:
    params_to_find = [
        f"param_name: '{p.get('param_name')}', type: '{p.get('param_type')}', required: '{p.get('required')}'"
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
def get_structured_sop_from_llm(document_text: str, available_scripts: List[Dict]) -> Dict:
    """
    Uses the LLM to parse raw text into a structured SOP format.
    """
    # Use script ID and description
    scripts_list = [f"- ID: {script['id']} (Description: {script['description']})" for script in available_scripts]
    scripts_str = "\n".join(scripts_list)
    print(f"scripts_str: {scripts_str}")    
    
    prompt = f"""
    You are an AI assistant that converts raw Standard Operating Procedure (SOP) text into a structured JSON format.
    Your task is to parse the raw text and extract the title, issue, and a list of steps. For each step, provide a description and, if a relevant automated script exists, provide its ID.
    The issue will be the description of the type of issue it will fix and detail of the steps it will perform to fix the issue.
    Available Scripts:
    {scripts_str}

    Instructions:
    1. Always respond with a single JSON object. Do not include any other text, explanations, or markdown.
    2. The JSON object must have three top-level keys: `title` (string), `issue` (string), and `steps` (array of objects).
    3. For each step in the `steps` array, use two keys: `description` (string) and **`script_id` (string)**. The description should be detailed.
    4. **The value for `script_id` MUST be a script's unique ID taken directly and exactly from the "Available Scripts" list. Do not make up a script ID.** 5. Be very conservative about assigning a script ID to `script_id`. Do not use script names from SOP. 
       If a step has no matching script in Available scripts, set the `script_id` value to `null`.
    6. Keep the step descriptions concise and focused on the action.

    **Required JSON Output Format:**
    {{
    "title": "string",
    "issue": "string",
    "steps": [
        {{
        "description": "string",
        "script_id": "string"
        }}
    ]
    }}

    Raw SOP Text:
    {document_text}

    JSON Output:
    """
    
    print("----------------------------------------")
    print("📝 Calling LLM to parse SOP...")
    print(f"Model: {MODEL_SOP_PARSER}")
    # print(f"Prompt: {prompt}")  # Uncomment for debugging
    print("----------------------------------------")

    response = call_ollama(prompt, MODEL_SOP_PARSER)

    try:
        # The LLM's response should be a JSON string, so we need to parse it
        print(f"LLM Response: {response}")
        cleaned = extract_json(response)
        parsed_json = json.loads(cleaned)
        print(f"✅ Successfully parsed LLM response into JSON.")
        return parsed_json
    except json.JSONDecodeError as e:
        print(f"❌ Failed to decode JSON from LLM response: {e}")
        print(f"Raw LLM response: {response}")
        raise ValueError("Invalid JSON response from LLM.")
    
def extract_json(response: str) -> str:
    """
    Extract the first valid JSON object from a string.
    """
    match = re.search(r"\{.*\}", response, re.DOTALL)
    if match:
        return match.group(0)
    raise ValueError("No JSON object found in response.")