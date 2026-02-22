import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Edge,
  type Node,
  type Connection,
  Panel,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import axios from 'axios';
import {
  X, RefreshCw, Filter, Search, Plus,
  Eye, EyeOff,
} from 'lucide-react';
import { KnowledgeNode } from './components/KnowledgeNode';
import { KnowledgeEdge } from './components/KnowledgeEdge';
import './App.css';

const API_BASE = 'http://localhost:8000/api/knowledge';

// ── Node / Edge type registration ────────────────────────────

const nodeTypes = { knowledge: KnowledgeNode };
const edgeTypes = { knowledge: KnowledgeEdge };

// ── Label colours for the mini-map ───────────────────────────

const LABEL_COLORS: Record<string, string> = {
  Entity: '#94a3b8',
  Note: '#38bdf8',
  Source: '#fb923c',
  Tag: '#a1a1aa',
  Collection: '#818cf8',
};

// ── Transform API response → ReactFlow nodes/edges ───────────

function apiToNodes(apiNodes: any[]): Node[] {
  return apiNodes.map((n) => ({
    id: n.id,
    type: 'knowledge',
    position: { x: n.position_x, y: n.position_y },
    data: {
      name: n.name,
      summary: n.summary,
      label: n.label,
      entity_type: n.entity_type,
      note_type: n.note_type,
      source_type: n.source_type,
      importance: n.importance,
      status: n.status,
      created_at: n.created_at,
      updated_at: n.updated_at,
      completed_at: n.completed_at,
      due_date: n.due_date,
      color: n.color,
      is_blocking: n.is_blocking,
      is_blocked: n.is_blocked,
      is_exposed: n.is_exposed,
    },
  }));
}

const NODE_SCHEMA: Record<string, string[]> = {
  Concept: ['topic', 'framework', 'principle'],
  Organization: ['company', 'non-profit', 'government', 'team'],
  Location: ['city', 'country', 'building', 'virtual', 'residence'],
  Activity: ['learning', 'research', 'work_session', 'leisure'],
  Event: ['meeting', 'conference', 'milestone', 'launch'],
  Content: ['article', 'book', 'video', 'podcast', 'document'],
  Person: ['colleague', 'friend', 'author', 'historical_figure'],
  Project: ['software', 'personal', 'work_initiative'],
  Tool: ['software_app', 'hardware', 'framework'],
  TimeBlock: ['pomodoro', 'focus_sprint', 'break', 'daily_routine'],
  Entity: ['concept', 'project', 'tool', 'person', 'event', 'other'],
  Note: ['thought', 'insight', 'quote', 'summary', 'journal'],
  Source: ['book', 'article', 'video', 'podcast', 'webpage'],
  Tag: ['status', 'priority', 'category', 'topic'],
  Collection: ['project_resources', 'reading_list', 'dossier', 'archive']
};

const NODE_LABELS = Object.keys(NODE_SCHEMA).sort();

const RELATIONSHIP_TYPES = [
  'PART_OF', 'RELATES_TO', 'OCCURS_AT', 'PARTICIPATES_IN', 'PRODUCED',
  'CONNECTED_TO', 'REQUIRES', 'DEPENDS_ON', 'CONTRADICTS', 'SUPERSEDES',
  'SIMILAR_TO', 'DERIVED_FROM', 'ABOUT', 'AUTHORED_BY', 'TAGGED',
  'CONTAINS', 'BLOCKS', 'READS_FROM', 'WRITES_TO', 'TRIGGERS', 'CALLS'
].sort();

function getColorForRelType(type: string): string {
  switch (type) {
    case 'DEPENDS_ON': return '#ef4444';   // red-500
    case 'RELATES_TO': return '#3b82f6';   // blue-500
    case 'IS_PART_OF': return '#10b981';   // emerald-500
    case 'CONTRADICTS': return '#f59e0b';  // amber-500
    case 'SUPERSEDES': return '#8b5cf6';   // violet-500
    case 'SIMILAR_TO': return '#06b6d4';   // cyan-500
    case 'DERIVED_FROM': return '#d946ef'; // fuchsia-500
    case 'ABOUT': return '#f43f5e';        // rose-500
    case 'AUTHORED_BY': return '#ec4899';  // pink-500
    case 'TAGGED': return '#84cc16';       // lime-500
    case 'CONTAINS': return '#14b8a6';     // teal-500
    case 'BLOCKS': return '#dc2626';       // red-600
    default: return '#64748b';             // slate-500
  }
}

