"""Seed the Neo4j database with sample data for testing the graph overlay."""
import requests
import sys

API = "http://localhost:8000/api/knowledge"

def safe_print(msg):
    """Print without Unicode issues on Windows."""
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", "replace").decode())

# -- Entities --

entities = [
    {"name": "Python", "entity_type": "tool", "summary": "General purpose programming language", "importance": 5},
    {"name": "ReactFlow", "entity_type": "tool", "summary": "Node-based graph UI library for React", "importance": 4},
    {"name": "Neo4j", "entity_type": "tool", "summary": "Graph database engine", "importance": 5},
    {"name": "Knowledge Gardener", "entity_type": "project", "summary": "Interactive knowledge graph application", "importance": 5, "status": "active"},
    {"name": "FastAPI", "entity_type": "tool", "summary": "Modern Python web framework", "importance": 4},
    {"name": "Benjamin", "entity_type": "person", "summary": "Project creator and developer", "importance": 5},
    {"name": "Graph Theory", "entity_type": "concept", "summary": "Mathematical study of graphs and networks", "importance": 3},
    {"name": "Daily Curation", "entity_type": "automation", "summary": "Nightly cron that reviews and links orphan nodes", "importance": 3, "status": "planned"},
    {"name": "Tailwind CSS", "entity_type": "tool", "summary": "Utility-first CSS framework", "importance": 3},
    {"name": "TypeScript", "entity_type": "tool", "summary": "Typed superset of JavaScript", "importance": 4},
]

entity_ids = {}
for e in entities:
    r = requests.post(f"{API}/entities", json=e)
    data = r.json()
    eid = data.get("id") or data.get("entity_id") or data.get("node_id", "?")
    entity_ids[e["name"]] = eid
    safe_print(f"  Entity: {e['name']} -> {eid}")

# -- Notes --

notes = [
    {"title": "Schema design decisions", "summary": "Flexible entity types", "content": "Use entity_type as unconstrained string for maximum flexibility", "note_type": "decision"},
    {"title": "Visual encoding brainstorm", "summary": "Visual variables mapping", "content": "Shape=label, colour=subtype, rings=status flags, size=importance", "note_type": "idea"},
]

note_ids = {}
for n in notes:
    r = requests.post(f"{API}/notes", json=n)
    data = r.json()
    safe_print(f"  Note response: {data}")
    nid = data.get("id") or data.get("note_id") or data.get("node_id", "?")
    note_ids[n["title"]] = nid
    safe_print(f"  Note: {n['title']} -> {nid}")

# -- Sources --

sources = [
    {"uri": "https://reactflow.dev", "name": "ReactFlow documentation", "source_type": "documentation"},
    {"uri": "https://neo4j.com/docs", "name": "Neo4j documentation", "source_type": "documentation"},
]

source_ids = {}
for s in sources:
    r = requests.post(f"{API}/sources", json=s)
    data = r.json()
    safe_print(f"  Source response: {data}")
    sid = data.get("id") or data.get("source_id") or data.get("node_id", "?")
    source_ids[s["title"]] = sid
    safe_print(f"  Source: {s['title']} -> {sid}")

# -- Tags --

tags = [
    {"name": "frontend"},
    {"name": "backend"},
    {"name": "database"},
    {"name": "visualization"},
]

tag_ids = {}
for t in tags:
    r = requests.post(f"{API}/tags", json=t)
    data = r.json()
    safe_print(f"  Tag response: {data}")
    tid = data.get("id") or data.get("tag_id") or data.get("node_id", "?")
    tag_ids[t["name"]] = tid
    safe_print(f"  Tag: {t['name']} -> {tid}")

# -- Relationships --

rels = [
    (entity_ids["Knowledge Gardener"], entity_ids["Python"], "DEPENDS_ON"),
    (entity_ids["Knowledge Gardener"], entity_ids["ReactFlow"], "DEPENDS_ON"),
    (entity_ids["Knowledge Gardener"], entity_ids["Neo4j"], "DEPENDS_ON"),
    (entity_ids["Knowledge Gardener"], entity_ids["FastAPI"], "DEPENDS_ON"),
    (entity_ids["Benjamin"], entity_ids["Knowledge Gardener"], "RELATES_TO"),
    (entity_ids["ReactFlow"], entity_ids["TypeScript"], "DEPENDS_ON"),
    (entity_ids["Graph Theory"], entity_ids["Neo4j"], "RELATES_TO"),
    (entity_ids["Daily Curation"], entity_ids["Knowledge Gardener"], "READS_FROM"),
    (entity_ids["Daily Curation"], entity_ids["Knowledge Gardener"], "WRITES_TO"),
    (entity_ids["Knowledge Gardener"], entity_ids["Tailwind CSS"], "DEPENDS_ON"),
]

for source_id, target_id, rel_type in rels:
    r = requests.post(f"{API}/relationships", json={
        "from_id": source_id,
        "to_id": target_id,
        "rel_type": rel_type,
    })
    safe_print(f"  Rel: {rel_type} -> {r.status_code}")

# -- Tag some entities --

tag_rels = [
    (entity_ids["Python"], tag_ids["backend"]),
    (entity_ids["ReactFlow"], tag_ids["frontend"]),
    (entity_ids["ReactFlow"], tag_ids["visualization"]),
    (entity_ids["Neo4j"], tag_ids["database"]),
    (entity_ids["FastAPI"], tag_ids["backend"]),
    (entity_ids["TypeScript"], tag_ids["frontend"]),
]

for eid, tid in tag_rels:
    r = requests.post(f"{API}/relationships", json={
        "from_id": eid,
        "to_id": tid,
        "rel_type": "TAGGED",
    })
    safe_print(f"  Tagged -> {r.status_code}")

safe_print(f"\nSeed complete! {len(entity_ids)} entities, {len(note_ids)} notes, {len(source_ids)} tags, {len(tag_ids)} tags, {len(rels)+len(tag_rels)} relationships")
