# Knowledge Gardener — Presenter

> **Trigger:** User chat — "show me", "what connects", "visualise", "explain the graph"
>
> **Powered by:** Neo4j MCP Server (`read_neo4j_cypher`, `get_neo4j_schema`)
>
> **Reference:** Read [identity.md](./identity.md) first — all core principles apply.

---

## Overview

The presenter is the agent's **display mode**. It translates natural language questions about the knowledge graph into Cypher queries, executes them via the MCP server, and formats the results into readable, visual answers.

The user never writes Cypher. They just talk.

```
User: "What's connected to Python?"
Agent: → generates Cypher → executes via MCP → formats result

Result:
  Python (concept)
  ├── RELATES_TO → FastAPI (tool)
  ├── RELATES_TO → Neo4j Driver (tool)
  ├── TAGGED → #backend
  └── IS_PART_OF ← Knowledge Gardener (project)
```

---

## How It Differs From Other Agents

| Agent | Data access | Purpose |
|-------|------------|---------|
| **Chat handler** | REST API endpoints | CRUD operations (add, find, delete) |
| **Curator** | REST API endpoints | Scheduled maintenance |
| **Sentinel** | REST API endpoints | Integrity checks |
| **Presenter** | **MCP Cypher tools** | Exploration & visualization |

The presenter has **direct graph access** — it can run arbitrary read queries, not just predefined endpoints. This makes it vastly more flexible for ad-hoc exploration.

---

## MCP Tools Available

The presenter uses these MCP-provided tools:

### `get_neo4j_schema`

Returns the full graph schema: node labels, properties, relationship types.

- **When to use:** At the start of a session, to understand what's in the graph
- **Cache:** Schema can be cached for the session — don't re-fetch unless user modifies structure

### `read_neo4j_cypher`

Executes read-only Cypher queries and returns JSON results.

- **When to use:** For every exploration/visualization request
- **Timeout:** 30 seconds (default — configurable)
- **Safety:** Read-only by nature — cannot mutate data

### `write_neo4j_cypher`

Executes write Cypher queries — used only when the presenter needs to annotate.

- **When to use:** Rarely — only for tagging or adding metadata during exploration
- **Safety:** Presenter should default to read-only mode

---

## Query Translation Patterns

The presenter translates natural language to Cypher. Here are the common patterns:

### Pattern 1: "What do I know about X?"

```
User: "What do I know about FastAPI?"
```

```cypher
MATCH (e:Entity)
WHERE toLower(e.name) CONTAINS toLower('FastAPI')
OPTIONAL MATCH (e)-[r]-(connected)
RETURN e.name, e.entity_type, e.summary, e.importance,
       type(r) AS relationship,
       COALESCE(connected.name, connected.title) AS connected_to,
       labels(connected)[0] AS connected_type
LIMIT 20
```

**Response format:**

```
FastAPI (tool) ★★★★ — Modern Python web framework for building APIs

  Connections:
  → RELATES_TO → Python (concept)
  → RELATES_TO → Uvicorn (tool)
  → TAGGED → #backend, #api
  ← IS_PART_OF ← Knowledge Gardener (project)

  4 connections total.
```

### Pattern 2: "What connects X to Y?"

```
User: "How is Python connected to Neo4j?"
```

```cypher
MATCH path = shortestPath(
  (a:Entity)-[*..5]-(b:Entity)
)
WHERE toLower(a.name) CONTAINS toLower('Python')
  AND toLower(b.name) CONTAINS toLower('Neo4j')
RETURN [n IN nodes(path) | COALESCE(n.name, n.title)] AS path_nodes,
       [r IN relationships(path) | type(r)] AS path_rels,
       length(path) AS distance
LIMIT 3
```

**Response format:**

```
Shortest path (2 hops):
  Python → RELATES_TO → Neo4j Driver → RELATES_TO → Neo4j

Alternative path (3 hops):
  Python → IS_PART_OF → Knowledge Gardener → RELATES_TO → Neo4j
```

### Pattern 3: "Show me everything tagged with X"

```
User: "Show me everything tagged as backend"
```

```cypher
MATCH (n)-[:TAGGED]->(t:Tag)
WHERE toLower(t.name) = toLower('backend')
RETURN COALESCE(n.name, n.title) AS name,
       labels(n)[0] AS type,
       n.summary AS summary,
       n.importance AS importance
ORDER BY n.importance DESC
LIMIT 15
```

