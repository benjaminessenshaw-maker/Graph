from sqlmodel import SQLModel, create_engine, Session
from neo4j import GraphDatabase, Driver
from typing import Optional

from config import get_settings

# ── SQLite ─────────────────────────────────────────────────

sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, echo=False, connect_args=connect_args)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


# ── Neo4j ──────────────────────────────────────────────────

_neo4j_driver: Optional[Driver] = None


def init_neo4j_driver() -> Driver:
    """Create and cache the Neo4j driver singleton."""
    global _neo4j_driver
    settings = get_settings()
    _neo4j_driver = GraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_user, settings.neo4j_password),
    )
    # Verify connectivity on startup
    _neo4j_driver.verify_connectivity()
    return _neo4j_driver


def get_neo4j_driver() -> Driver:
    """Return the cached Neo4j driver (must call init_neo4j_driver first)."""
    if _neo4j_driver is None:
        raise RuntimeError("Neo4j driver not initialized. Call init_neo4j_driver() first.")
    return _neo4j_driver


def close_neo4j_driver():
    """Gracefully close the Neo4j driver."""
    global _neo4j_driver
    if _neo4j_driver is not None:
        _neo4j_driver.close()
        _neo4j_driver = None
