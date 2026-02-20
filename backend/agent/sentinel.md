# Knowledge Gardener — Sentinel

> **Trigger:** Scheduled (cron) — runs periodically, higher priority than curation
>
> **Reference:** Read [identity.md](./identity.md) first — all core principles and context budgets apply here.

---

## Overview

The sentinel is the agent's **integrity watchdog**. While the curator handles quality and tidiness, the sentinel looks for **problems** — contradictions, broken dependencies, stale data that could mislead the user.

It never fixes problems silently. It raises alerts with clear severity levels so the user can decide what to act on.

---

## Severity Levels

| Level | Icon | Meaning | Example |
|-------|------|---------|---------|
| **Critical** | 🔴 | Active contradiction or data loss risk | Two entities claim opposite facts |
| **Warning** | 🟡 | Something is likely wrong, needs attention | Superseded entity still marked active |
| **Info** | 🔵 | Worth knowing, no immediate risk | Source URI may be dead |

---

## Check 1: Contradiction Detection

**Goal:** Find entities that explicitly or implicitly conflict.

### Explicit Contradictions

Entities already linked with `CONTRADICTS`:

```cypher
MATCH (a)-[r:CONTRADICTS]->(b)
WHERE a.status = 'active' AND b.status = 'active'
RETURN a.id, a.name, a.summary,
       b.id AS conflict_id, b.name AS conflict_name, b.summary AS conflict_summary,
       r.context AS reason, r.created_at
ORDER BY r.created_at DESC
LIMIT 10
```

### Implicit Contradictions

Entities that may conflict based on content. This requires comparing entity summaries for semantic tension. Heuristics:

1. Two entities with the same `entity_type` and similar names but different summaries
2. Notes tagged as `decision` that reference the same entity but reach different conclusions
3. Entities where one says "X uses Y" and another says "X does not use Y"

### Alert Format

```
🔴 CRITICAL — Active contradictions:

1. "Deployment Strategy" (concept) CONTRADICTS "Migration Plan" (concept)
   Context: "Deployment says blue-green, migration says rolling update"
   Both are marked active. Resolve:
   → Archive one?
   → Update to reconcile?
   → Keep both with explicit note?
```

---

## Check 2: Circular Dependencies

**Goal:** Find dependency cycles that make no logical sense.

### Method

```cypher
-- Detect cycles in DEPENDS_ON relationships
MATCH path = (a:Entity)-[:DEPENDS_ON*2..5]->(a)
RETURN [n IN nodes(path) | n.name] AS cycle,
       length(path) AS cycle_length
LIMIT 5
```

### Alert Format

```
🟡 WARNING — Circular dependency detected:

"A" DEPENDS_ON → "B" DEPENDS_ON → "C" DEPENDS_ON → "A"

This means none of them can be started independently.
Was this intentional?
→ Remove one dependency?
→ Add a note explaining the cycle?
```

---

## Check 3: Stale Supersessions

**Goal:** When entity A `SUPERSEDES` entity B, B should typically be archived.

### Method

```cypher
MATCH (a:Entity)-[:SUPERSEDES]->(b:Entity)
WHERE b.status = 'active'
RETURN a.id, a.name AS new_entity,
       b.id AS old_id, b.name AS old_entity,
       b.status AS old_status
LIMIT 10
```

### Alert Format

```
🟡 WARNING — Superseded entities still active:

1. "Neo4j Schema v2" SUPERSEDES → "Neo4j Schema v1"
   But "Neo4j Schema v1" is still marked 'active'.
   → Archive it?
   → Both are still valid?
```

---

## Check 4: Source Rot

**Goal:** Flag sources with URIs that may no longer be valid.

### Method

This check is informational — the agent doesn't make HTTP requests from the graph query. Instead, it flags sources based on age and type:

```cypher
MATCH (s:Source)
WHERE s.source_type = 'url'
  AND s.ingested_at < datetime() - duration({days: 90})
RETURN s.id, s.name, s.uri, s.summary,
       duration.between(s.ingested_at, datetime()).days AS days_old
ORDER BY days_old DESC
LIMIT 10
```

In future, an external health-check service could verify URIs and update the source status.

### Alert Format

```
🔵 INFO — Sources older than 90 days (may be stale):

1. "Neo4j 4.x Docs" (url) — 120 days old
   URI: https://neo4j.com/docs/4.x/
   → Still valid? Mark as checked or archive?

2. "Architecture Blog Post" (url) — 95 days old
   URI: https://example.com/old-post
   → Verify link?
```

---

## Check 5: Importance Drift

**Goal:** Flag high-importance entities that show no recent activity.

### Method

```cypher
MATCH (e:Entity)
WHERE e.importance >= 4
  AND e.status = 'active'
  AND e.updated_at < datetime() - duration({days: 21})
  AND NOT (e)<-[:ABOUT]-(:Note {note_type: 'log'})  -- no recent logs about it
RETURN e.id, e.name, e.entity_type, e.importance,
       duration.between(e.updated_at, datetime()).days AS days_inactive
ORDER BY e.importance DESC, days_inactive DESC
LIMIT 10
```

### Alert Format

```
🟡 WARNING — High-importance entities going dormant:

1. "Knowledge Gardener" (project, ★★★★★) — 25 days inactive
   This is your top-priority project with no recent updates.
   → Add a status update?
   → Lower importance?
   → Still actively working on it?
```

---

## Check 6: Dangling Relationships

**Goal:** Find relationships pointing to nodes that no longer exist (should be rare with `DETACH DELETE`, but worth checking).

### Method

```cypher
-- This shouldn't happen with DETACH DELETE, but defensive check
MATCH ()-[r]->()
WHERE NOT exists { MATCH (startNode(r)) }
   OR NOT exists { MATCH (endNode(r)) }
RETURN type(r), id(r)
LIMIT 10
```

---

## Sentinel Report

The sentinel produces a prioritised digest, ordered by severity:

```
🛡️ Sentinel Report — Feb 20, 2026

🔴 CRITICAL (1)
   1. Active contradiction: "Deployment Strategy" ↔ "Migration Plan"

🟡 WARNING (3)
   2. Superseded entity still active: "Neo4j Schema v1"
   3. Circular dependency: A → B → C → A
   4. High-importance dormant: "Knowledge Gardener" (25 days)

🔵 INFO (2)
   5. Source may be stale: "Neo4j 4.x Docs" (120 days)
   6. Source may be stale: "Architecture Blog Post" (95 days)

Total issues: 6 (1 critical, 3 warnings, 2 info)
Reply with a number to address, or "ack" to acknowledge all.
```

---

## Escalation Policy

| Severity | Delivery | User action required |
|----------|----------|---------------------|
| Critical | Immediate notification (if possible) + next chat session | Yes, must resolve |
| Warning | Included in scheduled report | Recommended |
| Info | Included in scheduled report | Optional |

If critical issues persist for more than 3 report cycles without resolution, escalate the alert format:

```
🔴🔴 RECURRING CRITICAL — "Deployment Strategy" ↔ "Migration Plan"
     contradiction has been unresolved for 3 cycles (9 days).
     This may be causing confusion in related entities.
```
