import { memo, useState } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

function CustomEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style = {},
  data,
  markerEnd,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    curvature: 0.25,
  });

  const label = (data?.label as string) ?? '';
  const isViolation = style?.stroke === '#FF3B30';
  const isCycle     = style?.stroke === '#FF9F0A';

  const tooltipColor = isCycle ? '#CC7A00' : isViolation ? '#CC2A20' : '#007AFF';
  const tooltipBg    = isCycle
    ? 'rgba(255,159,10,0.10)'
    : isViolation
    ? 'rgba(255,59,48,0.08)'
    : 'rgba(0,122,255,0.07)';
  const tooltipBorder = isCycle
    ? 'rgba(255,159,10,0.22)'
    : isViolation
    ? 'rgba(255,59,48,0.20)'
    : 'rgba(0,122,255,0.18)';

  return (
    <g>
      {/* Wide invisible hit area */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={18}
        fill="none"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'crosshair' }}
      />

      {/* Actual visible edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={markerEnd}
      />

      {/* Small animated dot at midpoint */}
      {!hovered && (
        <circle
          cx={labelX}
          cy={labelY}
          r={3}
          fill={style?.stroke as string ?? '#007AFF'}
          opacity={0.55}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Glass tooltip on hover */}
      {hovered && label && (
        <foreignObject
          x={labelX - 80}
          y={labelY - 16}
          width={160}
          height={32}
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div
            style={{
              background: tooltipBg,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: `1px solid ${tooltipBorder}`,
              borderRadius: '8px',
              padding: '4px 10px',
              fontSize: '9.5px',
              fontFamily: "'DM Mono', monospace",
              fontWeight: 500,
              color: tooltipColor,
              whiteSpace: 'nowrap',
              boxShadow: `0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)`,
              textAlign: 'center',
              maxWidth: '160px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '32px',
            } as React.CSSProperties}
          >
            {label}
          </div>
        </foreignObject>
      )}
    </g>
  );
}

export default memo(CustomEdge);
