import { useMemo, useState } from 'react';

export default function Sidebar({ services, loading, error, selected, onSelect }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return services;
    const q = query.toLowerCase();
    return services.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.team || '').toLowerCase().includes(q)
    );
  }, [services, query]);

  const grouped = useMemo(() => {
    const byTeam = {};
    for (const s of filtered) {
      const team = s.team || 'Unassigned';
      if (!byTeam[team]) byTeam[team] = [];
      byTeam[team].push(s);
    }
    return byTeam;
  }, [filtered]);

  return (
    <aside className="sidebar">
      <input
        className="sidebar__search"
        placeholder="Search services or teams…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search services"
      />

      {loading && (
        <div className="loading-state">
          <span className="loading-pulse" /> loading services…
        </div>
      )}

      {error && !loading && (
        <div className="error-state" style={{ padding: '24px 4px' }}>
          <div className="error-state__icon">⨯</div>
          <div>{error}</div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state" style={{ padding: '24px 4px' }}>
          <div className="empty-state__icon">∅</div>
          <div>No services match "{query}".</div>
        </div>
      )}

      {!loading &&
        !error &&
        Object.entries(grouped).map(([team, items]) => (
          <div key={team}>
            <div className="sidebar__section-label">{team}</div>
            {items.map((s) => (
              <button
                key={s.name}
                className={`service-item ${selected === s.name ? 'service-item--active' : ''}`}
                onClick={() => onSelect(s.name)}
              >
                <span className={`service-item__tier tier-${s.tier || 'low'}`} />
                <span className="service-item__name">{s.name}</span>
              </button>
            ))}
          </div>
        ))}
    </aside>
  );
}
