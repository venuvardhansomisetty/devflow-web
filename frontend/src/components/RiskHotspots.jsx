import { useEffect, useState } from 'react';
import { api } from '../api';

export default function RiskHotspots() {
  const [hotspots, setHotspots] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.riskHotspots(30, 1).then((res) => {
      setLoading(false);
      if (res.ok) setHotspots(res.data.hotspots);
      else setError(res.error);
    });
  }, []);

  if (loading) {
    return (
      <div className="loading-state">
        <span className="loading-pulse" /> scanning for shared dependencies behind recent incidents…
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

  if (!hotspots || hotspots.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">∅</div>
        <div>No shared dependency currently correlates with multiple incident-prone services.</div>
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16, maxWidth: 620 }}>
        Dependencies shared by two or more services that each had incidents in the last 30 days —
        a likely single point of failure worth investigating first.
      </p>
      {hotspots.map((h) => (
        <div className="hotspot-card" key={h.sharedDependency}>
          <div className="hotspot-card__title">
            {h.sharedDependency} <span style={{ color: 'var(--text-dim)' }}>({h.dependencyType})</span>
          </div>
          <div className="hotspot-card__services">
            {h.affectedServices.map((s) => (
              <span className="hotspot-chip" key={s.service}>
                {s.service} · {s.incidents} incident{s.incidents === 1 ? '' : 's'}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
