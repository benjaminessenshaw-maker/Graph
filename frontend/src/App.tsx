import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
  Panel,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import axios from 'axios';
import {
  X, RefreshCw, Filter, Search,
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
    },
  }));
}

function apiToEdges(apiEdges: any[]): Edge[] {
  return apiEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'knowledge',
    data: {
      rel_type: e.rel_type,
      weight: e.weight,
      context: e.context,
    },
    markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#64748b' },
  }));
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
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<VisibilityFilters>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [allNodes, allEdges, filters, searchTerm, setNodes, setEdges]);

  // ── Interactions ─────────────────────────────────────────

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

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
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
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
        <Panel position="top-left" className="flex items-center gap-3 mt-2 ml-2">
          {/* Search */}
          <div className="panel-card flex items-center gap-2 px-3 py-2">
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

      {/* ── Detail sidebar ───────────────────────────────── */}
      {selectedNode && (
        <NodeDetailSidebar
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  NODE DETAIL SIDEBAR
// ══════════════════════════════════════════════════════════════

function NodeDetailSidebar({ node, onClose }: { node: Node; onClose: () => void }) {
  const d = node.data as any;

  const fields = [
    { label: 'Name', value: d.name },
    { label: 'Type', value: d.label },
    { label: 'Sub-type', value: d.entity_type || d.note_type || d.source_type },
    { label: 'Importance', value: d.importance ? '★'.repeat(d.importance) : undefined },
    { label: 'Status', value: d.status },
    { label: 'Blocking', value: d.is_blocking ? 'Yes' : undefined },
    { label: 'Blocked', value: d.is_blocked ? 'Yes' : undefined },
    { label: 'Due', value: d.due_date },
    { label: 'Completed', value: d.completed_at },
    { label: 'Updated', value: d.updated_at },
    { label: 'Created', value: d.created_at },
  ].filter((f) => f.value);

  return (
    <div className="sidebar">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-zinc-100 truncate flex-1">{d.name}</h2>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 ml-2">
          <X size={16} />
        </button>
      </div>

      {d.summary && (
        <p className="text-xs text-zinc-400 mb-4 leading-relaxed">{d.summary}</p>
      )}

      <div className="space-y-2">
        {fields.map((f) => (
          <div key={f.label} className="flex justify-between text-xs">
            <span className="text-zinc-500">{f.label}</span>
            <span className="text-zinc-300 font-medium text-right max-w-[60%] truncate">
              {f.value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-zinc-800">
        <span className="text-[9px] text-zinc-600 uppercase tracking-widest">ID</span>
        <p className="text-[10px] text-zinc-500 font-mono mt-1 break-all">{node.id}</p>
      </div>
    </div>
  );
}
