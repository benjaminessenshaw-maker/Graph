import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
    Brain, Wrench, FolderKanban, User, StickyNote,
    BookOpen, Hash, Layers, Cog, Zap,
} from 'lucide-react';

// ── Type mappings ────────────────────────────────────────────

interface NodeData {
    name: string;
    summary?: string;
    label: string;          // Entity | Note | Source | Tag | Collection
    entity_type?: string;   // concept | tool | project | person | automation | integration
    note_type?: string;
    source_type?: string;
    importance: number;
    status?: string;
    is_blocking: boolean;
    is_blocked: boolean;
    completed_at?: string;
    due_date?: string;
    updated_at?: string;
    color?: string;
}

type VisualConfig = {
    icon: React.ElementType;
    color: string;       // accent colour class
    bgColor: string;     // background class
    borderColor: string; // border class
    shape: 'circle' | 'rounded' | 'hexagon' | 'diamond' | 'square' | 'pill';
    dashed?: boolean;
};

function getVisualConfig(data: NodeData): VisualConfig {
    const label = data.label;
    const subtype = data.entity_type || data.note_type || data.source_type || '';

    // Entity subtypes
    if (label === 'Entity') {
        switch (subtype) {
            case 'tool':
                return { icon: Wrench, color: 'text-amber-400', bgColor: 'bg-amber-950/40', borderColor: 'border-amber-500/60', shape: 'rounded' };
            case 'project':
                return { icon: FolderKanban, color: 'text-emerald-400', bgColor: 'bg-emerald-950/40', borderColor: 'border-emerald-500/60', shape: 'hexagon' };
            case 'person':
                return { icon: User, color: 'text-violet-400', bgColor: 'bg-violet-950/40', borderColor: 'border-violet-500/60', shape: 'circle' };
            case 'automation':
                return { icon: Cog, color: 'text-cyan-400', bgColor: 'bg-cyan-950/40', borderColor: 'border-cyan-500/60', shape: 'rounded', dashed: true };
            case 'integration':
                return { icon: Zap, color: 'text-teal-400', bgColor: 'bg-teal-950/40', borderColor: 'border-teal-500/60', shape: 'rounded', dashed: true };
            default: // concept
                return { icon: Brain, color: 'text-slate-300', bgColor: 'bg-slate-800/60', borderColor: 'border-slate-500/60', shape: 'circle' };
        }
    }

    if (label === 'Note')
        return { icon: StickyNote, color: 'text-sky-400', bgColor: 'bg-sky-950/40', borderColor: 'border-sky-500/60', shape: 'diamond' };
    if (label === 'Source')
        return { icon: BookOpen, color: 'text-orange-400', bgColor: 'bg-orange-950/40', borderColor: 'border-orange-500/60', shape: 'square' };
    if (label === 'Tag')
        return { icon: Hash, color: 'text-zinc-400', bgColor: 'bg-zinc-800/60', borderColor: 'border-zinc-500/60', shape: 'pill' };
    if (label === 'Collection')
        return { icon: Layers, color: 'text-indigo-400', bgColor: 'bg-indigo-950/40', borderColor: 'border-indigo-500/60', shape: 'rounded' };

    // Fallback
    return { icon: Brain, color: 'text-zinc-400', bgColor: 'bg-zinc-900', borderColor: 'border-zinc-600', shape: 'circle' };
}

// ── Ring computation ─────────────────────────────────────────

type Ring = { color: string; label: string };

function computeRings(data: NodeData): Ring[] {
    const rings: Ring[] = [];

    if (data.completed_at) {
        rings.push({ color: '#22c55e', label: 'Completed' });  // green
    }
    if (data.is_blocking) {
        rings.push({ color: '#ef4444', label: 'Blocking' });   // red
    }
    if (data.due_date && !data.completed_at) {
        rings.push({ color: '#eab308', label: 'Has deadline' }); // yellow
    }
    if (data.updated_at) {
        const updatedMs = new Date(data.updated_at).getTime();
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (updatedMs > sevenDaysAgo) {
            rings.push({ color: '#3b82f6', label: 'Recent' });   // blue
        }
    }

    return rings.slice(0, 3); // Max 3 rings
}

