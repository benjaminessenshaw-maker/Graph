import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
    Brain, Wrench, FolderKanban, User, StickyNote,
    BookOpen, Hash, Layers, Cog, Zap,
    Building, MapPin, Activity, Calendar, FileText, Lightbulb, Clock
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
    collection?: string;
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

    // 1. Determine base shape and icon by Type
    let cfg: Omit<VisualConfig, 'color' | 'bgColor' | 'borderColor'> = { icon: Brain, shape: 'circle' };

    if (label === 'Entity') {
        switch (subtype) {
            case 'tool': cfg = { icon: Wrench, shape: 'rounded' }; break;
            case 'project': cfg = { icon: FolderKanban, shape: 'hexagon' }; break;
            case 'person': cfg = { icon: User, shape: 'circle' }; break;
            case 'automation': cfg = { icon: Cog, shape: 'rounded', dashed: true }; break;
            case 'integration': cfg = { icon: Zap, shape: 'rounded', dashed: true }; break;
            default: cfg = { icon: Brain, shape: 'circle' }; break;
        }
    } else if (label === 'Note') {
        cfg = { icon: StickyNote, shape: 'diamond' };
    } else if (label === 'Source') {
        cfg = { icon: BookOpen, shape: 'square' };
    } else if (label === 'Tag') {
        cfg = { icon: Hash, shape: 'pill' };
    } else if (label === 'Collection') {
        cfg = { icon: Layers, shape: 'rounded' };
    } else if (label === 'Organization') {
        cfg = { icon: Building, shape: 'hexagon' };
    } else if (label === 'Location') {
        cfg = { icon: MapPin, shape: 'rounded' };
    } else if (label === 'Activity') {
        cfg = { icon: Activity, shape: 'circle' };
    } else if (label === 'Event') {
        cfg = { icon: Calendar, shape: 'rounded' };
    } else if (label === 'Content') {
        cfg = { icon: FileText, shape: 'square' };
    } else if (label === 'Concept') {
        cfg = { icon: Lightbulb, shape: 'circle' };
    } else if (label === 'TimeBlock') {
        cfg = { icon: Clock, shape: 'rounded' };
    }

    // 2. Determine color by Collection / Category
    // We expect 'collection' or 'domain' to eventually be on data, but for now we map manually or fallback
    // In the future data.collection could be "Tech Infrastructure" -> blue
    const collection = data.collection || 'Default';

    // Hash the collection name to pick a stable color (simplified for now)
    const colorMap: Record<string, { color: string, bgColor: string, borderColor: string }> = {
        'Tech': { color: 'text-sky-400', bgColor: 'bg-sky-950/40', borderColor: 'border-sky-500/60' }, // Blues
        'Project': { color: 'text-emerald-400', bgColor: 'bg-emerald-950/40', borderColor: 'border-emerald-500/60' }, // Greens
        'People': { color: 'text-violet-400', bgColor: 'bg-violet-950/40', borderColor: 'border-violet-500/60' }, // Purples
        'Archive': { color: 'text-zinc-400', bgColor: 'bg-zinc-800/60', borderColor: 'border-zinc-500/60' }, // Greys
        'Default': { color: 'text-slate-300', bgColor: 'bg-slate-800/60', borderColor: 'border-slate-500/60' } // Fallback
    };

    // TEMPORARY: Since we don't have collection data yet from backend natively, 
    // let's use a very basic hash or fallback to type-based colors if collection isn't present
    let colorSet = colorMap.Default;
    if (collection !== 'Default' && colorMap[collection]) {
        colorSet = colorMap[collection];
    } else {
        // Fallback to type-based coloring temporarily so it doesn't look completely grey
        if (label === 'Note') colorSet = { color: 'text-sky-400', bgColor: 'bg-sky-950/40', borderColor: 'border-sky-500/60' };
        else if (label === 'Source') colorSet = { color: 'text-orange-400', bgColor: 'bg-orange-950/40', borderColor: 'border-orange-500/60' };
        else if (label === 'Collection') colorSet = { color: 'text-indigo-400', bgColor: 'bg-indigo-950/40', borderColor: 'border-indigo-500/60' };
        else if (label === 'Organization') colorSet = { color: 'text-blue-400', bgColor: 'bg-blue-950/40', borderColor: 'border-blue-500/60' };
        else if (label === 'Location') colorSet = { color: 'text-rose-400', bgColor: 'bg-rose-950/40', borderColor: 'border-rose-500/60' };
        else if (label === 'Activity') colorSet = { color: 'text-emerald-400', bgColor: 'bg-emerald-950/40', borderColor: 'border-emerald-500/60' };
        else if (label === 'Event') colorSet = { color: 'text-amber-400', bgColor: 'bg-amber-950/40', borderColor: 'border-amber-500/60' };
        else if (label === 'Content') colorSet = { color: 'text-stone-400', bgColor: 'bg-stone-950/40', borderColor: 'border-stone-500/60' };
        else if (label === 'Concept') colorSet = { color: 'text-fuchsia-400', bgColor: 'bg-fuchsia-950/40', borderColor: 'border-fuchsia-500/60' };
        else if (label === 'TimeBlock') colorSet = { color: 'text-purple-400', bgColor: 'bg-purple-950/40', borderColor: 'border-purple-500/60' };
        else if (subtype === 'tool') colorSet = { color: 'text-amber-400', bgColor: 'bg-amber-950/40', borderColor: 'border-amber-500/60' };
        else if (subtype === 'project') colorSet = { color: 'text-emerald-400', bgColor: 'bg-emerald-950/40', borderColor: 'border-emerald-500/60' };
        else if (subtype === 'person') colorSet = { color: 'text-violet-400', bgColor: 'bg-violet-950/40', borderColor: 'border-violet-500/60' };
        else if (subtype === 'automation') colorSet = { color: 'text-cyan-400', bgColor: 'bg-cyan-950/40', borderColor: 'border-cyan-500/60' };
        else if (subtype === 'integration') colorSet = { color: 'text-teal-400', bgColor: 'bg-teal-950/40', borderColor: 'border-teal-500/60' };
    }

    return { ...cfg, ...colorSet };
}



