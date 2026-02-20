"""
Pydantic models for the Knowledge Gardener domain.
These are separate from the ReactFlow canvas models (models.py).
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


# ── Node Models ────────────────────────────────────────────


class EntityCreate(BaseModel):
    """Create or update an Entity node."""
    name: str
    entity_type: str = Field(
        description="Subtype: concept, person, project, tool, place, event, other"
    )
    summary: str = Field(max_length=300)
    content: Optional[str] = None
    status: str = "active"
    importance: Optional[int] = Field(None, ge=1, le=5)


class EntitySummary(BaseModel):
    """Lightweight entity representation for listings (no full content)."""
    id: str
    name: str
    entity_type: str
    summary: str
    status: str
    importance: Optional[int] = None
    updated_at: Optional[str] = None


class EntityFull(EntitySummary):
    """Full entity with content and connections."""
    content: Optional[str] = None
    created_at: Optional[str] = None
    connections: List[Dict[str, Any]] = []


class NoteCreate(BaseModel):
    """Create or update a Note node."""
    title: str = Field(max_length=80)
    summary: str = Field(max_length=300)
    content: str
    note_type: str = Field(
        description="Type: insight, observation, question, decision, log"
    )


class NoteSummary(BaseModel):
    """Lightweight note representation."""
    id: str
    title: str
    summary: str
    note_type: str
    updated_at: Optional[str] = None


class NoteFull(NoteSummary):
    """Full note with content."""
    content: str
    created_at: Optional[str] = None
    connections: List[Dict[str, Any]] = []


class SourceCreate(BaseModel):
    """Create a Source node."""
    name: str
    source_type: str = Field(
        description="Type: url, document, conversation, file, manual"
    )
    uri: Optional[str] = None
    summary: Optional[str] = None


class SourceOut(BaseModel):
    id: str
    name: str
    source_type: str
    uri: Optional[str] = None
    summary: Optional[str] = None
    ingested_at: Optional[str] = None


class TagCreate(BaseModel):
    name: str = Field(description="Lowercase tag name")
    color: Optional[str] = None


class TagOut(BaseModel):
    id: str
    name: str
    color: Optional[str] = None


class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CollectionOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: Optional[str] = None


# ── Relationship Models ───────────────────────────────────


class RelationshipCreate(BaseModel):
    """Create a typed relationship between two nodes."""
    from_id: str
    to_id: str
    rel_type: str = Field(
        description="Relationship type: RELATES_TO, IS_PART_OF, DEPENDS_ON, "
                    "CONTRADICTS, SUPERSEDES, SIMILAR_TO, DERIVED_FROM, "
                    "ABOUT, AUTHORED_BY, TAGGED, CONTAINS"
    )
    weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    context: Optional[str] = Field(None, max_length=200)


class RelationshipOut(BaseModel):
    rel_type: str
    from_id: str
    from_name: str
    to_id: str
    to_name: str
    weight: Optional[float] = None
    context: Optional[str] = None


# ── Search / Query Models ─────────────────────────────────


class SearchRequest(BaseModel):
    query: str
    labels: Optional[List[str]] = Field(
        None,
        description="Filter to specific labels: Entity, Note, Source"
    )
    limit: int = Field(10, le=20)


class NeighborhoodRequest(BaseModel):
    """Request to explore a node's neighborhood."""
    node_id: str
    depth: int = Field(1, ge=1, le=2)
    limit: int = Field(30, le=50)
