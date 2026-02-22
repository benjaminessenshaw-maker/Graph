from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session
from typing import List, Optional
from contextlib import asynccontextmanager

from config import get_settings
from database import (
    create_db_and_tables,
    get_session,
    init_neo4j_driver,
    get_neo4j_driver,
    close_neo4j_driver,
)
from models import Node, Edge, GraphData
from crud import GraphRepository, SQLiteRepository
from neo4j_repository import Neo4jRepository
from schemas import ExecutionRequest
from schema import init_schema
from knowledge_models import (
    NodeGenericCreate, NodeGenericUpdate,
    EntityCreate, EntitySummary, EntityFull,
    NoteCreate, NoteSummary, NoteFull,
    SourceCreate, SourceOut,
    TagCreate, TagOut,
    CollectionCreate, CollectionOut,
    RelationshipCreate, RelationshipOut,
    SearchRequest, NeighborhoodRequest,
    NodePartialUpdate,
)
from knowledge_repository import KnowledgeRepository


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    # Always init SQLite tables (cheap, no-op if they exist)
    create_db_and_tables()

    # Init Neo4j driver if configured
    if settings.graph_db == "neo4j":
        driver = init_neo4j_driver()
        print(f"[OK] Connected to Neo4j at {settings.neo4j_uri}")
        init_schema(driver)
        print("[OK] Neo4j schema constraints and indexes applied")

    yield

    # Shutdown: close Neo4j driver
    if settings.graph_db == "neo4j":
        close_neo4j_driver()

app = FastAPI(title="Graph-Agent Workbench API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_repository(
    session: Session = Depends(get_session),
) -> GraphRepository:
    """Return the correct repository based on GRAPH_DB setting."""
    settings = get_settings()
    if settings.graph_db == "neo4j":
        return Neo4jRepository(get_neo4j_driver())
    return SQLiteRepository(session)


@app.get("/api/graph", response_model=GraphData)
def get_graph(repo: GraphRepository = Depends(get_repository)):
    return GraphData(nodes=repo.get_nodes(), edges=repo.get_edges())


@app.post("/api/nodes", response_model=Node)
def create_node(node: Node, repo: GraphRepository = Depends(get_repository)):
    return repo.upsert_node(node)


@app.delete("/api/nodes/{node_id}")
def delete_node(node_id: str, repo: GraphRepository = Depends(get_repository)):
    repo.delete_node(node_id)
    return {"status": "success"}


@app.post("/api/edges", response_model=Edge)
def create_edge(edge: Edge, repo: GraphRepository = Depends(get_repository)):
    return repo.upsert_edge(edge)


@app.delete("/api/edges/{edge_id}")
def delete_edge(edge_id: str, repo: GraphRepository = Depends(get_repository)):
    repo.delete_edge(edge_id)
    return {"status": "success"}


@app.post("/api/execute")
def execute_graph(request: ExecutionRequest):
    # Simulating a traversal: Data -> Prompt -> Agent
    nodes_dict = {n['id']: n for n in request.nodes}
    edges = request.edges

    results = []
    data_nodes = [n for n in request.nodes if n.get('type') == 'dataNode']

    for dn in data_nodes:
        # Find edges from this data node
        connected_to_dn = [e['target'] for e in edges if e['source'] == dn['id']]
        for target_id in connected_to_dn:
            target_node = nodes_dict.get(target_id)
            if target_node and target_node.get('type') == 'promptNode':
                # Find edges from this prompt node
                connected_to_pn = [e['target'] for e in edges if e['source'] == target_id]
                for agent_id in connected_to_pn:
                    agent_node = nodes_dict.get(agent_id)
                    if agent_node and agent_node.get('type') == 'agentNode':
                        model = agent_node.get('data', {}).get('model', 'Unknown')
                        label = dn.get('data', {}).get('label', 'No Label')
                        prompt = target_node.get('data', {}).get('prompt', 'No Prompt')
                        results.append(f"[{model}] Processed '{label}' with prompt: '{prompt}'")

    if not results:
        # Check if there are any nodes at all
        if not request.nodes:
            return {"message": "Empty graph", "result": "Please add some nodes to the canvas."}
        return {"message": "Execution finished", "result": "No valid Data -> Prompt -> Agent paths found. Ensure you have connected Data -> Prompt -> Agent nodes in that order."}

    return {"message": "Execution successful", "result": "\n".join(results)}


# ══════════════════════════════════════════════════════════════
#  KNOWLEDGE GARDENER API
# ══════════════════════════════════════════════════════════════

def get_knowledge_repo() -> KnowledgeRepository:
    """Dependency for knowledge endpoints — requires Neo4j."""
    settings = get_settings()
    if settings.graph_db != "neo4j":
        raise HTTPException(
            status_code=503,
            detail="Knowledge API requires GRAPH_DB=neo4j",
        )
    return KnowledgeRepository(get_neo4j_driver())


# ── Generic Nodes ─────────────────────────────────────────────

