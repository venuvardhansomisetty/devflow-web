export default function TopBar({ health }) {
  const statusLabel = health === 'ok' ? 'CognoDB connected' : health === 'down' ? 'CognoDB unreachable' : 'Checking connection…';
  const dotClass = health === 'ok' ? 'status-dot--ok' : health === 'down' ? 'status-dot--down' : 'status-dot--pending';

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__brand-dot" />
        DevFlow
      </div>
      <div className="topbar__status">
        <span className={`status-dot ${dotClass}`} />
        {statusLabel}
      </div>
    </header>
  );
}
