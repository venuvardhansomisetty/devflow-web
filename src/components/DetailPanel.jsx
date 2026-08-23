export default function DetailPanel({ service }) {
  if (!service) {
    return (
      <aside className="detail-panel">
        <div className="empty-state">
          <div className="empty-state__icon">→</div>
          <div>Select a service to see its details.</div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="detail-panel">
      <h3>{service.name}</h3>
      <p className="detail-panel__desc">{service.description || 'No description recorded.'}</p>
      <div className="meta-row">
        <span className="meta-row__label">TEAM</span>
        <span>{service.team || '—'}</span>
      </div>
      <div className="meta-row">
        <span className="meta-row__label">TIER</span>
        <span className={`badge badge--${service.tier || 'low'}`}>{service.tier || 'unknown'}</span>
      </div>
    </aside>
  );
}