@app.post("/api/knowledge/nodes", response_model=EntitySummary)
def create_knowledge_node(
    data: NodeGenericCreate,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    return repo.create_node(data)

@app.put("/api/knowledge/nodes/{node_id}", response_model=EntitySummary)
def update_knowledge_node(
    node_id: str,
    data: NodeGenericUpdate,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    return repo.update_node(node_id, data)

# ── Entities ──────────────────────────────────────────────────

@app.get("/api/knowledge/entities", response_model=List[EntitySummary])
def list_entities(
    entity_type: Optional[str] = None,
    status: str = "active",
    limit: int = 20,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    return repo.list_entities(entity_type=entity_type, status=status, limit=limit)


@app.get("/api/knowledge/entities/{entity_id}", response_model=EntityFull)
def get_entity(
    entity_id: str,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    result = repo.get_entity(entity_id)
    if not result:
        raise HTTPException(status_code=404, detail="Entity not found")
    return result


@app.post("/api/knowledge/entities", response_model=EntitySummary)
def upsert_entity(
    data: EntityCreate,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    return repo.upsert_entity(data)


@app.put("/api/knowledge/entities/{entity_id}", response_model=EntitySummary)
def update_entity(
    entity_id: str,
    data: EntityCreate,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    try:
        return repo.update_entity(entity_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.patch("/api/knowledge/nodes/{node_id}", response_model=dict)
def update_node_partial(
    node_id: str,
    data: NodePartialUpdate,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    repo.update_node_fields(node_id, data)
    return {"status": "updated", "id": node_id}


@app.delete("/api/knowledge/entities/{entity_id}")
def delete_entity(
    entity_id: str,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    repo.delete_entity(entity_id)
    return {"status": "deleted"}


# ── Notes ─────────────────────────────────────────────────────

@app.get("/api/knowledge/notes", response_model=List[NoteSummary])
def list_notes(
    note_type: Optional[str] = None,
    limit: int = 20,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    return repo.list_notes(note_type=note_type, limit=limit)


@app.get("/api/knowledge/notes/{note_id}", response_model=NoteFull)
def get_note(
    note_id: str,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    result = repo.get_note(note_id)
    if not result:
        raise HTTPException(status_code=404, detail="Note not found")
    return result


@app.post("/api/knowledge/notes", response_model=NoteSummary)
def upsert_note(
    data: NoteCreate,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    return repo.upsert_note(data)


@app.delete("/api/knowledge/notes/{note_id}")
def delete_note(
    note_id: str,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    repo.delete_note(note_id)
    return {"status": "deleted"}


# ── Sources ───────────────────────────────────────────────────

@app.get("/api/knowledge/sources", response_model=List[SourceOut])
def list_sources(
    limit: int = 20,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    return repo.list_sources(limit=limit)


@app.post("/api/knowledge/sources", response_model=SourceOut)
def create_source(
    data: SourceCreate,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    return repo.create_source(data)


@app.delete("/api/knowledge/sources/{source_id}")
def delete_source(
    source_id: str,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    repo.delete_source(source_id)
    return {"status": "deleted"}


# ── Tags ──────────────────────────────────────────────────────

@app.get("/api/knowledge/tags", response_model=List[TagOut])
def list_tags(repo: KnowledgeRepository = Depends(get_knowledge_repo)):
    return repo.list_tags()


@app.post("/api/knowledge/tags", response_model=TagOut)
def create_tag(
    data: TagCreate,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    return repo.create_tag(data)


@app.delete("/api/knowledge/tags/{tag_id}")
def delete_tag(
    tag_id: str,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    repo.delete_tag(tag_id)
    return {"status": "deleted"}


# ── Collections ───────────────────────────────────────────────

@app.get("/api/knowledge/collections", response_model=List[CollectionOut])
def list_collections(repo: KnowledgeRepository = Depends(get_knowledge_repo)):
    return repo.list_collections()


@app.post("/api/knowledge/collections", response_model=CollectionOut)
def create_collection(
    data: CollectionCreate,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    return repo.create_collection(data)


@app.delete("/api/knowledge/collections/{collection_id}")
def delete_collection(
    collection_id: str,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    repo.delete_collection(collection_id)
    return {"status": "deleted"}


# ── Relationships ─────────────────────────────────────────────

@app.post("/api/knowledge/relationships", response_model=RelationshipOut)
def create_relationship(
    data: RelationshipCreate,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    try:
        return repo.create_relationship(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/knowledge/relationships")
def delete_relationship(
    from_id: str,
    to_id: str,
    rel_type: str,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    try:
        repo.delete_relationship(from_id, to_id, rel_type)
        return {"status": "deleted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Search & Exploration ──────────────────────────────────────

@app.post("/api/knowledge/search")
def search_knowledge(
    request: SearchRequest,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    return repo.search(request.query, limit=request.limit)


@app.post("/api/knowledge/explore")
def explore_neighborhood(
    request: NeighborhoodRequest,
    repo: KnowledgeRepository = Depends(get_knowledge_repo),
):
    return repo.explore_neighborhood(
        request.node_id, depth=request.depth, limit=request.limit,
    )


# ── Graph Export (visual overlay) ─────────────────────────────

@app.get("/api/knowledge/graph")
def knowledge_graph(repo: KnowledgeRepository = Depends(get_knowledge_repo)):
    return repo.get_full_graph()


# ── Stats ─────────────────────────────────────────────────────

@app.get("/api/knowledge/stats")
def knowledge_stats(repo: KnowledgeRepository = Depends(get_knowledge_repo)):
    return repo.get_stats()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
