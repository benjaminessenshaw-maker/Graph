from abc import ABC, abstractmethod
from typing import List, Optional
from sqlmodel import Session, select
from models import Node, Edge

class GraphRepository(ABC):
    @abstractmethod
    def get_nodes(self) -> List[Node]:
        pass

    @abstractmethod
    def get_edges(self) -> List[Edge]:
        pass

    @abstractmethod
    def upsert_node(self, node: Node) -> Node:
        pass

    @abstractmethod
    def upsert_edge(self, edge: Edge) -> Edge:
        pass

    @abstractmethod
    def delete_node(self, node_id: str):
        pass

    @abstractmethod
    def delete_edge(self, edge_id: str):
        pass

class SQLiteRepository(GraphRepository):
    def __init__(self, session: Session):
        self.session = session

    def get_nodes(self) -> List[Node]:
        statement = select(Node)
        return self.session.exec(statement).all()

    def get_edges(self) -> List[Edge]:
        statement = select(Edge)
        return self.session.exec(statement).all()

    def upsert_node(self, node: Node) -> Node:
        # Use merge for upsert: it updates if exists, inserts if not
        merged = self.session.merge(node)
        self.session.add(merged)
        self.session.commit()
        self.session.refresh(merged)
        return merged

    def upsert_edge(self, edge: Edge) -> Edge:
        merged = self.session.merge(edge)
        self.session.add(merged)
        self.session.commit()
        self.session.refresh(merged)
        return merged

    def delete_node(self, node_id: str):
        node = self.session.get(Node, node_id)
        if node:
            self.session.delete(node)
            self.session.commit()

    def delete_edge(self, edge_id: str):
        edge = self.session.get(Edge, edge_id)
        if edge:
            self.session.delete(edge)
            self.session.commit()
