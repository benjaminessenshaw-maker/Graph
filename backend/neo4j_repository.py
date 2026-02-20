import json
from typing import List
from neo4j import GraphDatabase, Driver

from crud import GraphRepository
from models import Node, Edge


class Neo4jRepository(GraphRepository):
    """Graph repository backed by Neo4j, implementing the shared GraphRepository interface."""

    def __init__(self, driver: Driver):
        self.driver = driver

    # ── Reads ──────────────────────────────────────────────

    def get_nodes(self) -> List[Node]:
        query = "MATCH (n:Node) RETURN n"
        records, _, _ = self.driver.execute_query(query)
        return [self._record_to_node(r["n"]) for r in records]

    def get_edges(self) -> List[Edge]:
        query = (
            "MATCH (a:Node)-[r:EDGE]->(b:Node) "
            "RETURN r, a.id AS source, b.id AS target"
        )
        records, _, _ = self.driver.execute_query(query)
        return [self._record_to_edge(r) for r in records]

    # ── Writes ─────────────────────────────────────────────

    def upsert_node(self, node: Node) -> Node:
        query = (
            "MERGE (n:Node {id: $id}) "
            "SET n.type = $type, "
            "    n.position_x = $position_x, "
            "    n.position_y = $position_y, "
            "    n.data = $data "
            "RETURN n"
        )
        records, _, _ = self.driver.execute_query(
            query,
            id=node.id,
            type=node.type,
            position_x=node.position_x,
            position_y=node.position_y,
            data=json.dumps(node.data) if node.data else "{}",
        )
        return self._record_to_node(records[0]["n"])

    def upsert_edge(self, edge: Edge) -> Edge:
        query = (
            "MATCH (a:Node {id: $source}), (b:Node {id: $target}) "
            "MERGE (a)-[r:EDGE {id: $id}]->(b) "
            "SET r.source_handle = $source_handle, "
            "    r.target_handle = $target_handle, "
            "    r.data = $data "
            "RETURN r, a.id AS source, b.id AS target"
        )
        records, _, _ = self.driver.execute_query(
            query,
            id=edge.id,
            source=edge.source,
            target=edge.target,
            source_handle=edge.source_handle,
            target_handle=edge.target_handle,
            data=json.dumps(edge.data) if edge.data else "{}",
        )
        return self._record_to_edge(records[0])

    # ── Deletes ────────────────────────────────────────────

    def delete_node(self, node_id: str):
        query = "MATCH (n:Node {id: $id}) DETACH DELETE n"
        self.driver.execute_query(query, id=node_id)

    def delete_edge(self, edge_id: str):
        query = "MATCH ()-[r:EDGE {id: $id}]->() DELETE r"
        self.driver.execute_query(query, id=edge_id)

    # ── Helpers ────────────────────────────────────────────

    @staticmethod
    def _record_to_node(neo4j_node) -> Node:
        props = dict(neo4j_node)
        data_raw = props.get("data", "{}")
        data = json.loads(data_raw) if isinstance(data_raw, str) else data_raw
        return Node(
            id=props["id"],
            type=props["type"],
            position_x=props["position_x"],
            position_y=props["position_y"],
            data=data,
        )

    @staticmethod
    def _record_to_edge(record) -> Edge:
        rel_props = dict(record["r"])
        data_raw = rel_props.get("data", "{}")
        data = json.loads(data_raw) if isinstance(data_raw, str) else data_raw
        return Edge(
            id=rel_props["id"],
            source=record["source"],
            target=record["target"],
            source_handle=rel_props.get("source_handle"),
            target_handle=rel_props.get("target_handle"),
            data=data,
        )
