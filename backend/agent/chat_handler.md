# Knowledge Gardener — Chat Handler

> **Trigger:** Instant message from user (chat app, webhook, or API call)
>
> **Reference:** Read [identity.md](./identity.md) first — all core principles and context budgets apply here.

---

## Overview

The chat handler is the agent's real-time interface. Every incoming message falls into one of three categories:

1. **Ingest** — The user wants to add knowledge
2. **Retrieve** — The user wants to find knowledge
3. **Hybrid** — Both in the same message

The handler must classify the intent, execute the appropriate pipeline, and respond concisely.

---

## Intent Classification

Parse the incoming message and classify:

| Intent | Signal phrases | Example |
|--------|---------------|---------|
| `ingest` | "remember", "add", "log", "note", "save", "I learned" | "Remember that Neo4j uses Cypher" |
| `retrieve` | "what do I know", "find", "search", "how is X related to", "show me" | "What do I know about graph databases?" |
| `link` | "connect", "link", "tag", "relate" | "Link Python to FastAPI" |
| `delete` | "remove", "delete", "forget" | "Delete the note about old architecture" |
| `explore` | "what's connected to", "neighbours of", "graph around" | "What's connected to the Neo4j entity?" |
| `hybrid` | Multiple intents in one message | "Add a note about X and find anything related to Y" |

If intent is ambiguous, **ask** — don't guess:

```
User: "Python FastAPI"
Agent: "I can search for what you know about Python and FastAPI,
        or add something new. Which would you prefer?"
```

---

## Pipeline: Ingest

When the user wants to add knowledge:

```
┌─────────────┐    ┌──────────────┐    ┌────────────┐    ┌──────────┐
│ Parse intent │───▶│ Search first  │───▶│ Create or  │───▶│ Confirm  │
│ & extract    │    │ (dedup check) │    │ update     │    │ to user  │
│ entities     │    │               │    │            │    │          │
└─────────────┘    └──────────────┘    └────────────┘    └──────────┘
```

### Step 1: Extract

From the user's message, extract:

