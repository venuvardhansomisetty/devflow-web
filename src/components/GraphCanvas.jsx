import { useMemo } from 'react';

const NODE_W = 150;
const NODE_H = 40;
const COL_GAP = 110;
const ROW_GAP = 20;

/**
 * Builds left-to-right layers via BFS from the origin, using the flat
 * edge list returned by the /dependencies endpoint. Pure layout math -
 * no external graph library needed for a tree of this size.
 */
function layoutLayers(origin, edges) {
  const children = {};
  const nodeTypes = { [origin]: 'Service' };
  for (const e of edges) {
    if (!children[e.from]) children[e.from] = [];
    children[e.from].push(e.to);
    nodeTypes[e.to] = e.toType || 'Service';
  }

  const layers = [[origin]];
  const visited = new Set([origin]);
  let frontier = [origin];

  while (frontier.length && layers.length < 5) {
    const next = [];
    for (const node of frontier) {
      for (const child of children[node] || []) {
        if (!visited.has(child)) {
          visited.add(child);
          next.push(child);
        }
      }
    }
    if (next.length === 0) break;
    layers.push(next);
    frontier = next;
  }

  const positions = {};
  layers.forEach((layer, colIdx) => {
    const totalH = layer.length * NODE_H + (layer.length - 1) * ROW_GAP;
    layer.forEach((node, rowIdx) => {
      positions[node] = {
        x: colIdx * (NODE_W + COL_GAP) + 20,
        y: rowIdx * (NODE_H + ROW_GAP) - totalH / 2,
        type: nodeTypes[node],
      };
    });
  });

  const width = layers.length * (NODE_W + COL_GAP) + 40;
  const maxRows = Math.max(...layers.map((l) => l.length));
  const height = maxRows * (NODE_H + ROW_GAP) + 60;

  return { positions, width, height, edges: edges.filter((e) => positions[e.from] && positions[e.to]) };
}

function NodeBox({ x, y, label, type, highlight }) {
  const isDatastore = type === 'Datastore';
  const stroke = highlight ? 'var(--signal-teal)' : isDatastore ? 'var(--signal-amber)' : 'var(--border)';
  const fill = highlight ? 'var(--signal-teal-dim)' : 'var(--panel-raised)';
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={6}
        fill={fill}
        stroke={stroke}
        strokeWidth={highlight ? 1.5 : 1}
      />
      <text
        x={NODE_W / 2}
        y={NODE_H / 2 - 3}
        textAnchor="middle"
        fontFamily="IBM Plex Mono, monospace"
        fontSize="11"
        fill="var(--text-primary)"
      >
        {label.length > 20 ? label.slice(0, 18) + '…' : label}
      </text>
      {isDatastore && (
        <text x={NODE_W / 2} y={NODE_H / 2 + 12} textAnchor="middle" fontSize="9" fill="var(--signal-amber)" fontFamily="IBM Plex Mono, monospace">
          DATASTORE
        </text>
      )}
    </g>
  );
}

export function DependencyGraph({ origin, edges }) {
  const layout = useMemo(() => layoutLayers(origin, edges), [origin, edges]);
  const midY = layout.height / 2;

  return (
    <svg width={layout.width} height={layout.height} role="img" aria-label={`Dependency graph for ${origin}`}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--text-dim)" />
        </marker>
      </defs>
      <g transform={`translate(0, ${midY})`}>
        {layout.edges.map((e, i) => {
          const from = layout.positions[e.from];
          const to = layout.positions[e.to];
          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          return (
            <path
              key={i}
              d={`M${x1},${y1} C${x1 + 40},${y1} ${x2 - 40},${y2} ${x2},${y2}`}
              fill="none"
              stroke="var(--text-dim)"
              strokeWidth="1.4"
              markerEnd="url(#arrow)"
            />
          );
        })}
        {Object.entries(layout.positions).map(([name, pos]) => (
          <NodeBox key={name} x={pos.x} y={pos.y} label={name} type={pos.type} highlight={name === origin} />
        ))}
      </g>
    </svg>
  );
}

/**
 * Radial blast-radius view: origin at the center, affected services
 * arranged in rings by hop distance. Edges pulse outward from the
 * origin - the signal-propagation motif that ties the visual language
 * back to what an incident actually does in this domain.
 */
export function BlastRadiusGraph({ origin, affected }) {
  const width = 640;
  const height = 480;
  const cx = width / 2;
  const cy = height / 2;

  const byDistance = useMemo(() => {
    const groups = {};
    for (const a of affected) {
      const d = a.distance;
      if (!groups[d]) groups[d] = [];
      groups[d].push(a.name);
    }
    return groups;
  }, [affected]);

  const distances = Object.keys(byDistance).map(Number).sort((a, b) => a - b);
  const maxRing = distances.length ? Math.max(...distances) : 1;
  const ringGap = Math.min(150, (Math.min(width, height) / 2 - 60) / Math.max(maxRing, 1));

  return (
    <svg width={width} height={height} role="img" aria-label={`Blast radius for ${origin}`}>
      {distances.map((d) => (
        <circle
          key={`ring-${d}`}
          cx={cx}
          cy={cy}
          r={ringGap * d}
          fill="none"
          stroke="var(--border)"
          strokeDasharray="3 5"
        />
      ))}

      {distances.map((d) =>
        byDistance[d].map((name, i) => {
          const nodesInRing = byDistance[d].length;
          const angle = (2 * Math.PI * i) / nodesInRing - Math.PI / 2;
          const r = ringGap * d;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          const severity = d === 1 ? 'var(--signal-coral)' : d === 2 ? 'var(--signal-amber)' : 'var(--signal-teal)';
          return (
            <g key={name}>
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke={severity}
                strokeWidth="1.2"
                className="signal-edge"
                opacity={0.55}
              />
              <circle cx={x} cy={y} r={5} fill={severity} />
              <text
                x={x}
                y={y - 12}
                textAnchor="middle"
                fontFamily="IBM Plex Mono, monospace"
                fontSize="10.5"
                fill="var(--text-primary)"
              >
                {name.length > 18 ? name.slice(0, 16) + '…' : name}
              </text>
            </g>
          );
        })
      )}

      <circle cx={cx} cy={cy} r={26} fill="var(--signal-teal-dim)" stroke="var(--signal-teal)" strokeWidth="1.5" />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontFamily="IBM Plex Mono, monospace"
        fontSize="10"
        fill="var(--signal-teal)"
      >
        {origin.length > 14 ? origin.slice(0, 12) + '…' : origin}
      </text>
    </svg>
  );
}
