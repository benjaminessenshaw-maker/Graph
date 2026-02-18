from typing import Optional, Dict, Any, List
from sqlmodel import Field, SQLModel, JSON, Column

class NodeBase(SQLModel):
    id: str = Field(primary_key=True)
    type: str
    position_x: float
    position_y: float
    data: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

class Node(NodeBase, table=True):
    pass

class EdgeBase(SQLModel):
    id: str = Field(primary_key=True)
    source: str
    target: str
    source_handle: Optional[str] = None
    target_handle: Optional[str] = None
    data: Optional[Dict[str, Any]] = Field(default_factory=dict, sa_column=Column(JSON))

class Edge(EdgeBase, table=True):
    pass

class GraphData(SQLModel):
    nodes: List[Node]
    edges: List[Edge]