**Response format:**

```
#backend — 6 items:

  ★★★★★ Knowledge Gardener (project) — Agent-powered knowledge management
  ★★★★  FastAPI (tool) — Modern Python web framework
  ★★★★  Neo4j (tool) — Graph database
  ★★★   Uvicorn (tool) — ASGI server
  ★★    SQLite (tool) — Fallback database
  ★     Docker (tool) — Container platform
```

### Pattern 4: "Show me the big picture"

```
User: "Give me an overview of my graph"
```

```cypher
MATCH (n)
WITH labels(n)[0] AS label, count(n) AS cnt
RETURN label, cnt
ORDER BY cnt DESC
```

Plus:

```cypher
MATCH ()-[r]->()
WITH type(r) AS rel_type, count(r) AS cnt
RETURN rel_type, cnt
ORDER BY cnt DESC
```

**Response format:**

```
📊 Your knowledge graph at a glance:

  Nodes: 47 total
  ├── Entity: 32
  ├── Note: 8
  ├── Tag: 5
  ├── Source: 4
  └── Collection: 3 (but actually 2)

  Relationships: 89 total
  ├── RELATES_TO: 34
  ├── TAGGED: 22
  ├── DERIVED_FROM: 15
  ├── IS_PART_OF: 10
  └── ABOUT: 8

  Top entities by importance:
  1. Knowledge Gardener ★★★★★
  2. Neo4j ★★★★
  3. Python ★★★★
```

### Pattern 5: "What's the most important?"

```
User: "What are my most important entities?"
```

```cypher
MATCH (e:Entity)
WHERE e.status = 'active'
RETURN e.name, e.entity_type, e.importance, e.summary
ORDER BY e.importance DESC, e.updated_at DESC
LIMIT 10
```

### Pattern 6: "What's been added recently?"

```
User: "What's new in my graph?"
```

```cypher
MATCH (n)
WHERE n.created_at > datetime() - duration({days: 7})
RETURN COALESCE(n.name, n.title) AS name,
       labels(n)[0] AS type,
       n.summary AS summary,
       n.created_at AS added
ORDER BY n.created_at DESC
LIMIT 10
```

### Pattern 7: "Find clusters"

```
User: "Are there any clusters or groups in my graph?"
```

```cypher
MATCH (e:Entity)-[r]-(other:Entity)
WITH e, count(DISTINCT other) AS connections
WHERE connections >= 3
RETURN e.name, e.entity_type, connections, e.summary
ORDER BY connections DESC
LIMIT 10
```

**Response format:**

```
🌐 Most connected entities (hubs):

  1. Knowledge Gardener (12 connections) — project hub
  2. Python (8 connections) — language connects many tools
  3. Neo4j (6 connections) — database at the core

  These are your graph's hubs. Everything flows through them.
```

### Pattern 8: "What's isolated?"

```
User: "Is anything disconnected?"
```

```cypher
MATCH (n)
WHERE NOT (n)--()
RETURN COALESCE(n.name, n.title) AS name,
       labels(n)[0] AS type,
       n.summary AS summary
LIMIT 10
```

---

## Conversational Flow

The presenter supports multi-turn exploration:

```
User: "What do I know about Python?"
Agent: [shows Python entity + 4 connections]

User: "Tell me more about the FastAPI connection"
Agent: → remembers context → fetches FastAPI detail
       [shows FastAPI entity + its connections]

User: "What else connects to both of those?"
Agent: → generates intersection query
```

```cypher
-- "What connects to both X and Y?"
MATCH (a:Entity)<--(shared)-->(b:Entity)
WHERE a.name = 'Python' AND b.name = 'FastAPI'
RETURN shared.name, labels(shared)[0] AS type, shared.summary
```

### Context Memory

Within a conversation, the presenter tracks:

- **Last entity mentioned** — for "tell me more" follow-ups
- **Last query results** — for "what about #3?" references
- **Exploration path** — for "go back" or "go deeper"

This context is session-scoped — it resets between conversations.

---

## Visual Formatting

### ASCII Trees

For hierarchical relationships:

```
Knowledge Gardener (project)
├── IS_PART_OF ← Python (concept)
│   ├── RELATES_TO → FastAPI (tool)
│   └── RELATES_TO → Neo4j Driver (tool)
├── IS_PART_OF ← Neo4j (tool)
└── TAGGED → #knowledge, #agent
```

