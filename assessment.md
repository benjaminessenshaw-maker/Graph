# Project Assessment: Knowledge Gardener / Graph

*Date: 2026-02-20*

## 1. What the Project is Intended to Do

Based on `brainstorm.md`, the Python backend, and the React frontend, this project is building a **graphical overlay and control surface for a Neo4j knowledge graph**. It aims to move beyond a static knowledge base to a "living" system where users can visualize, edit, and interact with data seamlessly.

Key characteristics include:

- **Semantic Visuals**: Node shapes, colors, sizes, and rings convey specific meanings (e.g., entity type, domain, status, and importance).
- **Interactive Editing**: A click-to-edit interface allowing users to modify properties, add tags, and draw relationships directly on the graph without leaving the context.
- **Native Graph Agents**: Instead of external config-driven scripts, automated agents (Scheduler, Presenter, Curator, Sentinel) will live inside the Neo4j database as nodes themselves, interacting with the knowledge graph via standard relationships like `READS_FROM`, `WRITES_TO`, and `CALLS`.

## 2. Current State of Implementation

- **Backend (FastAPI)**:
  - Supports both SQLite and Neo4j.
  - Contains extensive routing for knowledge gardener concepts: Entities, Notes, Sources, Tags, Collections, and Relationships.
  - Basic "execution" stub simulating Data -> Prompt -> Agent flow.
- **Frontend (React + ReactFlow)**:
  - Dark mode graph visualization is functional (`App.tsx`).
  - Fetches the graph from `/api/knowledge/graph`.
  - Implements basic custom nodes (`KnowledgeNode.tsx`) and edges (`KnowledgeEdge.tsx`).
  - Has a functional top bar with search and visibility filters.
  - Has a `NodeDetailSidebar` for viewing node properties.
- **Documentation/Planning**:
  - Extremely detailed vision docs in `brainstorm.md` and the `backend/agent/` directory (e.g., `scheduler.md`, `presenter.md`) outlining the intended schema extensions and agent behaviors.

## 3. What is Still Required

To achieve the full vision outlined in the documentation, the following areas require development:

### 3.1. Visual & Interactive Graph Features

- **Visual Encodings**: Implement the dynamic status rings (yellow for deadline, red for blocking, green for done) and dynamic node sizing based on the `importance` field.
- **Click-to-Edit Functionality**: Transform the current read-only `NodeDetailSidebar` into an active editing pane, or hook up the existing `EditPanel.tsx` to save mutations back to the API.
- **Interactive Relationship Creation**: Add drag-to-connect functionality in ReactFlow to let users draw new edges (relationships) visually.

### 3.2. Schema Extensions (Temporal & Blocking Data)

- As noted in `scheduler.md`, the backend schema (and underlying Neo4j/SQLite driver logic) needs new properties on `Entity` (e.g., `due_date`, `start_date`, `completed_at`, `recurrence`).
- Add support for the `BLOCKS` relationship type to enable dependency tracking.

### 3.3. Agent Implementation

- **Scheduler**: Implement the cron-like background jobs to check for upcoming deadlines, blocked tasks, and overdue items.
- **Presenter**: Set up the MCP (Model Context Protocol) integration to allow an LLM to read the Neo4j schema and execute read-only Cypher queries for conversational exploration.
- **Curator & Sentinel**: (Assuming they follow the same pattern) Build the logic that executes these maintenance/integrity checks directly against the graph API.
- **Database Agents**: Actually seed "Agent", "Automation", and "Integration" nodes into the Neo4j database so they can be visualized in the ReactFlow UI alongside regular data.

## Next Steps

The most logical immediate next step is **Step 1 from the brainstorm**: Completing the custom node components (shape by type, size by importance, color by category, and status rings) as the frontend is already partially there. Alternatively, if the backend schema for temporal data is the bottleneck, updating `knowledge_models.py` and `neo4j_repository.py` to support dates and `BLOCKS` relationships would be the priority.
