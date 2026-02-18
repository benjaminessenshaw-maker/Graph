from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class NodeUpdate(BaseModel):
    type: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    data: Optional[Dict[str, Any]] = None

class EdgeUpdate(BaseModel):
    source: Optional[str] = None
    target: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class ExecutionRequest(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
