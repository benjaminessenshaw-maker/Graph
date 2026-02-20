# Knowledge Graph — Visual Brainstorm

*Feb 20, 2026 — Raw ideas, recomposed.*

---

## The Vision

A **graphical overlay** of the Neo4j knowledge graph where every visual property carries meaning. Not just a pretty graph — a **control surface** where you can see, understand, and manipulate your entire knowledge base at a glance.

---

## Idea 1: Semantic Node Encoding

Every visual attribute of a node communicates something from the database:

### Shape → Entity Type

| Shape | Meaning |
|-------|---------|
| Circle | Concept |
| Rounded rectangle | Tool |
| Hexagon | Project |
| Diamond | Decision / Note |
| Square | Source |
| Small circle | Tag |

### Colour → Category or Domain

Fill colour maps to a domain or collection. Nodes in the same collection share a hue:

- Blues for tech infrastructure
- Greens for active projects
- Purples for people/orgs
- Greys for archived

### Rings → Status & Urgency

Concentric rings around nodes encode dynamic state:

| Ring Colour | Meaning |
|-------------|---------|
| 🟡 Yellow | Has a deadline (task) |
| 🔴 Red | Blocking other nodes (`BLOCKS` relationship active) |
| 🟢 Green | Completed (`completed_at` is set) |
| 🔵 Blue | Recently updated (within 7 days) |
| ⚪ Grey dashed | Stale (not updated in 30+ days) |

Multiple rings can stack — a node with a yellow + red ring is a **task that's blocking something**.

### Size → Importance

Node radius scales with `importance` (1-5). High-importance nodes are visually dominant.

---

## Idea 2: Click-to-Edit

Clicking a node opens an **inline editor** — not a separate page, but something overlaid or docked beside the graph:

- **Edit any property** — name, summary, content, importance, status
- **Add/remove tags** — chip-style tag editor
- **Create relationships** — drag from one node to another, pick relationship type
- **Set deadlines** — date picker for `due_date`, `start_date`
- **Mark done** — one-click complete button
- **View full content** — expandable panel for long-form notes

Changes save directly to Neo4j via the API.

---

## Idea 3: Agent Nodes (In the Graph)

~~Originally "ghost nodes" — virtual nodes rendered from config files.~~

**Revised:** Agent patterns live **in Neo4j as regular entities**. They're not separate from the graph — they *are* the graph. A cron job that reads entities is a node with `READS_FROM` edges. A tool integration is a node with `CALLS` edges. One source of truth, one set of CRUD operations, one click-to-edit UI.

### New Entity Types

```
entity_type: "automation"    → Cron jobs, scheduled tasks
entity_type: "agent"         → Agent patterns (curator, sentinel, etc.)
entity_type: "integration"   → External tool connections (Notion, Calendar, MCP)
```

### New Relationship Types

| Relationship | Direction | Meaning |
|---|---|---|
| `READS_FROM` | automation → entity | This automation reads from these nodes |
| `WRITES_TO` | automation → entity | This automation writes to these nodes |
| `TRIGGERS` | automation → automation | Completing this triggers that |
| `CALLS` | integration → external | This integration calls an external service |

### New Properties (on automation/agent/integration nodes)

| Property | Type | Description |
|----------|------|-------------|
| `schedule` | String | Cron expression (e.g. `0 3 * * *`) |
| `enabled` | Boolean | Is this active? |
| `last_run` | DateTime | When it last executed |
| `next_run` | DateTime | When it next runs |
| `run_status` | String | `success`, `failed`, `running` |

### Examples in the Graph

```
[Daily Curation]  ──READS_FROM──→  [all Entity nodes]
  (automation)    ──WRITES_TO───→  [Curation Report] (note)
  schedule: "0 3 * * *"
  enabled: true
  last_run: 2026-02-20T03:00:00

[Sentinel Check]  ──READS_FROM──→  [all Entity nodes]
  (automation)    ──WRITES_TO───→  [Sentinel Report] (note)

[Notion Import]   ──CALLS──→  (external: Notion API)
  (integration)   ──WRITES_TO──→  [Entity nodes it creates]

[MCP Cypher]      ──READS_FROM──→  [all nodes]
  (integration)   ──CALLS──→  (external: Neo4j MCP Server)
```

### Visual Treatment

Still visually distinct — but driven by `entity_type`, not a separate data source:

- **Dashed borders** for automation/agent/integration types
- **Gear icon** for automations, **bolt icon** for integrations, **robot icon** for agents
- **Pulsing ring** if `run_status: "running"`
- **Red ring** if `run_status: "failed"`

### Why this is better than config files

1. **Single source of truth** — no drift between config and reality
2. **Existing CRUD** — same API, same search, same click-to-edit
3. **Native relationships** — `READS_FROM` / `WRITES_TO` are just edges
4. **Searchable** — "What automations touch my Python entity?" is a query
5. **Taggable** — tag automations the same way you tag concepts

---

## Feasibility Assessment

### ✅ Highly Feasible (can build now)

| Feature | Why | Tech |
|---------|-----|------|
| Shape by type | ReactFlow supports custom node components | Custom SVG node renderers |
| Colour by category | Simple property → colour mapping | CSS/SVG fill |
| Size by importance | Scale transform on node component | ReactFlow node dimensions |
| Click-to-edit panel | Side panel or modal with form | React state + API calls |
| Rings for status | SVG circles around node with conditional rendering | SVG `<circle>` elements |
| Agent nodes in Neo4j | Just new entity types + relationship types | Schema extension |

### ⚠️ Moderate Effort (needs design work)

| Feature | Challenge | Approach |
|---------|-----------|----------|
| Multiple stacked rings | SVG layout without clutter | Pre-calculate positions, limit to 3 max |
| Drag-to-connect | Need relationship type picker | Custom connection handler + dropdown |
| Real-time save | Optimistic updates + rollback | React Query mutations |
| Ring for `BLOCKS` | Need relationship traversal | Computed field via API |
| Cron trigger from UI | Need a job runner | Start with manual trigger, add scheduling later |

### 🚫 Watch-outs

1. **Visual clutter** — Need a **filter panel** to toggle layers
2. **Performance** — ReactFlow handles ~500 nodes well, virtualize beyond that
3. **Colourblind accessibility** — Add icons alongside ring colours

---

## Suggested Build Order

1. **Custom node components** — shape by type, size by importance, colour by category
2. **Status rings** — single ring first (blocking = red, done = green), then stack
3. **Click-to-edit panel** — side panel with property editor
4. **Filter controls** — toggle layers on/off
5. **Agent nodes** — new entity types with schema extension
6. **Drag-to-connect** — relationship creation via drag
