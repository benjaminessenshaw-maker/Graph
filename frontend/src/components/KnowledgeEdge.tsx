import { memo } from 'react';
import {
    getBezierPath,
    EdgeLabelRenderer,
    type EdgeProps,
} from '@xyflow/react';

// ── Component ────────────────────────────────────────────────

interface KnowledgeEdgeData {
    rel_type: string;
    weight?: number;
    context?: string;
    parallelIndex?: number;
    isReverse?: boolean;
}

function KnowledgeEdgeInner({
    id,
    sourceX, sourceY,
    targetX, targetY,
    sourcePosition, targetPosition,
    markerEnd,
    data,
    style,
}: EdgeProps) {
    const edgeData = data as unknown as KnowledgeEdgeData;
    const relType = edgeData?.rel_type || 'RELATES_TO';
    // Use the color passed down from App.tsx mapping to ensure visual sync everywhere
    const color = style?.stroke?.toString() || '#64748b';
    const weight = edgeData?.weight || 0.5;
    const parallelIndex = edgeData?.parallelIndex || 0;
    const isReverse = edgeData?.isReverse || false;

    let [edgePath, labelX, labelY] = getBezierPath({
        sourceX, sourceY,
        targetX, targetY,
        sourcePosition, targetPosition,
    });

    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;

    // Calculate repeating arrows along the path
    const arrowSpacing = 60;
    const numArrows = Math.floor(length / arrowSpacing);
    const step = numArrows > 0 ? 100 / (numArrows + 1) : 0;

    if (parallelIndex > 0) {
        // Curve the edge so parallel edges are distinct
        // Normal vector (normalized)
        const nx = -dy / length;
        const ny = dx / length;

        // How far to offset? 1st parallel -> +30px, 2nd -> -30px, 3rd -> +60px, etc.
        const offsetMagnitude = Math.ceil(parallelIndex / 2) * 35;
        const sign = (parallelIndex % 2 === 0) ? -1 : 1;

        // Flip sign if isReverse so same-direction pairs consistently alternate 
        // and opposite-direction pairs bow away from each other
        const finalSign = isReverse ? -sign : sign;
        const offset = offsetMagnitude * finalSign;

        // Calculate control point midway along the edge, pushed out by the normal vector
        const midX = sourceX + dx / 2 + nx * offset;
        const midY = sourceY + dy / 2 + ny * offset;

        // Quadratic bezier
        edgePath = `M ${sourceX} ${sourceY} Q ${midX} ${midY} ${targetX} ${targetY}`;
        // Peak of the curve roughly at halfway 
        labelX = sourceX + dx / 2 + nx * (offset * 0.5);
        labelY = sourceY + dy / 2 + ny * (offset * 0.5);
    }

    // Agent relationships get dashed strokes
    const isAgentEdge = ['READS_FROM', 'WRITES_TO', 'TRIGGERS', 'CALLS'].includes(relType);

    return (
        <>
            {/* Invisible thicker path for easier interaction/hovering */}
            <path
                id={`${id}-interaction`}
                d={edgePath}
                stroke="transparent"
                strokeWidth={15}
                fill="none"
                className="react-flow__edge-interaction"
            />

            {/* Visible edge path */}
            <path
                id={id}
                d={edgePath}
                stroke={color}
                strokeWidth={1.5 + weight * 2} // Increased base thickness
                strokeOpacity={0.6}
                strokeDasharray={isAgentEdge ? '6 3' : undefined}
                fill="none"
                className="react-flow__edge-path transition-all duration-200 group-hover:!stroke-opacity-100 group-hover:!stroke-white"
                markerEnd={markerEnd}
            />

            {numArrows > 0 && Array.from({ length: numArrows }).map((_, i) => (
                <text
                    key={`${id}-arrow-${i}`}
                    fill={color}
                    fontSize="11px"
                    dominantBaseline="central"
                    className="pointer-events-none select-none opacity-60 transition-opacity"
                >
                    <textPath
                        href={`#${id}`}
                        startOffset={`${step * (i + 1)}%`}
                        textAnchor="middle"
                    >
                        ➤
                    </textPath>
                </text>
            ))}

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