// ── Shape clip-paths ─────────────────────────────────────────

const shapeClasses: Record<string, string> = {
    circle: 'rounded-full aspect-square',
    rounded: 'rounded-xl',
    hexagon: 'clip-hexagon',
    diamond: 'clip-diamond rotate-0',
    square: 'rounded-md',
    pill: 'rounded-full',
};

// ── Component ────────────────────────────────────────────────

function KnowledgeNodeInner({ data, selected }: NodeProps) {
    const nodeData = data as unknown as NodeData;
    const config = useMemo(() => getVisualConfig(nodeData), [nodeData]);
    const rings = useMemo(() => computeRings(nodeData), [nodeData]);

    const Icon = config.icon;
    const importance = nodeData.importance || 3;
    const scale = 0.75 + (importance / 5) * 0.5; // 0.95 → 1.25

    const isSmall = nodeData.label === 'Tag';

    return (
        <div
            className="relative group"
            style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
        >
            {/* Status rings */}
            {rings.map((ring, i) => (
                <div
                    key={ring.label}
                    className="absolute inset-0 rounded-xl pointer-events-none animate-pulse-slow"
                    style={{
                        border: `2px solid ${ring.color}`,
                        margin: `${-(i + 1) * 5}px`,
                        borderRadius: 'inherit',
                        opacity: 0.6 + i * 0.1,
                    }}
                    title={ring.label}
                />
            ))}

            {/* Main node body */}
            <div
                className={`
          relative px-3 py-2 shadow-2xl transition-all duration-200
          ${config.bgColor} ${config.borderColor}
          ${config.dashed ? 'border-dashed' : ''}
          border-2
          ${shapeClasses[config.shape] || 'rounded-xl'}
          ${selected ? 'ring-2 ring-white/40 shadow-lg shadow-white/10' : ''}
          hover:brightness-125 cursor-pointer
          ${isSmall ? 'min-w-[80px]' : 'min-w-[140px] max-w-[200px]'}
          backdrop-blur-sm
        `}
            >
                <div className="flex items-center gap-2">
                    {/* Icon */}
                    <div className={`
            flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
            ${config.bgColor} border ${config.borderColor}
          `}>
                        <Icon size={14} className={config.color} />
                    </div>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                        <div className={`text-xs font-semibold text-zinc-100 truncate leading-tight`}>
                            {nodeData.name}
                        </div>
                        {!isSmall && nodeData.summary && (
                            <div className="text-[10px] text-zinc-400 truncate leading-tight mt-0.5">
                                {nodeData.summary}
                            </div>
                        )}
                    </div>

                    {/* Importance dots */}
                    {importance >= 4 && (
                        <div className="flex-shrink-0">
                            <div className="text-amber-400 text-[10px]">{'★'.repeat(importance - 3)}</div>
                        </div>
                    )}
                </div>

                {/* Type label */}
                {!isSmall && (
                    <div className="mt-1">
                        <span className={`text-[9px] uppercase tracking-widest font-bold ${config.color} opacity-60`}>
                            {nodeData.entity_type || nodeData.note_type || nodeData.label}
                        </span>
                    </div>
                )}
            </div>

            {/* Handles */}
            <Handle
                type="target"
                position={Position.Left}
                className={`!w-2 !h-2 !border-none !${config.bgColor.replace('bg-', 'bg-')}`}
                style={{ background: 'currentColor' }}
            />
            <Handle
                type="source"
                position={Position.Right}
                className={`!w-2 !h-2 !border-none`}
                style={{ background: 'currentColor' }}
            />
        </div>
    );
}

export const KnowledgeNode = memo(KnowledgeNodeInner);