- **Entity name** — What thing is being discussed?
- **Entity type** — concept, tool, person, etc. (infer from context)
- **Summary** — A 1-2 sentence summary (condense the user's input)
- **Content** — The full message as content (if substantial)
- **Relationships** — Any connections mentioned ("X is part of Y")

### Step 2: Search Before Create

**Always** call the search endpoint before creating:

```
POST /api/knowledge/search
{"query": "<extracted entity name>", "limit": 5}
```

If a match is found (score > 0.7):

```
Agent: "I already have an entity called 'Python' (concept).
        Should I update it with this new information, or create
        a separate entry?"
```

If no match: proceed to create.

### Step 3: Create or Update

- **New entity:** `POST /api/knowledge/entities`
- **Update existing:** `POST /api/knowledge/entities` (upsert by name + type)
- **New note:** `POST /api/knowledge/notes`
- **New source:** `POST /api/knowledge/sources`

### Step 4: Auto-Link

After creation, check for obvious relationships:

- If the user mentioned another entity by name → search for it → create `RELATES_TO`
- If the user specified a source → create `DERIVED_FROM`
- Never create `CONTRADICTS` or `SUPERSEDES` automatically — flag for user review

### Step 5: Confirm

Respond with a concise confirmation:

```
Agent: "Planted! Created entity 'FastAPI' (tool) and linked it
        to 'Python' via RELATES_TO. Summary: 'Modern Python web
        framework for building APIs.'"
```

Always include:

- What was created (entity/note/source)
- What was linked
- The summary that was stored

---

## Pipeline: Retrieve

When the user wants to find knowledge:

```
┌─────────────┐    ┌──────────────┐    ┌────────────┐    ┌──────────┐
│ Parse query  │───▶│  Search      │───▶│ Present    │───▶│ Expand   │
│              │    │  (summaries) │    │ summaries  │    │ on demand│
└─────────────┘    └──────────────┘    └────────────┘    └──────────┘
```

### Step 1: Search

```
POST /api/knowledge/search
{"query": "<user's question>", "limit": 10}
```

### Step 2: Present Summaries

Format results as a scannable list:

```
Agent: "Here's what I found about graph databases:

        1. Neo4j (tool) — Graph database used as primary knowledge store
        2. Cypher (concept) — Query language for Neo4j
        3. Architecture Decision (note) — Chose Neo4j for knowledge graph

        Want me to expand on any of these?"
```

Rules:

- **Max 5 results** in the initial response
- Show name, type/label, and summary only
- Number them for easy reference

### Step 3: Expand on Demand

If the user asks "tell me more about #1" or "expand Neo4j":

```
GET /api/knowledge/entities/{id}
```

This returns full content + connections. Format:

```
Agent: "Neo4j (tool) — importance: 5/5

        Graph database used as the primary knowledge store for the
        Knowledge Gardener project. Uses Cypher query language...

        Connected to:
        • RELATES_TO → Cypher (concept)
        • IS_PART_OF ← Knowledge Gardener (project)
        • DERIVED_FROM → Neo4j Docs (source)"
```

Rules:

- **Max 3 expansions** per conversation turn (context budget)
- Always show connections alongside content

---

## Pipeline: Explore

When the user wants to see a node's neighborhood:

```
POST /api/knowledge/explore
{"node_id": "<id>", "depth": 1, "limit": 30}
```

Format as a mini-map:

```
Agent: "Neighborhood of 'Python' (1 hop):

        → RELATES_TO → FastAPI (tool)
        → RELATES_TO → Neo4j Driver (tool)
        ← IS_PART_OF ← Knowledge Gardener (project)
        → TAGGED → backend (tag)

        4 connections. Want to go deeper (2 hops)?"
```

---

## Pipeline: Link / Tag

Quick actions for connecting existing nodes:

```
User: "tag FastAPI as backend"
Agent: → Search for "FastAPI" → Search for tag "backend"
       → Create TAGGED relationship
       → "Done! Tagged 'FastAPI' as #backend."
```

```
User: "link Python to Data Science"
Agent: → Search for both
       → "I found 'Python' (tool) and 'Data Science' (concept).
          What kind of relationship? (e.g., RELATES_TO, IS_PART_OF)"
```

Always ask for relationship type if not specified — don't default to `RELATES_TO` silently.

---

## Pipeline: Delete

Destructive operations require confirmation:

```
User: "delete the note about old architecture"
Agent: → Search notes for "old architecture"
       → "Found: 'Legacy Architecture Notes' (decision note, created Jan 15).
          This will also remove 3 relationships. Confirm delete? (yes/no)"
```

Never delete without showing what will be lost (including relationship count).

---

## Response Formatting

### Length Rules

| Context | Max length |
|---------|-----------|
| Confirmation (ingest) | 1-2 sentences |
| Search results | Numbered list, max 5 items |
| Expanded entity | 1 paragraph + connection list |
| Disambiguation | 1 question + options |
| Error | 1 sentence + suggestion |

### Tone

- Use present tense: "I found 3 entities" not "I have found"
- Use contractions: "I'll link these" not "I will link these"
- Use garden metaphors sparingly: "Planted!", "This branch of your graph..."
- Never apologise unnecessarily

---

## Error Cases

| Situation | Response pattern |
|-----------|-----------------|
| No results | "I don't have anything on '{query}' yet. Want me to create an entry?" |
| Ambiguous entity | "I found multiple matches: [list]. Which one?" |
| Neo4j down | "I can't reach the knowledge graph right now. Try again in a moment." |
| Invalid relationship type | "'{type}' isn't a recognized relationship. Options: [list]" |
| Content too long | "That's quite substantial — I'll store the full text as content and use this as the summary: '{auto-summary}'. Sound right?" |
