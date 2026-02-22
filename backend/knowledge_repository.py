"""
Knowledge Gardener repository — all Neo4j interactions for the knowledge domain.
Implements the agent protocol: summary-first queries, bounded traversals,
scoped writes, and search-before-create.
"""

import uuid
from typing import List, Optional
from neo4j import Driver

from knowledge_models import (
    NodeGenericCreate, NodeGenericUpdate,
    EntityCreate, EntitySummary, EntityFull,
    NoteCreate, NoteSummary, NoteFull,
    SourceCreate, SourceOut,
    TagCreate, TagOut,
    CollectionCreate, CollectionOut,
    RelationshipCreate, RelationshipOut,
    NodePartialUpdate,
)


def _uid() -> str:
    return str(uuid.uuid4())


def _str_or_none(val):
    """Convert neo4j datetime to ISO string, or return None."""
    if val is None:
        return None
    return str(val)


class KnowledgeRepository:
    """Agent-facing repository enforcing the interaction protocol."""

    # Allowed relationship types (whitelist for safety)
    ALLOWED_REL_TYPES = {
        "RELATES_TO", "IS_PART_OF", "DEPENDS_ON", "CONTRADICTS",
        "SUPERSEDES", "SIMILAR_TO", "DERIVED_FROM", "ABOUT",
        "AUTHORED_BY", "TAGGED", "CONTAINS", "BLOCKS"
    }

    def __init__(self, driver: Driver):
        self.driver = driver

    # ══════════════════════════════════════════════════════
    #  ENTITIES
    # ══════════════════════════════════════════════════════

    def list_entities(
        self,
        entity_type: Optional[str] = None,
        status: str = "active",
        limit: int = 20,
    ) -> List[EntitySummary]:
        """Rule 1: summary-first listing."""
        where = "WHERE e.status = $status"
        params = {"status": status, "limit": limit}
        if entity_type:
            where += " AND e.entity_type = $entity_type"
            params["entity_type"] = entity_type

        query = (
            f"MATCH (e:Entity) {where} "
            "RETURN e.id AS id, e.name AS name, e.entity_type AS entity_type, "
            "       e.summary AS summary, e.status AS status, "
            "       e.importance AS importance, e.updated_at AS updated_at, "
            "       e.due_date AS due_date, e.start_date AS start_date, "
            "       e.completed_at AS completed_at, e.recurrence AS recurrence "
            "ORDER BY e.updated_at DESC LIMIT $limit"
        )
        records, _, _ = self.driver.execute_query(query, **params)
        return [
            EntitySummary(
                id=r["id"], name=r["name"], entity_type=r["entity_type"],
                summary=r["summary"], status=r["status"],
                importance=r["importance"], updated_at=_str_or_none(r["updated_at"]),
                due_date=_str_or_none(r["due_date"]), start_date=_str_or_none(r["start_date"]),
                completed_at=_str_or_none(r["completed_at"]), recurrence=r["recurrence"],
            )
            for r in records
        ]

    def get_entity(self, entity_id: str) -> Optional[EntityFull]:
        """Rule 2: expand on demand — full content + immediate neighbors."""
        query = (
            "MATCH (e:Entity {id: $id}) "
            "OPTIONAL MATCH (e)-[r]-(neighbor) "
            "RETURN e, "
            "  collect(DISTINCT { "
            "    rel_type: type(r), "
            "    neighbor_id: neighbor.id, "
            "    neighbor_name: COALESCE(neighbor.name, neighbor.title, ''), "
            "    neighbor_summary: COALESCE(neighbor.summary, ''), "
            "    direction: CASE WHEN startNode(r) = e THEN 'outgoing' ELSE 'incoming' END"
            "  }) AS connections"
        )
        records, _, _ = self.driver.execute_query(query, id=entity_id)
        if not records:
            return None
        r = records[0]
        e = dict(r["e"])
        # Filter out empty connections (from OPTIONAL MATCH with no neighbors)
        conns = [c for c in r["connections"] if c.get("neighbor_id")]
        return EntityFull(
            id=e["id"], name=e["name"], entity_type=e["entity_type"],
            summary=e["summary"], status=e.get("status", "active"),
            importance=e.get("importance"),
            content=e.get("content"),
            created_at=_str_or_none(e.get("created_at")),
            updated_at=_str_or_none(e.get("updated_at")),
            due_date=_str_or_none(e.get("due_date")),
            start_date=_str_or_none(e.get("start_date")),
            completed_at=_str_or_none(e.get("completed_at")),
            recurrence=e.get("recurrence"),
            connections=conns,
        )

    def upsert_entity(self, data: EntityCreate) -> EntitySummary:
        """Rule 4: scoped write — one entity at a time."""
        query = (
            "MERGE (e:Entity {name: $name, entity_type: $entity_type}) "
            "ON CREATE SET e.id = $new_id, e.created_at = datetime() "
            "SET e.summary = $summary, "
            "    e.content = $content, "
            "    e.status = $status, "
            "    e.importance = $importance, "
            "    e.updated_at = datetime(), "
            "    e.due_date = $due_date, "
            "    e.start_date = $start_date, "
            "    e.completed_at = $completed_at, "
            "    e.recurrence = $recurrence, "
            "    e.x = $x, "
            "    e.y = $y, "
            "    e.is_exposed = CASE WHEN $is_exposed IS NOT NULL THEN $is_exposed ELSE false END "
            "RETURN e.id AS id, e.name AS name, e.entity_type AS entity_type, "
            "       e.summary AS summary, e.status AS status, "
            "       e.importance AS importance, e.updated_at AS updated_at, "
            "       e.due_date AS due_date, e.start_date AS start_date, "
            "       e.completed_at AS completed_at, e.recurrence AS recurrence, "
            "       e.x AS x, e.y AS y, e.is_exposed AS is_exposed"
        )
        records, _, _ = self.driver.execute_query(
            query,
            new_id=_uid(),
            name=data.name,
            entity_type=data.entity_type,
            summary=data.summary,
            content=data.content,
            status=data.status,
            importance=data.importance,
            due_date=data.due_date,
            start_date=data.start_date,
            completed_at=data.completed_at,
            recurrence=data.recurrence,
            x=data.x,
            y=data.y,
            is_exposed=data.is_exposed,
        )
        r = records[0]
        return EntitySummary(
            id=r["id"], name=r["name"], entity_type=r["entity_type"],
            summary=r["summary"], status=r["status"],
            importance=r["importance"], updated_at=_str_or_none(r["updated_at"]),
            due_date=_str_or_none(r["due_date"]), start_date=_str_or_none(r["start_date"]),
            completed_at=_str_or_none(r["completed_at"]), recurrence=r["recurrence"],
            x=r.get("x"), y=r.get("y"), is_exposed=r.get("is_exposed", False),
        )

    # ── Generic Node Update & Create ────────────────────────────────
    
    def create_node(self, data: NodeGenericCreate) -> EntitySummary:
        """Create a node with a dynamic label securely drawn from the DataSchema list."""
        
        # Guard against injection by enforcing pascal case labels without strange characters:
        safe_label = "".join(c for c in data.label if c.isalnum()).capitalize()
        if not safe_label: safe_label = "Concept"

        new_id = str(uuid.uuid4())
        
        query = (
            f"CREATE (n:{safe_label} {{ "
            "    id: $id, "
            "    name: $name, "
            "    entity_type: $entity_type, "
            "    summary: $summary, "
            "    content: $content, "
            "    status: $status, "
            "    importance: $importance, "
            "    created_at: datetime(), "
            "    updated_at: datetime(), "
            "    due_date: $due_date, "
            "    start_date: $start_date, "
            "    completed_at: $completed_at, "
            "    recurrence: $recurrence, "
            "    x: $x, "
            "    y: $y, "
            "    is_exposed: $is_exposed "
            "}) "
            "RETURN n.id AS id, coalesce(labels(n)[0], 'Concept') AS label, n.name AS name, n.entity_type AS entity_type, "
            "       n.summary AS summary, n.status AS status, "
            "       n.importance AS importance, n.updated_at AS updated_at, "
            "       n.due_date AS due_date, n.start_date AS start_date, "
            "       n.completed_at AS completed_at, n.recurrence AS recurrence, "
            "       n.x AS x, n.y AS y, n.is_exposed AS is_exposed"
        )
        
        records, _, _ = self.driver.execute_query(
            query,
            id=new_id,
            name=data.name,
            entity_type=data.node_type,
            summary=data.summary,
            content=data.content,
            status=data.status,
            importance=data.importance,
            due_date=data.due_date,
            start_date=data.start_date,
            completed_at=data.completed_at,
            recurrence=data.recurrence,
            x=data.x,
            y=data.y,
            is_exposed=data.is_exposed,
        )
        
        r = records[0]
        # Notice we are slightly abusing EntitySummary to return arbitrary nodes to the frontend list_entities
        # which expects EntitySummary for the canvas. The 'entity_type' field will contain our 'node_type'.
        return EntitySummary(
            id=r["id"], name=r["name"], entity_type=r["entity_type"] or "",
            summary=r["summary"] or "", status=r["status"] or "",
            importance=r["importance"], updated_at=_str_or_none(r["updated_at"]),
            due_date=_str_or_none(r["due_date"]), start_date=_str_or_none(r["start_date"]),
            completed_at=_str_or_none(r["completed_at"]), recurrence=r["recurrence"],
            x=r.get("x"), y=r.get("y"), is_exposed=r.get("is_exposed", False),
        )
        
    def update_node(self, node_id: str, data: NodeGenericUpdate) -> EntitySummary:
        """Update any node, swapping out its label dynamically natively."""
        
        safe_label = "".join(c for c in data.label if c.isalnum()).capitalize() if data.label else None
        
        # Native Neo4j label swapping without APOC:
        # 1. First query to get existing labels
        records, _, _ = self.driver.execute_query("MATCH (n {id: $id}) RETURN labels(n) as labels", id=node_id)
        if not records:
             raise ValueError(f"Node with id {node_id} not found")
        
        old_labels = records[0]["labels"]
        
        # 2. Build string literal queries to remove old label and set new label natively
        remove_clause = f"REMOVE n:{':'.join(old_labels)} " if old_labels else ""
        set_clause = f"SET n:{safe_label} " if safe_label else ""
            
        query = (
            "MATCH (n {id: $id}) "
            f"{remove_clause} "
            f"{set_clause} "
            "WITH n AS updatedNode "
            "SET updatedNode.name = CASE WHEN $name IS NOT NULL THEN $name ELSE updatedNode.name END, "
            "    updatedNode.entity_type = CASE WHEN $entity_type IS NOT NULL THEN $entity_type ELSE updatedNode.entity_type END, "
            "    updatedNode.summary = CASE WHEN $summary IS NOT NULL THEN $summary ELSE updatedNode.summary END, "
            "    updatedNode.content = CASE WHEN $content IS NOT NULL THEN $content ELSE updatedNode.content END, "
            "    updatedNode.status = CASE WHEN $status IS NOT NULL THEN $status ELSE updatedNode.status END, "
            "    updatedNode.importance = CASE WHEN $importance IS NOT NULL THEN $importance ELSE updatedNode.importance END, "
            "    updatedNode.updated_at = datetime(), "
            "    updatedNode.due_date = CASE WHEN $due_date IS NOT NULL THEN $due_date ELSE updatedNode.due_date END, "
            "    updatedNode.start_date = CASE WHEN $start_date IS NOT NULL THEN $start_date ELSE updatedNode.start_date END, "
            "    updatedNode.completed_at = CASE WHEN $completed_at IS NOT NULL THEN $completed_at ELSE updatedNode.completed_at END, "
            "    updatedNode.recurrence = CASE WHEN $recurrence IS NOT NULL THEN $recurrence ELSE updatedNode.recurrence END, "
            "    updatedNode.x = CASE WHEN $x IS NOT NULL THEN $x ELSE updatedNode.x END, "
            "    updatedNode.y = CASE WHEN $y IS NOT NULL THEN $y ELSE updatedNode.y END, "
            "    updatedNode.is_exposed = CASE WHEN $is_exposed IS NOT NULL THEN $is_exposed ELSE updatedNode.is_exposed END "
            "RETURN updatedNode.id AS id, coalesce(labels(updatedNode)[0], 'Concept') AS label, "
            "       updatedNode.name AS name, updatedNode.entity_type AS entity_type, "
            "       updatedNode.summary AS summary, updatedNode.status AS status, "
            "       updatedNode.importance AS importance, updatedNode.updated_at AS updated_at, "
            "       updatedNode.due_date AS due_date, updatedNode.start_date AS start_date, "
            "       updatedNode.completed_at AS completed_at, updatedNode.recurrence AS recurrence, "
            "       updatedNode.x AS x, updatedNode.y AS y, updatedNode.is_exposed AS is_exposed"
        )
        
        records, _, _ = self.driver.execute_query(
            query,
            id=node_id,
            name=data.name,
            entity_type=data.node_type,
            summary=data.summary,
            content=data.content,
            status=data.status,
            importance=data.importance,
            due_date=data.due_date,
            start_date=data.start_date,
            completed_at=data.completed_at,
            recurrence=data.recurrence,
            x=data.x,
            y=data.y,
            is_exposed=data.is_exposed,
        )
        
        if not records:
             raise ValueError(f"Node with id {node_id} not found")
             
        r = records[0]
        return EntitySummary(
            id=r["id"], name=r["name"], entity_type=r["entity_type"] or "",
            summary=r["summary"] or "", status=r["status"] or "",
            importance=r["importance"], updated_at=_str_or_none(r["updated_at"]),
            due_date=_str_or_none(r["due_date"]), start_date=_str_or_none(r["start_date"]),
            completed_at=_str_or_none(r["completed_at"]), recurrence=r["recurrence"],
            x=r.get("x"), y=r.get("y"), is_exposed=r.get("is_exposed", False),
        )

    def update_entity(self, entity_id: str, data: EntityCreate) -> EntitySummary:
        """Update an existing entity by ID."""
        query = (
            "MATCH (e:Entity {id: $id}) "
            "SET e.name = $name, "
            "    e.entity_type = $entity_type, "
            "    e.summary = $summary, "
            "    e.content = $content, "
            "    e.status = $status, "
            "    e.importance = $importance, "
            "    e.updated_at = datetime(), "
            "    e.due_date = $due_date, "
            "    e.start_date = $start_date, "
            "    e.completed_at = $completed_at, "
            "    e.recurrence = $recurrence, "
            "    e.x = CASE WHEN $x IS NOT NULL THEN $x ELSE e.x END, "
            "    e.y = CASE WHEN $y IS NOT NULL THEN $y ELSE e.y END, "
            "    e.is_exposed = CASE WHEN $is_exposed IS NOT NULL THEN $is_exposed ELSE e.is_exposed END "
            "RETURN e.id AS id, e.name AS name, e.entity_type AS entity_type, "
            "       e.summary AS summary, e.status AS status, "
            "       e.importance AS importance, e.updated_at AS updated_at, "
            "       e.due_date AS due_date, e.start_date AS start_date, "
            "       e.completed_at AS completed_at, e.recurrence AS recurrence, "
            "       e.x AS x, e.y AS y, e.is_exposed AS is_exposed"
        )
        records, _, _ = self.driver.execute_query(
            query,
            id=entity_id,
            name=data.name,
            entity_type=data.entity_type,
            summary=data.summary,
            content=data.content,
            status=data.status,
            importance=data.importance,
            due_date=data.due_date,
            start_date=data.start_date,
            completed_at=data.completed_at,
            recurrence=data.recurrence,
            x=data.x,
            y=data.y,
            is_exposed=data.is_exposed,
        )
        if not records:
            raise ValueError(f"Entity with id {entity_id} not found")
        r = records[0]
        return EntitySummary(
            id=r["id"], name=r["name"], entity_type=r["entity_type"],
            summary=r["summary"], status=r["status"],
            importance=r["importance"], updated_at=_str_or_none(r["updated_at"]),
            due_date=_str_or_none(r["due_date"]), start_date=_str_or_none(r["start_date"]),
            completed_at=_str_or_none(r["completed_at"]), recurrence=r["recurrence"],
            x=r.get("x"), y=r.get("y"), is_exposed=r.get("is_exposed", False),
        )

    def update_node_fields(self, node_id: str, data: NodePartialUpdate) -> None:
        """Update just coordinates and exposure string without touching other fields for any node type."""
        query = (
            "MATCH (n {id: $id}) "
            "WHERE n:Entity OR n:Note OR n:Source OR n:Tag OR n:Collection "
            "SET n.x = CASE WHEN $x IS NOT NULL THEN $x ELSE n.x END, "
            "    n.y = CASE WHEN $y IS NOT NULL THEN $y ELSE n.y END, "
            "    n.is_exposed = CASE WHEN $is_exposed IS NOT NULL THEN $is_exposed ELSE n.is_exposed END "
            "RETURN n.id"
        )
        self.driver.execute_query(
            query,
            id=node_id,
            x=data.x,
            y=data.y,
            is_exposed=data.is_exposed,
        )

    def delete_entity(self, entity_id: str):
        self.driver.execute_query(
            "MATCH (e:Entity {id: $id}) DETACH DELETE e", id=entity_id
        )

    # ══════════════════════════════════════════════════════
    #  NOTES
    # ══════════════════════════════════════════════════════

    def list_notes(
        self,
        note_type: Optional[str] = None,
        limit: int = 20,
    ) -> List[NoteSummary]:
        where = ""
        params = {"limit": limit}
        if note_type:
            where = "WHERE n.note_type = $note_type"
            params["note_type"] = note_type

        query = (
            f"MATCH (n:Note) {where} "
            "RETURN n.id AS id, n.title AS title, n.summary AS summary, "
            "       n.note_type AS note_type, n.updated_at AS updated_at "
            "ORDER BY n.updated_at DESC LIMIT $limit"
        )
        records, _, _ = self.driver.execute_query(query, **params)
        return [
            NoteSummary(
                id=r["id"], title=r["title"], summary=r["summary"],
                note_type=r["note_type"], updated_at=_str_or_none(r["updated_at"]),
            )
            for r in records
        ]

    def get_note(self, note_id: str) -> Optional[NoteFull]:
        query = (
            "MATCH (n:Note {id: $id}) "
            "OPTIONAL MATCH (n)-[r]-(neighbor) "
            "RETURN n, "
            "  collect(DISTINCT { "
            "    rel_type: type(r), "
            "    neighbor_id: neighbor.id, "
            "    neighbor_name: COALESCE(neighbor.name, neighbor.title, ''), "
            "    neighbor_summary: COALESCE(neighbor.summary, ''), "
            "    direction: CASE WHEN startNode(r) = n THEN 'outgoing' ELSE 'incoming' END"
            "  }) AS connections"
        )
        records, _, _ = self.driver.execute_query(query, id=note_id)
        if not records:
            return None
        r = records[0]
        n = dict(r["n"])
        conns = [c for c in r["connections"] if c.get("neighbor_id")]
        return NoteFull(
            id=n["id"], title=n["title"], summary=n["summary"],
            content=n["content"], note_type=n["note_type"],
            created_at=_str_or_none(n.get("created_at")),
            updated_at=_str_or_none(n.get("updated_at")),
            connections=conns,
        )

    def upsert_note(self, data: NoteCreate) -> NoteSummary:
        query = (
            "MERGE (n:Note {title: $title}) "
            "ON CREATE SET n.id = $new_id, n.created_at = datetime() "
            "SET n.summary = $summary, "
            "    n.content = $content, "
            "    n.note_type = $note_type, "
            "    n.updated_at = datetime() "
            "RETURN n.id AS id, n.title AS title, n.summary AS summary, "
            "       n.note_type AS note_type, n.updated_at AS updated_at"
        )
        records, _, _ = self.driver.execute_query(
            query,
            new_id=_uid(),
            title=data.title,
            summary=data.summary,
            content=data.content,
            note_type=data.note_type,
        )
        r = records[0]
        return NoteSummary(
            id=r["id"], title=r["title"], summary=r["summary"],
            note_type=r["note_type"], updated_at=_str_or_none(r["updated_at"]),
        )

    def delete_note(self, note_id: str):
        self.driver.execute_query(
            "MATCH (n:Note {id: $id}) DETACH DELETE n", id=note_id
        )

    # ══════════════════════════════════════════════════════
    #  SOURCES
    # ══════════════════════════════════════════════════════

    def list_sources(self, limit: int = 20) -> List[SourceOut]:
        query = (
            "MATCH (s:Source) "
            "RETURN s.id AS id, s.name AS name, s.source_type AS source_type, "
            "       s.uri AS uri, s.summary AS summary, s.ingested_at AS ingested_at "
            "ORDER BY s.ingested_at DESC LIMIT $limit"
        )
        records, _, _ = self.driver.execute_query(query, limit=limit)
        return [
            SourceOut(
                id=r["id"], name=r["name"], source_type=r["source_type"],
                uri=r["uri"], summary=r["summary"],
                ingested_at=_str_or_none(r["ingested_at"]),
            )
            for r in records
        ]

    def create_source(self, data: SourceCreate) -> SourceOut:
        query = (
            "CREATE (s:Source { "
            "  id: $id, name: $name, source_type: $source_type, "
            "  uri: $uri, summary: $summary, ingested_at: datetime() "
            "}) "
            "RETURN s.id AS id, s.name AS name, s.source_type AS source_type, "
            "       s.uri AS uri, s.summary AS summary, s.ingested_at AS ingested_at"
        )
        records, _, _ = self.driver.execute_query(
            query,
            id=_uid(), name=data.name, source_type=data.source_type,
            uri=data.uri, summary=data.summary,
        )
        r = records[0]
        return SourceOut(
            id=r["id"], name=r["name"], source_type=r["source_type"],
            uri=r["uri"], summary=r["summary"],
            ingested_at=_str_or_none(r["ingested_at"]),
        )

    def delete_source(self, source_id: str):
        self.driver.execute_query(
            "MATCH (s:Source {id: $id}) DETACH DELETE s", id=source_id
        )

    # ══════════════════════════════════════════════════════
    #  TAGS
    # ══════════════════════════════════════════════════════

    def list_tags(self) -> List[TagOut]:
        query = "MATCH (t:Tag) RETURN t.id AS id, t.name AS name, t.color AS color ORDER BY t.name"
        records, _, _ = self.driver.execute_query(query)
        return [TagOut(id=r["id"], name=r["name"], color=r["color"]) for r in records]

    def create_tag(self, data: TagCreate) -> TagOut:
        query = (
            "MERGE (t:Tag {name: $name}) "
            "ON CREATE SET t.id = $id, t.color = $color "
            "RETURN t.id AS id, t.name AS name, t.color AS color"
        )
        records, _, _ = self.driver.execute_query(
            query, id=_uid(), name=data.name.lower(), color=data.color,
        )
        r = records[0]
        return TagOut(id=r["id"], name=r["name"], color=r["color"])

    def delete_tag(self, tag_id: str):
        self.driver.execute_query(
            "MATCH (t:Tag {id: $id}) DETACH DELETE t", id=tag_id
        )

    # ══════════════════════════════════════════════════════
    #  COLLECTIONS
    # ══════════════════════════════════════════════════════

    def list_collections(self) -> List[CollectionOut]:
        query = (
            "MATCH (c:Collection) "
            "RETURN c.id AS id, c.name AS name, c.description AS description, "
            "       c.created_at AS created_at "
            "ORDER BY c.name"
        )
        records, _, _ = self.driver.execute_query(query)
        return [
            CollectionOut(
                id=r["id"], name=r["name"], description=r["description"],
                created_at=_str_or_none(r["created_at"]),
            )
            for r in records
        ]

    def create_collection(self, data: CollectionCreate) -> CollectionOut:
        query = (
            "CREATE (c:Collection { "
            "  id: $id, name: $name, description: $description, "
            "  created_at: datetime() "
            "}) "
            "RETURN c.id AS id, c.name AS name, c.description AS description, "
            "       c.created_at AS created_at"
        )
        records, _, _ = self.driver.execute_query(
            query, id=_uid(), name=data.name, description=data.description,
        )
        r = records[0]
        return CollectionOut(
            id=r["id"], name=r["name"], description=r["description"],
            created_at=_str_or_none(r["created_at"]),
        )

    def delete_collection(self, collection_id: str):
        self.driver.execute_query(
            "MATCH (c:Collection {id: $id}) DETACH DELETE c", id=collection_id
        )

    # ══════════════════════════════════════════════════════
    #  RELATIONSHIPS
    # ══════════════════════════════════════════════════════

    def create_relationship(self, data: RelationshipCreate) -> RelationshipOut:
        """Create a typed relationship between any two nodes."""
        if data.rel_type not in self.ALLOWED_REL_TYPES:
            raise ValueError(
                f"Invalid relationship type '{data.rel_type}'. "
                f"Allowed: {', '.join(sorted(self.ALLOWED_REL_TYPES))}"
            )

        # Dynamic relationship type requires APOC or string interpolation.
        # Since rel_type is whitelisted above, this is safe.
        query = (
            f"MATCH (a {{id: $from_id}}), (b {{id: $to_id}}) "
            f"MERGE (a)-[r:{data.rel_type}]->(b) "
            f"SET r.weight = $weight, "
            f"    r.context = $context, "
            f"    r.created_at = datetime(), "
            f"    r.created_by = 'agent' "
            f"RETURN type(r) AS rel_type, "
            f"       a.id AS from_id, COALESCE(a.name, a.title) AS from_name, "
            f"       b.id AS to_id, COALESCE(b.name, b.title) AS to_name, "
            f"       r.weight AS weight, r.context AS context"
        )
        records, _, _ = self.driver.execute_query(
            query,
            from_id=data.from_id,
            to_id=data.to_id,
            weight=data.weight,
            context=data.context,
        )
        if not records:
            raise ValueError("One or both nodes not found")
        r = records[0]
        return RelationshipOut(
            rel_type=r["rel_type"],
            from_id=r["from_id"], from_name=r["from_name"] or "",
            to_id=r["to_id"], to_name=r["to_name"] or "",
            weight=r["weight"], context=r["context"],
        )

    def delete_relationship(self, from_id: str, to_id: str, rel_type: str) -> None:
        """Deletes a relationship of a specific type between two nodes."""
        if rel_type not in self.ALLOWED_REL_TYPES:
            raise ValueError(f"Invalid relationship type '{rel_type}'")
            
        query = (
            f"MATCH (a {{id: $from_id}})-[r:{rel_type}]->(b {{id: $to_id}}) "
            f"DELETE r"
        )
        self.driver.execute_query(
            query,
            from_id=from_id,
            to_id=to_id,
        )



    # ══════════════════════════════════════════════════════
    #  SEARCH & TRAVERSAL (Agent Protocol Rules 3 & 5)
    # ══════════════════════════════════════════════════════

    def search(self, query_text: str, limit: int = 10) -> List[dict]:
        """Rule 5: search before create. Uses full-text index."""
        query = (
            "CALL db.index.fulltext.queryNodes('entity_search', $query) "
            "YIELD node, score "
            "RETURN node.id AS id, node.name AS name, node.summary AS summary, "
            "       labels(node)[0] AS label, score "
            "ORDER BY score DESC LIMIT $limit "
            "UNION "
            "CALL db.index.fulltext.queryNodes('note_search', $query) "
            "YIELD node, score "
            "RETURN node.id AS id, COALESCE(node.name, node.title) AS name, "
            "       node.summary AS summary, labels(node)[0] AS label, score "
            "ORDER BY score DESC LIMIT $limit"
        )
        records, _, _ = self.driver.execute_query(
            query, query=query_text, limit=limit,
        )
        return [
            {
                "id": r["id"], "name": r["name"],
                "summary": r["summary"], "label": r["label"],
                "score": r["score"],
            }
            for r in records
        ]

    def explore_neighborhood(
        self, node_id: str, depth: int = 1, limit: int = 30,
    ) -> List[dict]:
        """Rule 3: bounded traversal — summaries only."""
        query = (
            "MATCH path = (start {id: $id})-[*1.." + str(min(depth, 2)) + "]-(connected) "
            "RETURN DISTINCT connected.id AS id, "
            "       COALESCE(connected.name, connected.title) AS name, "
            "       connected.summary AS summary, "
            "       labels(connected)[0] AS label, "
            "       length(path) AS distance, "
            "       [r IN relationships(path) | type(r)] AS path_types "
            "ORDER BY distance, name "
            "LIMIT $limit"
        )
        records, _, _ = self.driver.execute_query(
            query, id=node_id, limit=limit,
        )
        return [
            {
                "id": r["id"], "name": r["name"],
                "summary": r["summary"], "label": r["label"],
                "distance": r["distance"],
                "path_types": r["path_types"],
            }
            for r in records
        ]

    # ══════════════════════════════════════════════════════
    #  STATS (lightweight overview for the agent)
    # ══════════════════════════════════════════════════════

    def get_stats(self) -> dict:
        """Quick graph overview — counts only, no content."""
        query = (
            "MATCH (e:Entity) WITH count(e) AS entities "
            "MATCH (n:Note) WITH entities, count(n) AS notes "
            "MATCH (s:Source) WITH entities, notes, count(s) AS sources "
            "MATCH (t:Tag) WITH entities, notes, sources, count(t) AS tags "
            "MATCH (c:Collection) WITH entities, notes, sources, tags, count(c) AS collections "
            "RETURN entities, notes, sources, tags, collections"
        )
        records, _, _ = self.driver.execute_query(query)
        if records:
            r = records[0]
            return {
                "entities": r["entities"],
                "notes": r["notes"],
                "sources": r["sources"],
                "tags": r["tags"],
                "collections": r["collections"],
            }
        return {"entities": 0, "notes": 0, "sources": 0, "tags": 0, "collections": 0}

    # ══════════════════════════════════════════════════════
    #  FULL GRAPH EXPORT (for visual overlay)
    # ══════════════════════════════════════════════════════

    def get_full_graph(self) -> dict:
        """Return all nodes and edges for the visual graph overlay."""
        import math

        allowed_labels = [
            "Entity", "Note", "Source", "Tag", "Collection",
            "Concept", "Organization", "Location", "Activity", "Event",
            "Content", "Person", "Project", "Tool", "TimeBlock"
        ]
        label_cond_n = " OR ".join(f"n:{l}" for l in allowed_labels)
        label_cond_a = " OR ".join(f"a:{l}" for l in allowed_labels)
        label_cond_b = " OR ".join(f"b:{l}" for l in allowed_labels)

        # ── Fetch all nodes with visual properties ────────
        node_query = (
            "MATCH (n) "
            f"WHERE {label_cond_n} "
            "RETURN n.id AS id, "
            "       COALESCE(n.name, n.title) AS name, "
            "       n.summary AS summary, "
            "       labels(n)[0] AS label, "
            "       n.entity_type AS entity_type, "
            "       n.note_type AS note_type, "
            "       n.source_type AS source_type, "
            "       n.importance AS importance, "
            "       n.status AS status, "
            "       n.created_at AS created_at, "
            "       n.updated_at AS updated_at, "
            "       n.completed_at AS completed_at, "
            "       n.due_date AS due_date, "
            "       n.color AS color, "
            "       n.x AS x, "
            "       n.y AS y, "
            "       n.is_exposed AS is_exposed "
            "ORDER BY label, name "
            "LIMIT 300"
        )
        node_records, _, _ = self.driver.execute_query(node_query)

        # ── Fetch all relationships ───────────────────────
        edge_query = (
            "MATCH (a)-[r]->(b) "
            f"WHERE ({label_cond_a}) "
            f"  AND ({label_cond_b}) "
            "RETURN a.id AS source, "
            "       b.id AS target, "
            "       type(r) AS rel_type, "
            "       r.weight AS weight, "
            "       r.context AS context "
            "LIMIT 1000"
        )
        edge_records, _, _ = self.driver.execute_query(edge_query)

        # ── Build edge list & calc blocking status ────────
        edges = []
        blocking_ids = set()
        blocked_ids = set()
        for r in edge_records:
            if r["rel_type"] == "BLOCKS":
                blocking_ids.add(r["source"])
                blocked_ids.add(r["target"])
                
            edges.append({
                "id": f"e-{r['source']}-{r['target']}-{r['rel_type']}",
                "source": r["source"],
                "target": r["target"],
                "rel_type": r["rel_type"],
                "weight": r["weight"],
                "context": r["context"],
            })

        # ── Build node list with grid positions ───────────
        cols = max(int(math.sqrt(len(node_records))), 1)
        nodes = []
        for i, r in enumerate(node_records):
            nodes.append({
                "id": r["id"],
                "name": r["name"] or "Untitled",
                "summary": r["summary"],
                "label": r["label"],
                "entity_type": r["entity_type"],
                "note_type": r["note_type"],
                "source_type": r["source_type"],
                "importance": r["importance"] or 3,
                "status": r["status"],
                "created_at": _str_or_none(r["created_at"]),
                "updated_at": _str_or_none(r["updated_at"]),
                "completed_at": _str_or_none(r["completed_at"]),
                "due_date": _str_or_none(r["due_date"]),
                "color": r["color"],
                "is_blocking": r["id"] in blocking_ids,
                "is_blocked": r["id"] in blocked_ids,
                "position_x": r.get("x") if r.get("x") is not None else (i % cols) * 280,
                "position_y": r.get("y") if r.get("y") is not None else (i // cols) * 200,
                "is_exposed": r.get("is_exposed", False),
            })

        return {"nodes": nodes, "edges": edges}