function apiToEdges(apiEdges: any[]): Edge[] {
  const pairCounts = new Map<string, number>();

  return apiEdges.map((e) => {
    const source = e.source;
    const target = e.target;
    // Canonical pair ID independent of direction
    const pairId = source < target ? `${source}-${target}` : `${target}-${source}`;

    const count = pairCounts.get(pairId) || 0;
    pairCounts.set(pairId, count + 1);

    const color = getColorForRelType(e.rel_type);
    return {
      id: e.id,
      source: source,
      target: target,
      type: 'knowledge',
      data: {
        rel_type: e.rel_type,
        weight: e.weight,
        context: e.context,
        parallelIndex: count,
        isReverse: source > target,
      },
      style: {
        stroke: color,
      },
      markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: color },
    };
  });
}

// ── Filter state ─────────────────────────────────────────────

type VisibilityFilters = {
  Entity: boolean;
  Note: boolean;
  Source: boolean;
  Tag: boolean;
  Collection: boolean;
  showEdges: boolean;
};

const defaultFilters: VisibilityFilters = {
  Entity: true,
  Note: true,
  Source: true,
  Tag: true,
  Collection: true,
  showEdges: true,
};

// ══════════════════════════════════════════════════════════════
//  APP
// ══════════════════════════════════════════════════════════════

