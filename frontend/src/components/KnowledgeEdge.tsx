import { memo } from 'react';
import {
    getBezierPath,
    EdgeLabelRenderer,
    type EdgeProps,
} from '@xyflow/react';

// ── Relationship colour map ──────────────────────────────────

const REL_COLORS: Record<string, string> = {
    RELATES_TO: '#64748b',   // slate
    DEPENDS_ON: '#f97316',   // orange
    PART_OF: '#8b5cf6',      // violet
    BLOCKS: '#ef4444',       // red
    TAGGED: '#a1a1aa',       // zinc
    CONTAINS: '#6366f1',     // indigo
    REFERENCES: '#06b6d4',   // cyan
    HAS_SOURCE: '#f59e0b',   // amber
    DERIVED_FROM: '#10b981', // emerald
    READS_FROM: '#3b82f6',   // blue
    WRITES_TO: '#22c55e',    // green
    TRIGGERS: '#ec4899',     // pink
    CALLS: '#14b8a6',        // teal
};

function getEdgeColor(relType: string): string {
    return REL_COLORS[relType] || '#64748b';
}

// ── Component ────────────────────────────────────────────────

interface KnowledgeEdgeData {
    rel_type: string;
    weight?: number;
    context?: string;
}

function KnowledgeEdgeInner({
    id,
    sourceX, sourceY,
    targetX, targetY,
    sourcePosition, targetPosition,
    markerEnd,
    data,
}: EdgeProps) {
    const edgeData = data as unknown as KnowledgeEdgeData;
    const relType = edgeData?.rel_type || 'RELATES_TO';
    const color = getEdgeColor(relType);
    const weight = edgeData?.weight || 0.5;

    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX, sourceY,
        targetX, targetY,
        sourcePosition, targetPosition,
    });

    // Agent relationships get dashed strokes
    const isAgentEdge = ['READS_FROM', 'WRITES_TO', 'TRIGGERS', 'CALLS'].includes(relType);

    return (
        <>
            <path
                id={id}
                d={edgePath}
                stroke={color}
                strokeWidth={0.8 + weight * 1.5}
                strokeOpacity={0.5}
                strokeDasharray={isAgentEdge ? '6 3' : undefined}
                fill="none"
                className="react-flow__edge-path transition-all duration-200 hover:!stroke-opacity-100"
                markerEnd={markerEnd}
            />

            <EdgeLabelRenderer>
                <div
                    className="
            absolute pointer-events-auto cursor-default
            px-1.5 py-0.5 rounded text-[8px] font-medium
            bg-zinc-900/90 backdrop-blur-sm border border-zinc-700/50
            opacity-0 group-hover:opacity-100 transition-opacity
            whitespace-nowrap
          "
                    style={{
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        color,
                    }}
                >
                    {relType.replace(/_/g, ' ')}
                </div>
            </EdgeLabelRenderer>
        </>
    );
}

export const KnowledgeEdge = memo(KnowledgeEdgeInner);
