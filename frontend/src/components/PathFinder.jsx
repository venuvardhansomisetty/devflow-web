import { useState } from 'react';
import { api } from '../api';

export default function PathFinder({ services }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleFind() {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await api.shortestPath(from, to);
    setLoading(false);
    if (res.ok) setResult(res.data);
    else setError(res.error);
  }

  return (
    <div>
      <div className="pathfinder-form">
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">From service…</option>
          {services.map((s) => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
        </select>
        <span style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono, monospace' }}>→</span>
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">To service…</option>
          {services.map((s) => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
        </select>
        <button onClick={handleFind} disabled={!from || !to || loading}>
          {loading ? 'Finding…' : 'Find path'}
        </button>
      </div>

      {loading && (
        <div className="loading-state">
          <span className="loading-pulse" /> searching the graph…
        </div>
      )}

      {error && !loading && (
        <div className="error-state">
          <div className="error-state__icon">⨯</div>
          <div>{error}</div>
        </div>
      )}

      {result && !loading && !error && !result.found && (
        <div className="empty-state">
          <div className="empty-state__icon">∅</div>
          <div>No path found between these two services within 8 hops.</div>
        </div>
      )}

      {result && !loading && !error && result.found && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
            Shortest path — <strong style={{ color: 'var(--text-primary)' }}>{result.hops}</strong> hop{result.hops === 1 ? '' : 's'}
          </p>
          <svg width={Math.max(320, result.path.length * 190)} height={110}>
            <defs>
              <marker id="arrow-path" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--signal-teal)" />
              </marker>
            </defs>
            {result.path.map((node, i) => {
              const x = i * 190 + 20;
              const y = 35;
              return (
                <g key={node + i}>
                  {i < result.path.length - 1 && (
                    <>
                      <line
                        x1={x + 150}
                        y1={y + 18}
                        x2={x + 190}
                        y2={y + 18}
                        stroke="var(--signal-teal)"
                        strokeWidth="1.6"
                        className="signal-edge"
                        markerEnd="url(#arrow-path)"
                      />
                      <text
                        x={x + 170}
                        y={y + 10}
                        textAnchor="middle"
                        fontFamily="IBM Plex Mono, monospace"
                        fontSize="8.5"
                        fill="var(--text-dim)"
                      >
                        {result.relTypes[i]}
                      </text>
                    </>
                  )}
                  <rect
                    x={x}
                    y={y}
                    width={150}
                    height={36}
                    rx={6}
                    fill={i === 0 || i === result.path.length - 1 ? 'var(--signal-teal-dim)' : 'var(--panel-raised)'}
                    stroke={i === 0 || i === result.path.length - 1 ? 'var(--signal-teal)' : 'var(--border)'}
                  />
                  <text x={x + 75} y={y + 22} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="var(--text-primary)">
                    {node.length > 18 ? node.slice(0, 16) + '…' : node}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="empty-state">
          <div className="empty-state__icon">→</div>
          <div>Pick two services to trace the shortest connection between them through the graph.</div>
        </div>
      )}
    </div>
  );
}