export default function App() {
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<VisibilityFilters>(defaultFilters);
  const [viewMode, setViewMode] = useState<'admin' | 'prompt'>('admin');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingEdge, setEditingEdge] = useState<Edge | null>(null);

  // ── Fetch graph from backend ─────────────────────────────

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/graph`);
      const n = apiToNodes(res.data.nodes);
      const e = apiToEdges(res.data.edges);
      setAllNodes(n);
      setAllEdges(e);
    } catch (err: any) {
      setError(err.message || 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  // ── Apply filters + search ───────────────────────────────

  useEffect(() => {
    let filtered = allNodes;

    // View mode filter (Prompting view only shows exposed nodes)
    if (viewMode === 'prompt') {
      filtered = filtered.filter((n) => (n.data as any).is_exposed);
    }

    // Label filter
    filtered = filtered.filter((n) => {
      const label = (n.data as any).label as keyof VisibilityFilters;
      return filters[label] !== false;
    });

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter((n) => {
        const d = n.data as any;
        return (
          d.name?.toLowerCase().includes(q) ||
          d.summary?.toLowerCase().includes(q) ||
          d.entity_type?.toLowerCase().includes(q)
        );
      });
    }

    const visibleIds = new Set(filtered.map((n) => n.id));

    setNodes(filtered);
    setEdges(
      filters.showEdges
        ? allEdges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
        : []
    );
  }, [allNodes, allEdges, filters, searchTerm, viewMode, setNodes, setEdges]);

  // ── Interactions ─────────────────────────────────────────

  const handleCreateNode = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE}/nodes`, {
        label: "Concept",
        name: "New Node",
        summary: "Edit details here..."
      });
      await fetchGraph(); // Reload the whole map to position it
      const createdData = res.data;
      if (createdData) {
        // Open the detail sidebar automatically for editing immediately
        setSelectedNode({ id: createdData.id, type: 'knowledge', position: { x: 0, y: 0 }, data: createdData });
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create node");
    } finally {
      setLoading(false);
    }
  };

  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    const { source, target } = connection;
    if (!source || !target) return;
    setPendingConnection(connection);
  }, []);

  const handleConfirmConnection = async (relType: string) => {
    if (!pendingConnection) return;
    const { source, target } = pendingConnection;
    setPendingConnection(null);

    const formattedRelType = relType.toUpperCase().replace(/\s+/g, '_');

    try {
      await axios.post(`${API_BASE}/relationships`, {
        from_id: source,
        to_id: target,
        rel_type: formattedRelType,
        weight: 1.0,
      });

      const newEdge: Edge = {
        id: `tmp-${source}-${target}-${Date.now()}`,
        source,
        target,
        type: 'knowledge',
        data: {
          rel_type: formattedRelType,
          weight: 1.0,
          context: null,
        },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#64748b' },
      };

      setEdges((eds) => addEdge(newEdge, eds));
      fetchGraph();
    } catch (err: any) {
      console.error('Failed to create relationship:', err);
      setError(`Failed to create relationship: ${err.message}`);
    }
  };

  const cancelConnection = () => {
    setPendingConnection(null);
  };

  const onEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setEditingEdge(edge);
  }, []);

  const deleteEdge = async () => {
    if (!editingEdge) return;
    try {
      const relType = editingEdge.data?.rel_type;
      if (!relType) throw new Error("Missing relationship type");

      await axios.delete(
        `${API_BASE}/relationships?from_id=${editingEdge.source}&to_id=${editingEdge.target}&rel_type=${relType}`
      );

      setEdges((eds) => eds.filter((e) => e.id !== editingEdge.id));
      setEditingEdge(null);
    } catch (err: any) {
      console.error('Failed to delete relationship:', err);
      setError(`Failed to delete relationship: ${err.message}`);
    }
  };

  const updateEdgeType = async (newType: string) => {
    if (!editingEdge) return;
    try {
      const oldType = editingEdge.data?.rel_type;
      if (!oldType || oldType === newType) return;

      // Delete old relationship
      await axios.delete(
        `${API_BASE}/relationships?from_id=${editingEdge.source}&to_id=${editingEdge.target}&rel_type=${oldType}`
      );

      // Create new relationship
      await axios.post(`${API_BASE}/relationships`, {
        from_id: editingEdge.source,
        to_id: editingEdge.target,
        rel_type: newType,
        weight: editingEdge.data?.weight || 1.0,
      });

      setEditingEdge(null);
      fetchGraph(); // Refresh to catch changes in ReactFlow
    } catch (err: any) {
      console.error('Failed to update relationship:', err);
      setError(`Failed to update relationship: ${err.message}`);
    }
  };


  // ── Stats ────────────────────────────────────────────────

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    allNodes.forEach((n) => {
      const label = (n.data as any).label;
      counts[label] = (counts[label] || 0) + 1;
    });
    return counts;
  }, [allNodes]);

  // ── Mini-map node colour ─────────────────────────────────

  const miniMapColor = useCallback((node: Node) => {
    const label = (node.data as any).label;
    return LABEL_COLORS[label] || '#64748b';
  }, []);

  // ── Toggle filter ────────────────────────────────────────

  const toggleFilter = useCallback((key: keyof VisibilityFilters) => {
    setFilters((f) => ({ ...f, [key]: !f[key] }));
  }, []);

  // ── Node drag update ────────────────────────────────────────

  const onNodeDragStop = useCallback(async (_event: React.MouseEvent, node: Node) => {
    try {
      await axios.patch(`${API_BASE}/nodes/${node.id}`, {
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      });
    } catch (err) {
      console.error('Failed to save node position', err);
    }
  }, []);

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════

  return (
    <div className="app-root">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        fitView
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#64748b' },
        }}
      >
        <Controls className="!bg-zinc-900 !border-zinc-700 !shadow-2xl [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button]:!fill-zinc-400 [&>button:hover]:!bg-zinc-700" />
        <MiniMap
          zoomable
          pannable
          nodeColor={miniMapColor}
          maskColor="rgba(0, 0, 0, 0.65)"
          className="!bg-zinc-900/80 !border-zinc-700"
        />
        <Background variant={'dots' as any} gap={20} size={1} color="#1e293b" />

        {/* ── Top bar ────────────────────────────────────── */}
        <Panel position="top-left" className="flex flex-col gap-2 mt-2 ml-2">
          {/* View Switcher Tabs */}
          <div className="flex items-center bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded p-1 shadow-lg w-max pointer-events-auto">
            <button
              onClick={() => setViewMode('admin')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${viewMode === 'admin' ? 'bg-zinc-700 text-zinc-100 shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Database View
            </button>
            <button
              onClick={() => setViewMode('prompt')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${viewMode === 'prompt' ? 'bg-sky-600 text-sky-50 shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Prompting View
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="panel-card flex items-center gap-2 px-3 py-2 pointer-events-auto">
              <Search size={14} className="text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search nodes…"
                className="bg-transparent text-zinc-200 text-xs outline-none w-40 placeholder:text-zinc-600"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-zinc-500 hover:text-zinc-300">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="relative">
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="panel-card px-3 py-2 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <Filter size={13} />
                Filters
              </button>

              {filtersOpen && (
                <div className="absolute top-full mt-1 left-0 panel-card p-3 min-w-[180px] z-50">
                  {(['Entity', 'Note', 'Source', 'Tag', 'Collection'] as const).map((label) => (
                    <button
                      key={label}
                      onClick={() => toggleFilter(label)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-zinc-800/60 text-left"
                    >
                      {filters[label] ? (
                        <Eye size={12} className="text-emerald-400" />
                      ) : (
                        <EyeOff size={12} className="text-zinc-600" />
                      )}
                      <span className={filters[label] ? 'text-zinc-200' : 'text-zinc-600'}>
                        {label}
                      </span>
                      <span className="ml-auto text-zinc-600 text-[10px]">
                        {stats[label] || 0}
                      </span>
                    </button>
                  ))}
                  <hr className="my-2 border-zinc-800" />
                  <button
                    onClick={() => toggleFilter('showEdges')}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-zinc-800/60 text-left"
                  >
                    {filters.showEdges ? (
                      <Eye size={12} className="text-emerald-400" />
                    ) : (
                      <EyeOff size={12} className="text-zinc-600" />
                    )}
                    <span className={filters.showEdges ? 'text-zinc-200' : 'text-zinc-600'}>
                      Edges
                    </span>
                    <span className="ml-auto text-zinc-600 text-[10px]">
                      {allEdges.length}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={fetchGraph}
              className="panel-card px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5"
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            {/* Create Node */}
            <button
              onClick={handleCreateNode}
              className="panel-card px-3 py-2 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 ml-2"
              disabled={loading}
              title="Create new generic node"
            >
              <Plus size={13} />
              Create Node
            </button>
          </div>
        </Panel>

        {/* ── Stats chips ────────────────────────────────── */}
        <Panel position="top-right" className="mt-2 mr-2">
          <div className="panel-card px-3 py-2 flex items-center gap-3 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
            {Object.entries(stats).map(([label, count]) => (
              <span key={label} className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: LABEL_COLORS[label] || '#64748b' }}
                />
                {count}
              </span>
            ))}
            <span className="border-l border-zinc-800 pl-3 text-zinc-600">
              {allEdges.length} edges
            </span>
          </div>
        </Panel>

        {/* ── Legend ─────────────────────────────────────── */}
        <Panel position="bottom-left" className="mb-4 ml-2">
          <div className="panel-card p-3 text-[11px] flex flex-col gap-3 min-w-[140px]">
            <div>
              <div className="text-zinc-500 font-bold uppercase tracking-wider mb-2">Shapes</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-emerald-500/40 clip-hexagon" /> <span className="text-zinc-400">Project</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-sky-500/40 clip-diamond" /> <span className="text-zinc-400">Note</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-slate-500/40 rounded-full" /> <span className="text-zinc-400">Concept</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-amber-500/40 rounded-sm" /> <span className="text-zinc-400">Tool</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2.5 bg-orange-500/40 rounded-sm" /> <span className="text-zinc-400">Source</span></div>
              </div>
            </div>
            <hr className="border-zinc-800" />
            <div>
              <div className="text-zinc-500 font-bold uppercase tracking-wider mb-2">Status Rings</div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full border border-[#22c55e]" /> <span className="text-zinc-400">Completed</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full border border-[#ef4444]" /> <span className="text-zinc-400">Blocking</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full border border-[#eab308]" /> <span className="text-zinc-400">Deadline</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full border border-[#3b82f6]" /> <span className="text-zinc-400">Recent</span></div>
              </div>
            </div>
          </div>
        </Panel>

        {/* ── Error toast ────────────────────────────────── */}
        {error && (
          <Panel position="bottom-center" className="mb-4">
            <div className="panel-card border-red-500/30 px-4 py-3 flex items-center gap-3 text-xs text-red-400">
              <span>{error}</span>
              <button onClick={() => setError(null)}>
                <X size={12} />
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* ── Edge Prompt Modal ────────────────────────────── */}
      {pendingConnection && (
        <EdgePromptModal
          connection={pendingConnection}
          onConfirm={handleConfirmConnection}
          onCancel={cancelConnection}
        />
      )}

      {/* ── Edge Edit/Delete Modal ───────────────────────── */}
      {editingEdge && (
        <EdgeEditModal
          edge={editingEdge}
          onUpdate={updateEdgeType}
          onDelete={deleteEdge}
          onClose={() => setEditingEdge(null)}
        />
      )}

      {/* ── Detail sidebar ───────────────────────────────── */}
      {selectedNode && (
        <NodeDetailSidebar
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onRefresh={fetchGraph}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  NODE DETAIL SIDEBAR
// ══════════════════════════════════════════════════════════════

function NodeDetailSidebar({ node, onClose, onRefresh }: { node: Node; onClose: () => void; onRefresh: () => void; }) {
  const [formData, setFormData] = useState<any>({ ...node.data });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData({ ...node.data });
  }, [node]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const endpoint = `${API_BASE}/nodes/${node.id}`;
      // Send the generic format to backend. Make sure to alias `entity_type` -> `node_type`
      // Wait, we designed backend update_node to take `node_type`
      const payload = {
        ...formData,
        node_type: formData.entity_type
      };
      await axios.put(endpoint, payload);
      onRefresh(); // Refresh the graph to pull the new data
      onClose();   // Close the sidebar or maybe just stay open with updated info
    } catch (err: any) {
      setError(err.message || 'Failed to update node');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sidebar flex flex-col h-full bg-zinc-900 border-l border-zinc-800 shadow-2xl overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-900/95 backdrop-blur z-10">
        <h2 className="text-sm font-bold text-zinc-100 truncate flex-1">Edit {formData.label}</h2>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 flex-1 space-y-4">
        {/* Name */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-400">Name</label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500"
          />
        </div>

        {/* Summary */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-400">Summary</label>
          <textarea
            value={formData.summary || ''}
            onChange={(e) => handleChange('summary', e.target.value)}
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500 resize-none"
          />
        </div>

        {/* Status (Entities only typically) */}
        {formData.label === 'Entity' && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Status</label>
            <select
              value={formData.status || 'active'}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Label selector */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Label</label>
            <select
              value={formData.label || 'Concept'}
              onChange={(e) => {
                const newLabel = e.target.value;
                const availableSubtypes = NODE_SCHEMA[newLabel] || ['concept'];
                handleChange('label', newLabel);
                handleChange('entity_type', availableSubtypes[0]); // Reset subtype correctly automatically
              }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500"
            >
              {NODE_LABELS.map(lbl => (
                <option key={lbl} value={lbl}>{lbl}</option>
              ))}
            </select>
          </div>

          {/* Type Selector (Dynamic subtype) */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Type</label>
            <select
              value={formData.entity_type || 'concept'}
              onChange={(e) => handleChange('entity_type', e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500"
            >
              {(NODE_SCHEMA[formData.label || 'Concept'] || ['concept']).map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Importance */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Importance</label>
            <select
              value={formData.importance || 3}
              onChange={(e) => handleChange('importance', parseInt(e.target.value))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500"
            >
              <option value={1}>1 - Low</option>
              <option value={2}>2</option>
              <option value={3}>3 - Normal</option>
              <option value={4}>4</option>
              <option value={5}>5 - High</option>
            </select>
          </div>
        </div>

        {/* Temporal Fields - Due Date & Start Date */}
        {formData.label === 'Entity' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Start Date</label>
              <input
                type="date"
                value={formData.start_date ? formData.start_date.split('T')[0] : ''}
                onChange={(e) => handleChange('start_date', e.target.value ? `${e.target.value}T00:00:00Z` : null)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500 [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Due Date</label>
              <input
                type="date"
                value={formData.due_date ? formData.due_date.split('T')[0] : ''}
                onChange={(e) => handleChange('due_date', e.target.value ? `${e.target.value}T00:00:00Z` : null)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-500 [color-scheme:dark]"
              />
            </div>
          </div>
        )}

        {/* Expose Status */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50 mt-4">
          <label className="text-xs font-medium text-zinc-300">Exposed in Prompt View</label>
          <button
            onClick={() => handleChange('is_exposed', !formData.is_exposed)}
            className={`w-9 h-5 rounded-full relative transition-colors ${formData.is_exposed ? 'bg-emerald-500' : 'bg-zinc-700'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${formData.is_exposed ? 'translate-x-4' : 'translate-x-0'}`}
            />
          </button>
        </div>

        {/* Read-only tracking fields */}
        <div className="pt-4 border-t border-zinc-800/50 mt-4 space-y-2">
          <h3 className="text-[10px] font-bold tracking-widest text-zinc-600 uppercase mb-2">Metadata</h3>
          <div className="flex justify-between text-[11px]">
            <span className="text-zinc-500">ID</span>
            <span className="text-zinc-400 font-mono truncate max-w-[60%]">{node.id}</span>
          </div>
          {formData.created_at && (
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-500">Created</span>
              <span className="text-zinc-400">{formData.created_at}</span>
            </div>
          )}
          {formData.updated_at && (
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-500">Updated</span>
              <span className="text-zinc-400">{formData.updated_at}</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-zinc-800 sticky bottom-0 bg-zinc-900/95 backdrop-blur flex justify-between items-center">
        {error && <span className="text-xs text-red-500 truncate mr-2">{error}</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-emerald-50 text-sm font-medium rounded transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  EDGE PROMPT MODAL
// ══════════════════════════════════════════════════════════════

function EdgePromptModal({
  connection,
  onConfirm,
  onCancel,
}: {
  connection: Connection;
  onConfirm: (relType: string) => void;
  onCancel: () => void;
}) {
  const [relType, setRelType] = useState('RELATES_TO');

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl p-6 w-[400px] max-w-[90vw]">
        <h3 className="text-sm font-bold text-zinc-100 mb-4">Create Relationship</h3>
        <p className="text-xs text-zinc-400 mb-4">
          Connecting <span className="font-mono text-zinc-300 truncate inline-block max-w-[120px] align-bottom">{connection.source}</span> to <span className="font-mono text-zinc-300 truncate inline-block max-w-[120px] align-bottom">{connection.target}</span>.
        </p>
        <div className="space-y-2 mb-6">
          <label className="text-xs font-medium text-zinc-400">Relationship Type</label>
          <select
            value={relType}
            onChange={(e) => setRelType(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500 font-mono"
            autoFocus
          >
            {RELATIONSHIP_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(relType || 'RELATES_TO')}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-sky-50 text-sm font-medium rounded transition-colors"
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  EDGE EDIT MODAL
// ══════════════════════════════════════════════════════════════

function EdgeEditModal({
  edge,
  onUpdate,
  onDelete,
  onClose,
}: {
  edge: Edge;
  onUpdate: (newType: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [relType, setRelType] = useState<string>((edge.data?.rel_type as string) || 'RELATES_TO');

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl p-6 w-[400px] max-w-[90vw]">
        <h3 className="text-sm font-bold text-zinc-100 mb-4">Edit Relationship</h3>
        <p className="text-xs text-zinc-400 mb-4">
          <span className="font-mono mt-1 text-zinc-500 text-[10px] break-all">
            {edge.source} → {edge.target}
          </span>
        </p>

        <div className="space-y-2 mb-6">
          <label className="text-xs font-medium text-zinc-400">Relationship Type</label>
          <select
            value={relType}
            onChange={(e) => setRelType(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500 font-mono"
            autoFocus
          >
            {RELATIONSHIP_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-between items-center mt-6">
          <button
            onClick={onDelete}
            className="px-4 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-red-50 text-sm font-medium rounded transition-colors"
          >
            Delete
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onUpdate(relType)}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-sky-50 text-sm font-medium rounded transition-colors disabled:opacity-50"
              disabled={relType === edge.data?.rel_type}
            >
              Update
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