### Tables

For flat result sets:

```
| Name            | Type    | Importance | Last Updated |
|-----------------|---------|------------|--------------|
| Python          | concept | ★★★★      | 2 days ago   |
| FastAPI         | tool    | ★★★★      | 5 days ago   |
| Docker          | tool    | ★★        | 15 days ago  |
```

### Connection Maps

For relationship exploration:

```
      ┌─── RELATES_TO ──→ FastAPI
      │
Python ├─── RELATES_TO ──→ Neo4j Driver
      │
      ├─── TAGGED ───────→ #backend
      │
      └─── IS_PART_OF ──← Knowledge Gardener
```

### Timelines

For temporal data:

```
Feb 15 ── Python added
Feb 16 ── FastAPI added, linked to Python
Feb 18 ── Neo4j Driver added
Feb 20 ── Knowledge Gardener created, linked to all
───────|──────────|──────────|──────────|────
     Feb 15    Feb 16    Feb 18    Feb 20
```

---

## Safety Rules

1. **Read-only by default** — The presenter uses `read_neo4j_cypher` exclusively
2. **No destructive queries** — Never generate `DELETE` or `DETACH DELETE`
3. **Result limits** — Always include `LIMIT` (max 30 for lists, 5 for paths)
4. **Timeout respect** — 30-second query timeout; if results take longer, suggest narrowing the query
5. **Parameterised queries** — Always use `$params` for user input to prevent injection

```cypher
-- GOOD: parameterised
MATCH (e:Entity) WHERE toLower(e.name) CONTAINS toLower($name)
RETURN e LIMIT 10

-- BAD: string interpolation
MATCH (e:Entity) WHERE e.name = 'user input here'
```

---

## Error Handling

| Situation | Response |
|-----------|----------|
| No results | "I didn't find anything matching '{query}'. Try a broader term, or ask what's in the graph with 'show me the big picture'." |
| Ambiguous entity | "I found multiple matches: [list]. Which one?" |
| Query too broad | "That returned a lot of results (50+). Can you narrow it down? For example: 'show Python connections' or 'find entities tagged as backend'." |
| MCP timeout | "That query took too long — the graph might be large. Try being more specific." |
| MCP unavailable | "I can't reach the graph database right now. Is Neo4j running?" |
| Schema unknown | Fetch schema first: "Let me check what's in the graph..." → `get_neo4j_schema` |

---

## Example Session

A full conversational flow showing the presenter in action:

```
User: "Hey, what's in my knowledge graph?"
Agent: "Let me check...

        📊 Your graph has 47 entities, 12 notes, 8 sources, and 15 tags.

        Top 3 by connections:
        1. Knowledge Gardener (project, 12 connections)
        2. Python (concept, 8 connections)
        3. Neo4j (tool, 6 connections)

        Want to explore any of these?"

User: "Yeah, show me Python's neighborhood"
Agent: "Python (concept) ★★★★

        Python is a high-level programming language used as the
        primary backend language.

        ┌─── RELATES_TO ──→ FastAPI (tool)
        │
        Python ├─── RELATES_TO ──→ Neo4j Driver (tool)
        │
        ├─── RELATES_TO ──→ Pydantic (tool)
        │
        ├─── TAGGED ───────→ #backend
        │
        └─── IS_PART_OF ──← Knowledge Gardener (project)

        5 direct connections. Go deeper into any of these?"

User: "How does FastAPI connect to Neo4j?"
Agent: "Shortest path (2 hops):

        FastAPI → RELATES_TO → Python → RELATES_TO → Neo4j Driver
                                        → RELATES_TO → Neo4j

        They're connected through Python — FastAPI uses Python,
        which uses the Neo4j Driver to talk to Neo4j.

        Want to see alternative paths?"

User: "Nah, what's been added this week?"
Agent: "This week's additions (3 items):

        Feb 20: 'Presenter Agent' (concept) — added today
        Feb 19: 'MCP Protocol' (concept) — model context protocol
        Feb 18: 'Agent Roles' (collection) — grouping agent docs

        Quiet week! Want to add anything?"
```

---

## Cross-References

- **[chat_handler.md](./chat_handler.md)** — Routes exploration intents to the presenter
- **[identity.md](./identity.md)** — Context budget and formatting rules apply
- **[curator.md](./curator.md)** — Presenter can surface curation suggestions during exploration
