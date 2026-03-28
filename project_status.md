# Project Status & Overview

## 1. Project Overview

**Graph-Agent Workbench (Knowledge Gardener)** is a platform designed to bridge the gap between static knowledge bases and active, autonomous agents. It reimagines the traditional knowledge graph not just as a storage layer, but as a dynamic **control surface** where agents live, operate, and visualize their work alongside the data they process.

The core philosophy is **"Native Graph Agents"**: instead of external scripts operating *on* the database, agents are first-class citizens *within* the graph. They are represented as nodes (`Automation`, `Agent`, `Integration`) connected by semantic relationships (`READS_FROM`, `WRITES_TO`, `CALLS`), making the entire system self-documenting and visually introspectable.

## 2. Recent Transition: Neo4j Adoption

We have recently transitioned the primary backend database from **SQLite** to **Neo4j**. This strategic shift enables:

*   **Native Graph Modeling**: Direct representation of complex relationships without complex join tables.
*   **Cypher Query Language**: Powerful pattern matching for agent logic (e.g., "Find all tasks blocked by high-priority items").
*   **Agent-as-Node Architecture**: Seamlessly integrating execution logic into the data model.
*   **Scalability**: Handling large, interconnected datasets more efficiently.

The backend still supports an abstraction layer via the `GraphRepository` interface, allowing for potential future flexibility, but all active development is focused on the `Neo4jRepository`.

## 3. Current Implementation Status

### Backend (FastAPI + Python)

*   **API Structure**: A comprehensive REST API built with FastAPI, organized into:
    *   **Core Graph Operations**: `nodes`, `edges`, and graph execution stubs.
    *   **Knowledge Gardener Domain**: Specialized endpoints for `Entities`, `Notes`, `Sources`, `Tags`, `Collections`, and `Relationships`.
    *   **Search & Exploration**: Endpoints for semantic search and neighborhood exploration.
*   **Data Access Layer**:
    *   `neo4j_repository.py`: Implements the `GraphRepository` interface using the official Neo4j Python driver. It handles CRUD operations for nodes and edges, as well as complex domain queries.
    *   `models.py`: Defines the data schema using Pydantic/SQLModel for validation and serialization.
*   **Execution Engine**: A basic stub exists for traversing `Data -> Prompt -> Agent` paths, which validates the concept of graph-based execution flows.

### Frontend (React + Vite)

*   **Visualization**: Built on **React Flow**, providing a high-performance, interactive canvas for the knowledge graph.
*   **UI/UX**:
    *   **Dark Mode**: A modern, vibrant dark theme tailored for data-heavy visualizations.
    *   **Sidebar**: A `NodeDetailSidebar` for inspecting node properties.
    *   **Custom Nodes**: Implementation of `KnowledgeNode` to render different entity types visually.
*   **Interaction**: Basic node selection, dragging, and panning are implemented. The UI fetches live data from the `/api/knowledge/graph` endpoint.

## 4. Strategic Vision: Native Graph Agents

The roadmap is driven by the concept of **Native Graph Agents**, detailed in `brainstorm.md`. Key pillars include:

*   **Visual Semantics**:
    *   **Shape**: Indicates entity type (Circle=Concept, Hexagon=Project, Diamond=Decision).
    *   **Color**: Represents domain or collection.
    *   **Rings**: Dynamic status indicators (Yellow=Deadline, Red=Blocking, Green=Done).
    *   **Size**: Reflects importance/centrality.
*   **Interactive Control**:
    *   **Click-to-Edit**: Direct manipulation of node properties and relationships from the graph view.
    *   **Drag-to-Connect**: Visually creating relationships between nodes.
*   **Embedded Logic**:
    *   **Scheduler Agent**: Cron-like nodes that trigger based on time.
    *   **Presenter Agent**: LLM-driven interfaces for conversational exploration.
    *   **Curator/Sentinel**: Maintenance agents that ensure graph integrity.

## 5. Immediate Next Steps

Based on the current assessment, the priority tasks are:

1.  **Visual Enhancements**: Implement the "Visual Semantics" vision — specifically status rings and dynamic sizing — to make the graph information-dense.
2.  **Interactive Editing**: Upgrade the read-only sidebar to a full editing suite, allowing users to modify content and relationships directly.
3.  **Agent Logic**: Begin implementing the actual logic for the `Scheduler` and `Presenter` agents, moving beyond the current execution stub.
4.  **Schema Refinement**: Update the Neo4j schema to fully support the new `Automation` and `Integration` node types and their specific properties (e.g., `cron_schedule`, `last_run`).
