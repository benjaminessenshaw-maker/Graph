# Knowledge Gardener — Curator

> **Trigger:** Scheduled (cron) — runs periodically (e.g., daily at 3 AM, or weekly)
>
> **Reference:** Read [identity.md](./identity.md) first — all core principles and context budgets apply here.

---

## Overview

The curator is the agent's **maintenance mode**. It runs unattended, scans the graph for quality issues, and produces a report for the user. It never deletes or mutates data autonomously — it **proposes** changes and waits for approval.

Think of it as weeding, pruning, and composting — but the user holds the shears.

---

## Run Frequency

| Task | Suggested frequency | Priority |
|------|-------------------|----------|
| Deduplication scan | Daily | High |
| Orphan detection | Daily | Medium |
| Staleness check | Weekly | Medium |
| Summary freshness | Weekly | Low |
| Tag hygiene | Weekly | Low |
| Relationship enrichment | Weekly | Low |

These can be adjusted based on graph size. A small graph (<100 nodes) doesn't need daily runs.

---

## Task 1: Deduplication Scan

**Goal:** Find entities that likely represent the same thing.

### Method

```cypher
-- Find entities with similar names
MATCH (a:Entity), (b:Entity)
WHERE a.id < b.id
  AND a.entity_type = b.entity_type
  AND (
    toLower(a.name) = toLower(b.name)
    OR a.name CONTAINS b.name
    OR b.name CONTAINS a.name
  )
RETURN a.id, a.name, a.summary,
       b.id AS dup_id, b.name AS dup_name, b.summary AS dup_summary
LIMIT 10
```

For fuzzy matching, also compare summaries using the full-text index.

### Report Format

```
🔍 Potential duplicates found:

1. "Python" (concept) ↔ "python" (concept)
   Summaries: "High-level programming language" vs "Interpreted language for scripting"
   → Recommend: MERGE (same entity, different summaries)

2. "FastAPI" (tool) ↔ "Fast API" (tool)
   → Recommend: MERGE (likely typo in name)
```

### User Actions

- **Merge** → Combine properties, keep the more complete record, redirect relationships
- **Keep both** → Mark as reviewed (add `SIMILAR_TO` relationship to prevent re-flagging)
- **Dismiss** → Ignore this pair permanently

---

## Task 2: Orphan Detection

**Goal:** Find nodes with zero relationships — they're disconnected from the knowledge graph.

### Method

```cypher
MATCH (n)
WHERE NOT (n)--()
  AND NOT n:Tag  -- Tags can exist without connections initially
RETURN n.id, labels(n)[0] AS label,
       COALESCE(n.name, n.title) AS name, n.summary
ORDER BY n.created_at DESC
LIMIT 20
```

### Report Format

```
🌱 Orphaned nodes (no connections):

1. "Docker Compose" (tool) — created 3 days ago, never linked
   → Suggest: Link to "Docker" (RELATES_TO) or "DevOps" (TAGGED)?

2. "Meeting notes Jan 15" (note) — created 5 days ago
   → Suggest: Link to a project or person?
```

### User Actions

- **Accept suggestion** → Agent creates the relationship
- **Custom link** → User specifies the connection
- **Archive** → Move to status: `archived`
- **Delete** → Remove the node

---

## Task 3: Staleness Check

**Goal:** Surface entities that haven't been touched in a while for review.

### Method

```cypher
MATCH (e:Entity)
WHERE e.status = 'active'
  AND e.updated_at < datetime() - duration({days: 30})
RETURN e.id, e.name, e.entity_type, e.summary, e.importance,
       e.updated_at,
       duration.between(e.updated_at, datetime()).days AS days_stale
ORDER BY e.importance DESC, days_stale DESC
LIMIT 15
```

### Report Format

```
🍂 Stale entities (not updated in 30+ days):

High importance:
1. "Knowledge Gardener" (project, ★★★★★) — 45 days stale
2. "Neo4j Schema" (concept, ★★★★) — 32 days stale

Low importance:
3. "Meeting Room B" (place, ★★) — 60 days stale
   → Suggest: Archive?
```

### Thresholds

| Importance | Stale after |
|-----------|-------------|
| 5 (critical) | 14 days |
| 4 (high) | 21 days |
| 3 (medium) | 30 days |
| 1-2 (low) | 60 days |

---

## Task 4: Summary Freshness

**Goal:** Detect entities where `content` has been updated but `summary` is outdated.

### Method

Compare `content` word count or hash against `summary` currency. In practice, flag entities where `updated_at` is recent but `summary` hasn't been regenerated.

### Report Format

```
📝 Summaries may need refresh:

1. "API Architecture" (concept) — content updated 2 days ago,
   summary still reads: "Initial API design notes"
   → Suggest new summary: "RESTful API with Neo4j backing store,
     featuring knowledge-specific endpoints"
```

The agent proposes a new summary; the user confirms.

---

## Task 5: Tag Hygiene

**Goal:** Keep the tag system clean and useful.

### Checks

1. **Unused tags** — Tags with zero `TAGGED` relationships
2. **Tag synonyms** — Tags with similar names (`backend` vs `back-end`)
3. **Tag proliferation** — Entity/tag ratio too high (more tags than useful)

### Method

```cypher
-- Find unused tags
MATCH (t:Tag)
WHERE NOT (t)<-[:TAGGED]-()
RETURN t.id, t.name, t.color
```

```cypher
-- Find tags with similar names
MATCH (a:Tag), (b:Tag)
WHERE a.id < b.id
  AND (
    toLower(a.name) = toLower(b.name)
    OR a.name CONTAINS b.name
  )
RETURN a.name, b.name
```

### Report Format

```
🏷️ Tag hygiene:

Unused: #meetings, #temp
Possible synonyms: #backend ↔ #back-end
Suggest: Merge #back-end into #backend?
```

---

## Task 6: Relationship Enrichment

**Goal:** Discover implicit connections the user hasn't made explicit.

### Method

Look for entities that share multiple tags, are mentioned in the same notes, or appear in the same collections but aren't directly linked.

```cypher
-- Entities sharing 2+ tags but not directly connected
MATCH (a:Entity)-[:TAGGED]->(t:Tag)<-[:TAGGED]-(b:Entity)
WHERE a.id < b.id
  AND NOT (a)--(b)
WITH a, b, collect(t.name) AS shared_tags
WHERE size(shared_tags) >= 2
RETURN a.name, b.name, shared_tags
LIMIT 10
```

### Report Format

```
🌿 Potential connections:

1. "Python" ↔ "Data Science" — share tags: #backend, #analytics
   → Suggest: Create RELATES_TO?

2. "FastAPI" ↔ "Neo4j" — both in collection "Tech Stack"
   → Suggest: Create RELATES_TO with context "both in tech stack"?
```

---

## Curation Report

All tasks produce a single combined report, delivered to the user via chat:

```
🌻 Daily Garden Report — Feb 20, 2026

📊 Graph: 47 entities, 12 notes, 8 sources, 15 tags, 3 collections

🔍 Duplicates: 2 pairs found
🌱 Orphans: 3 disconnected nodes
🍂 Stale: 5 entities need attention (2 high-importance)
📝 Summaries: 1 needs refresh
🏷️ Tags: 2 unused, 1 synonym pair
🌿 Suggestions: 4 potential new connections

Reply with a number to review details, or "skip" to dismiss.
```

The user can drill into any section. The agent uses the same two-tier retrieval — summaries in the report, full details on demand.
