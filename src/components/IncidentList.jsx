import { useEffect, useState } from 'react';
import { api } from '../api';

function SeverityBadge({ severity }) {
  return <span className={`badge badge--${severity}`}>{severity}</span>;
}

export default function IncidentList({ incidents, loading, error }) {
  const [selectedId, setSelectedId] = useState(null);
  const [impact, setImpact] = useState(null);
  const [impactError, setImpactError] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) return;
    setImpactLoading(true);
    setImpactError(null);
    api.incidentImpact(selectedId).then((res) => {
      setImpactLoading(false);
      if (res.ok) setImpact(res.data);
      else setImpactError(res.error);
    });
  }, [selectedId]);

  if (loading) {
    return (
      <div className="loading-state">
        <span className="loading-pulse" /> loading incidents…
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <div className="error-state__icon">⨯</div>
        <div>{error}</div>
      </div>
    );
  }

  if (!incidents.length) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">∅</div>
        <div>No incidents recorded yet.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: 24 }}>
        <div>
          {incidents.map((inc) => (
            <div
              key={inc.id}
              className="incident-card"
              onClick={() => setSelectedId(inc.id)}
              style={selectedId === inc.id ? { borderColor: 'var(--signal-teal)' } : undefined}
            >
              <div className="incident-card__top">
                <span className="incident-card__id">{inc.id}</span>
                <SeverityBadge severity={inc.severity} />
              </div>
              <div className="incident-card__title">{inc.title}</div>
              <div className="incident-card__services">{inc.services.join(', ')}</div>
            </div>
          ))}
        </div>

        <div>
          {!selectedId && (
            <div className="empty-state">
              <div className="empty-state__icon">→</div>
              <div>Select an incident to trace its likely root cause through the dependency graph.</div>
            </div>
          )}

          {selectedId && impactLoading && (
            <div className="loading-state">
              <span className="loading-pulse" /> tracing impact path…
            </div>
          )}

          {selectedId && impactError && !impactLoading && (
            <div className="error-state">
              <div className="error-state__icon">⨯</div>
              <div>{impactError}</div>
            </div>
          )}

          {selectedId && impact && !impactLoading && !impactError && (
            <svg width={Math.max(320, impact.chain.length * 190)} height={120} role="img" aria-label="Incident impact chain">
              <defs>
                <marker id="arrow-impact" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="var(--signal-coral)" />
                </marker>
              </defs>
              {impact.chain.map((node, i) => {
                const x = i * 190 + 20;
                const y = 40;
                const isLast = i === impact.chain.length - 1;
                return (
                  <g key={node + i}>
                    {i < impact.chain.length - 1 && (
                      <line
                        x1={x + 150}
                        y1={y + 18}
                        x2={x + 190}
                        y2={y + 18}
                        stroke="var(--signal-coral)"
                        strokeWidth="1.6"
                        className="signal-edge"
                        markerEnd="url(#arrow-impact)"
                      />
                    )}
                    <rect
                      x={x}
                      y={y}
                      width={150}
                      height={36}
                      rx={6}
                      fill={i === 0 ? 'var(--signal-coral-dim)' : 'var(--panel-raised)'}
                      stroke={i === 0 ? 'var(--signal-coral)' : 'var(--border)'}
                    />
                    <text x={x + 75} y={y + 22} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="var(--text-primary)">
                      {node.length > 18 ? node.slice(0, 16) + '…' : node}
                    </text>
                    <text x={x + 75} y={y - 6} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill="var(--text-dim)">
                      {i === 0 ? 'AFFECTED' : isLast ? 'ROOT DEPENDENCY' : ''}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
