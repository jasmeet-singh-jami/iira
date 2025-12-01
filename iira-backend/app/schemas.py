# app/schemas.py
from pydantic import BaseModel
from typing import List, Dict, Optional, Any

class Step(BaseModel):
    description: str
    script: Optional[str] = None
    script_id: Optional[str] = None



class ScriptParam(BaseModel):
    param_name: str
    param_type: str
    required: bool
    default_value: Optional[str] = None

class AddScriptRequest(BaseModel):
    name: str
    description: str
    tags: List[str]
    content: str
    script_type: str
    params: List[ScriptParam]

class UpdateScriptRequest(BaseModel):
    id: int
    name: str
    description: str
    tags: List[str]
    content: str
    script_type: str
    params: List[ScriptParam]

class SOPDeleteByIDRequest(BaseModel):
    sop_id: str

class SOPParseRequest(BaseModel):
    document_text: str

class MatchScriptRequest(BaseModel):
    description: str

class GenerateSOPRequest(BaseModel):
    problem_description: str
    answers: Optional[Dict[str, str]] = None

class GenerateScriptContext(BaseModel):
    title: str
    issue: str
    steps: List[str]
    target_step_description: str    

class GenerateSimpleScriptRequest(BaseModel):
    description: str    

class AgentRecommendationRequest(BaseModel):
    incident_number: Optional[str] = None
    short_description: str
    description: Optional[str] = None

class RetrievalFeedbackRequest(BaseModel):
    incident_number: Optional[str] = None
    incident_short_description: str
    incident_description: Optional[str] = None
    recommended_agent_id: Optional[str] = None
    recommended_agent_title: Optional[str] = None
    search_score: Optional[float] = None
    user_feedback_type: str # 'Correct' or 'Incorrect'
    correct_agent_id: Optional[str] = None
    correct_agent_title: Optional[str] = None
    session_id: Optional[str] = None # Optional: To link feedback session    

# 1. Add a Node Model
class Node(BaseModel):
    type: str
    name: Optional[str] = None
    description: Optional[str] = None
    script: Optional[str] = None
    script_id: Optional[str] = None
    next: Optional[str] = None
    condition: Optional[str] = None
    paths: Optional[Dict[str, str]] = None

# 2. Update SOP Model to support both formats (or just the new one)
class SOP(BaseModel):
    title: str
    issue: str
    tags: Optional[List[str]] = []
    nodes: Optional[Dict[str, Any]] = None  # Add support for nodes
    start_node_id: Optional[str] = None     # Add support for start_node_id
    steps: Optional[List[Step]] = []        # Make steps optional

class IngestRequest(BaseModel):
    sops: List[SOP]    