// ── Component ────────────────────────────────────────────────

function KnowledgeNodeInner({ data, selected }: NodeProps) {
    const nodeData = data as unknown as NodeData;
    const config = useMemo(() => getVisualConfig(nodeData), [nodeData]);

    const Icon = config.icon;
    const importance = nodeData.importance || 3;
    const scale = 0.85 + (importance / 5) * 0.3;

    return (
        <div
            className="relative group flex flex-col items-center justify-center cursor-pointer"
            style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
        >
            {/* Concentric Status Rings (Visible when selected) */}
            {selected && (
                <>
                    <div className="absolute w-[80px] h-[80px] rounded-full border border-blue-500/40 ring-pulse pointer-events-none scale-100 animate-in zoom-in duration-200"></div>
                    <div className="absolute w-[70px] h-[70px] rounded-full border border-blue-500/20 pointer-events-none scale-100 animate-in zoom-in duration-300"></div>
                </>
            )}

            {/* Main Node */}
            <div
                className={`
                    relative flex items-center justify-center w-14 h-14 border border-white/10
                    ${config.bgColor} ${config.color}
                    ${selected ? 'node-glow' : 'shadow-md shadow-black/50'}
                    hover:brightness-125 transition-all duration-200 z-10
                    ${config.dashed ? 'border-dashed border-2' : ''}
                    ${config.shape === 'hexagon' ? 'clip-hexagon' : config.shape === 'diamond' ? 'clip-diamond' : config.shape === 'square' ? 'rounded-md' : 'rounded-full'}
                    glass-morphism overflow-hidden
                `}
            >
                {/* Inner Decorative Pattern */}
                <div className="absolute inset-0 bg-mesh pointer-events-none opacity-60"></div>

                {/* Central Icon */}
                <div className="relative z-10 flex flex-col items-center justify-center">
                    <Icon size={24} className="drop-shadow-[0_0_8px_currentColor]" />
                </div>
            </div>

            {/* Entity Name */}
            <div className="mt-2 text-center w-max max-w-[140px] z-20">
                <span className="text-xs font-medium text-zinc-100 bg-zinc-900/80 border border-zinc-700/50 px-2.5 py-1 rounded-md backdrop-blur-md truncate block shadow-lg">
                    {nodeData.name}
                </span>
            </div>

            {/* target handle on left */}
            <Handle
                type="target"
                position={Position.Left}
                className="!w-4 !h-4 !-ml-2 !border-2 !border-zinc-900 !bg-zinc-400 absolute top-[24px]"
            />
            {/* source handle on right */}
            <Handle
                type="source"
                position={Position.Right}
                className="!w-4 !h-4 !-mr-2 !border-2 !border-zinc-900 !bg-zinc-400 absolute top-[24px]"
            />
        </div>
    );
}

export const KnowledgeNode = memo(KnowledgeNodeInner);
