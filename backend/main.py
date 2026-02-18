from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session
from typing import List
from contextlib import asynccontextmanager

from database import create_db_and_tables, get_session
from models import Node, Edge, GraphData
from crud import SQLiteRepository
from schemas import ExecutionRequest

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(title="Graph-Agent Workbench API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_repository(session: Session = Depends(get_session)):
    return SQLiteRepository(session)

@app.get("/api/graph", response_model=GraphData)
def get_graph(repo: SQLiteRepository = Depends(get_repository)):
    return GraphData(nodes=repo.get_nodes(), edges=repo.get_edges())

@app.post("/api/nodes", response_model=Node)
def create_node(node: Node, repo: SQLiteRepository = Depends(get_repository)):
    return repo.upsert_node(node)

@app.delete("/api/nodes/{node_id}")
def delete_node(node_id: str, repo: SQLiteRepository = Depends(get_repository)):
    repo.delete_node(node_id)
    return {"status": "success"}

@app.post("/api/edges", response_model=Edge)
def create_edge(edge: Edge, repo: SQLiteRepository = Depends(get_repository)):
    return repo.upsert_edge(edge)

@app.delete("/api/edges/{edge_id}")
def delete_edge(edge_id: str, repo: SQLiteRepository = Depends(get_repository)):
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
