"""
Neo4j schema initialization — constraints, indexes, and full-text search.
Run once against a fresh database, or idempotently on startup.
"""

SCHEMA_QUERIES = [
    # ── Uniqueness constraints ─────────────────────────────
    "CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE",
    "CREATE CONSTRAINT note_id IF NOT EXISTS FOR (n:Note) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT source_id IF NOT EXISTS FOR (s:Source) REQUIRE s.id IS UNIQUE",
    "CREATE CONSTRAINT tag_id IF NOT EXISTS FOR (t:Tag) REQUIRE t.id IS UNIQUE",
    "CREATE CONSTRAINT tag_name IF NOT EXISTS FOR (t:Tag) REQUIRE t.name IS UNIQUE",
    "CREATE CONSTRAINT collection_id IF NOT EXISTS FOR (c:Collection) REQUIRE c.id IS UNIQUE",

    # ── Composite indexes for common queries ───────────────
    "CREATE INDEX entity_type_status IF NOT EXISTS FOR (e:Entity) ON (e.entity_type, e.status)",
    "CREATE INDEX entity_updated IF NOT EXISTS FOR (e:Entity) ON (e.updated_at)",
    "CREATE INDEX note_type IF NOT EXISTS FOR (n:Note) ON (n.note_type)",
]

# Full-text indexes use a different syntax and must be run separately
FULLTEXT_QUERIES = [
    (
        "CREATE FULLTEXT INDEX entity_search IF NOT EXISTS "
        "FOR (e:Entity) ON EACH [e.name, e.summary]"
    ),
    (
        "CREATE FULLTEXT INDEX note_search IF NOT EXISTS "
        "FOR (n:Note) ON EACH [n.title, n.summary]"
    ),
]


def init_schema(driver):
    """Apply all constraints, indexes, and full-text indexes to Neo4j."""
    for query in SCHEMA_QUERIES:
        driver.execute_query(query)

    for query in FULLTEXT_QUERIES:
        driver.execute_query(query)
