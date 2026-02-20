# Knowledge Gardener — Scheduler

> **Trigger:** Mixed — scheduled checks (cron) + chat requests ("what's due?")
>
> **Reference:** Read [identity.md](./identity.md) first — all core principles and context budgets apply here.

---

## Overview

The scheduler extends the knowledge graph with **temporal awareness** — deadlines, events, dependencies-over-time, and proactive reminders. It transforms the static knowledge graph into a living timeline.

> [!NOTE]
> **This is a vision document.** Calendar and Gantt features require schema extensions not yet implemented. This doc defines the protocol so the schema, API, and UI can be built to match.

---

## Schema Extensions Required

These properties and types need to be added to the existing schema:

### New Properties on `:Entity`

| Property | Type | Description |
|----------|------|-------------|
| `due_date` | Date | Deadline (for tasks, milestones) |
| `start_date` | Date | Start date (for events, projects) |
| `end_date` | Date | End date (for events, project phases) |
| `recurrence` | String | Cron-like pattern: `daily`, `weekly`, `monthly`, or `RRULE` string |
| `completed_at` | DateTime | When this was marked done (null = not done) |

### New Note Type

| Type | Use for |
|------|---------|
| `reminder` | Time-triggered notes that surface automatically |

### New Relationship Type

| Relationship | Direction | Description |
|---|---|---|
| `-[:BLOCKS]->` | Entity → Entity | Stronger than `DEPENDS_ON` — B **cannot start** until A completes |

---

## Mode 1: Proactive Checks (Scheduled)

### Check: Upcoming Deadlines

Runs daily. Surfaces what's due soon.

```cypher
MATCH (e:Entity)
WHERE e.due_date IS NOT NULL
  AND e.completed_at IS NULL
  AND e.due_date <= date() + duration({days: 7})
RETURN e.id, e.name, e.entity_type, e.summary,
       e.due_date,
       duration.between(date(), e.due_date).days AS days_until_due
ORDER BY e.due_date ASC
LIMIT 15
```

#### Alert Format

```
📅 This week's deadlines:

🔴 OVERDUE:
   1. "Submit proposal" (event) — due 2 days ago!

🟡 DUE SOON:
   2. "Code review" (project) — due tomorrow
   3. "Weekly report" (event) — due in 3 days

🟢 LATER:
   4. "Design review" (event) — due in 6 days
```

### Check: Blocked Tasks

Find tasks that can't start because their blockers aren't done.

```cypher
MATCH (blocked:Entity)-[:BLOCKS]->(blocker:Entity)
WHERE blocker.completed_at IS NULL
  AND blocked.due_date IS NOT NULL
RETURN blocked.name AS waiting_task, blocked.due_date,
       blocker.name AS blocked_by, blocker.summary
ORDER BY blocked.due_date ASC
LIMIT 10
```

#### Alert Format

```
🚧 Blocked tasks:

1. "Deploy v2" (due Feb 25) — blocked by "Code review" (not done)
   ⚠️ If "Code review" isn't done by Feb 23, "Deploy v2" will be late.

2. "Client demo" (due Mar 1) — blocked by "Deploy v2" (not done)
   → This is a chain: Code review → Deploy v2 → Client demo
```

### Check: Overdue Items

```cypher
MATCH (e:Entity)
WHERE e.due_date IS NOT NULL
  AND e.completed_at IS NULL
  AND e.due_date < date()
RETURN e.id, e.name, e.summary, e.due_date,
       duration.between(e.due_date, date()).days AS days_overdue
ORDER BY days_overdue DESC
LIMIT 10
```

---

## Mode 2: Chat Requests

Users can ask schedule-related questions via chat. These are handled by [chat_handler.md](./chat_handler.md) but routed to scheduler logic.

### "What's due this week?"

→ Run upcoming deadlines query, format as scannable list.

### "When is X due?"

→ Look up specific entity, return `due_date` and status.

### "Set deadline for X to March 15"

→ Find entity, set `due_date = date('2026-03-15')`, confirm.

### "Mark X as done"

→ Set `completed_at = datetime()`, confirm, check if this unblocks anything:

```
Agent: "Marked 'Code review' as done! ✅
        This unblocks: 'Deploy v2' (due Feb 25).
        'Deploy v2' can now proceed."
```

### "What depends on X?"

→ Traverse `DEPENDS_ON` and `BLOCKS` from X, show the chain:

```
Agent: "Dependency chain from 'Code review':
        → BLOCKS → Deploy v2 (due Feb 25)
          → BLOCKS → Client demo (due Mar 1)
        
        Completing 'Code review' unblocks 2 downstream tasks."
```

### "Show me a timeline"

→ Return all entities with dates, ordered chronologically:

```
Agent: "Timeline for next 2 weeks:

        Feb 20 ─── Code review (due)
        Feb 23 ─── Deploy v2 (due, depends on code review)
        Feb 25 ─── Sprint retrospective (event)
        Mar 01 ─── Client demo (due, depends on deploy)
        
        ░░░░░░░░░░|░░░░░░░░░░|░░░░░░░░░░|
        Feb 20    Feb 25    Mar 01"
```

---

## Mode 3: Gantt-Like Dependency Visualization

### Concept

A Gantt view is a **projection** of the knowledge graph, not a separate data store. It reads:

- Entities with `start_date` and `end_date` → horizontal bars
- `BLOCKS` relationships → dependency arrows
- `completed_at` → progress markers
- Entity `importance` → visual priority

### Data Query

```cypher
MATCH (e:Entity)
WHERE e.start_date IS NOT NULL OR e.due_date IS NOT NULL
OPTIONAL MATCH (e)-[:BLOCKS]->(blocker:Entity)
RETURN e.id, e.name, e.entity_type,
       e.start_date, e.end_date, e.due_date,
       e.completed_at, e.importance,
       collect({
         blocker_id: blocker.id,
         blocker_name: blocker.name,
         blocker_done: blocker.completed_at IS NOT NULL
       }) AS dependencies
ORDER BY COALESCE(e.start_date, e.due_date) ASC
```

### Future UI Integration

The Gantt view would be rendered in the frontend (ReactFlow or a dedicated library like `frappe-gantt`), consuming the `/api/knowledge/timeline` endpoint (not yet implemented).

---

## Recurrence

Recurring events use a simple pattern system:

| Pattern | Meaning |
|---------|---------|
| `daily` | Every day |
| `weekly` | Every 7 days |
| `biweekly` | Every 14 days |
| `monthly` | Same date each month |
| `quarterly` | Every 3 months |

When a recurring event is marked done:

1. Set `completed_at` on the current instance
2. Create a new entity with `due_date` shifted by the recurrence interval
3. Link old → new with `SUPERSEDES`

---

## Calendar Integration (Future)

When external calendar sync is available:

1. **Import:** Create `:Entity {entity_type: "event"}` nodes from calendar events
2. **Export:** Push entities with dates to the calendar as events
3. **Sync:** Two-way — changes in either system propagate
4. **Conflict:** If a calendar event conflicts with a due date, raise a sentinel alert

Protocol for calendar sync will be defined when the integration is built. The scheduler document will be updated accordingly.

---

## Cross-References

- **[chat_handler.md](./chat_handler.md)** — Handles chat-based schedule queries
- **[sentinel.md](./sentinel.md)** — Escalates overdue and blocked items as warnings
- **[curator.md](./curator.md)** — Staleness checks overlap with deadline awareness
