import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import axios from 'axios';
import { X } from 'lucide-react';
import { DataNode, AgentNode, PromptNode } from './components/CustomNodes';
import { EditPanel } from './components/EditPanel';

const API_BASE_URL = 'http://localhost:8000/api';

const nodeTypes = {
  dataNode: DataNode,
  agentNode: AgentNode,
  promptNode: PromptNode,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [executionResult, setExecutionResult] = useState<string | null>(null);

  // Fetch initial graph data
  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/graph`);
        const { nodes: dbNodes, edges: dbEdges } = response.data;

        // Transform DB nodes to React Flow nodes
        const formattedNodes = dbNodes.map((n: any) => ({
          id: n.id,
          type: n.type,
          position: { x: n.position_x, y: n.position_y },
          data: n.data,
        }));

        // Transform DB edges to React Flow edges
        const formattedEdges = dbEdges.map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.source_handle,
          targetHandle: e.target_handle,
          data: e.data,
        }));

        setNodes(formattedNodes);
        setEdges(formattedEdges);
      } catch (error) {
        console.error('Error fetching graph:', error);
      }
    };

    fetchGraph();
  }, [setNodes, setEdges]);

  const onConnect: OnConnect = useCallback(
    async (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `e${params.source}-${params.target}-${Date.now()}`,
      } as Edge;

      setEdges((eds) => addEdge(newEdge, eds));

      // Save to backend
      try {
        await axios.post(`${API_BASE_URL}/edges`, {
          id: newEdge.id,
          source: newEdge.source,
          target: newEdge.target,
          source_handle: newEdge.sourceHandle,
          target_handle: newEdge.targetHandle,
          data: {},
        });
      } catch (error) {
        console.error('Error saving edge:', error);
      }
    },
    [setEdges]
  );

  const onNodeDragStop = useCallback(async (_: any, node: Node) => {
    try {
      await axios.post(`${API_BASE_URL}/nodes`, {
        id: node.id,
        type: node.type,
        position_x: node.position.x,
        position_y: node.position.y,
        data: node.data,
      });
    } catch (error) {
      console.error('Error updating node position:', error);
    }
  }, []);

  const onNodesDelete = useCallback(async (deletedNodes: Node[]) => {
    for (const node of deletedNodes) {
      try {
        await axios.delete(`${API_BASE_URL}/nodes/${node.id}`);
      } catch (error) {
        console.error('Error deleting node:', error);
      }
    }
  }, []);

  const onEdgesDelete = useCallback(async (deletedEdges: Edge[]) => {
    for (const edge of deletedEdges) {
      try {
        await axios.delete(`${API_BASE_URL}/edges/${edge.id}`);
      } catch (error) {
        console.error('Error deleting edge:', error);
      }
    }
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onNodeDataSave = useCallback(async (nodeId: string, newData: any) => {
    setNodes((nds) => {
      const updatedNodes = nds.map((node) => {
        if (node.id === nodeId) {
          const updatedNode = { ...node, data: newData };

          // Persist to backend immediately with the latest node state
          axios.post(`${API_BASE_URL}/nodes`, {
            id: updatedNode.id,
            type: updatedNode.type,
            position_x: updatedNode.position.x,
            position_y: updatedNode.position.y,
            data: updatedNode.data,
          }).catch(error => console.error('Error saving node data:', error));

          return updatedNode;
        }
        return node;
      });
      return updatedNodes;
    });
  }, [setNodes]);

  const runGraph = useCallback(async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/execute`, {
        nodes: nodes.map(n => ({
            id: n.id,
            type: n.type,
            data: n.data,
            position_x: n.position.x,
            position_y: n.position.y
        })),
        edges: edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            data: e.data
        }))
      });
      setExecutionResult(response.data.result);
    } catch (error) {
      console.error('Error executing graph:', error);
      setExecutionResult('Error during execution.');
    }
  }, [nodes, edges]);

  const addNode = useCallback(async (type: string) => {
    const id = `${type}-${Date.now()}`;
    const initialData = type === 'dataNode' ? { label: 'New Record' } :
                        type === 'promptNode' ? { prompt: 'You are a helpful assistant.' } :
                        { model: 'gpt-4o' };

    const newNode: Node = {
      id,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: initialData,
    };

    setNodes((nds) => nds.concat(newNode));

    // Save to backend
    try {
      await axios.post(`${API_BASE_URL}/nodes`, {
        id: newNode.id,
        type: newNode.type,
        position_x: newNode.position.x,
        position_y: newNode.position.y,
        data: newNode.data,
      });
    } catch (error) {
      console.error('Error saving new node:', error);
    }
  }, [setNodes]);

  return (
    <div style={{ width: '100vw', height: '100vh' }} className="bg-zinc-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
      >
        <Controls />
        <MiniMap zoomable pannable />
        <Background variant="dots" gap={12} size={1} color="#333" />
        <Panel position="top-left" className="bg-zinc-900 text-zinc-100 p-2 border border-zinc-700 rounded shadow-xl flex flex-col gap-2">
          <h3 className="font-bold text-sm border-b border-zinc-700 pb-1">Nodes</h3>
          <div className="flex gap-2">
            <button onClick={() => addNode('dataNode')} className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-xs transition-colors shadow-lg shadow-green-900/20">Data</button>
            <button onClick={() => addNode('promptNode')} className="bg-yellow-600 hover:bg-yellow-500 text-white px-2 py-1 rounded text-xs transition-colors shadow-lg shadow-yellow-900/20">Prompt</button>
            <button onClick={() => addNode('agentNode')} className="bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded text-xs transition-colors shadow-lg shadow-purple-900/20">Agent</button>
          </div>
          <button
            onClick={runGraph}
            className="mt-2 bg-red-600 text-white px-2 py-2 rounded font-bold text-sm hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20"
          >
            Run Graph
          </button>
        </Panel>
        {executionResult && (
          <Panel position="bottom-center" className="bg-zinc-900 text-zinc-100 p-4 border border-zinc-700 rounded shadow-2xl max-w-md w-full mb-4">
            <div className="flex justify-between items-center border-b border-zinc-700 pb-2 mb-2">
              <h3 className="font-bold">Execution Result</h3>
              <button onClick={() => setExecutionResult(null)} className="text-zinc-500 hover:text-zinc-100 transition-colors">
                <X size={16} />
              </button>
            </div>
            <pre className="text-xs bg-zinc-950 p-2 border border-zinc-800 rounded whitespace-pre-wrap max-h-40 overflow-auto text-green-400">
              {executionResult}
            </pre>
          </Panel>
        )}
      </ReactFlow>
      {selectedNode && (
        <EditPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onSave={onNodeDataSave}
        />
      )}
    </div>
  );
}
