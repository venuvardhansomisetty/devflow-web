import { useEffect, useState } from 'react';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import DetailPanel from './components/DetailPanel';
import IncidentList from './components/IncidentList';
import PathFinder from './components/PathFinder';
import RiskHotspots from './components/RiskHotspots';
import { DependencyGraph, BlastRadiusGraph } from './components/GraphCanvas';
import { api } from './api';

const TABS = [
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'blast-radius', label: 'Blast Radius' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'path-finder', label: 'Path Finder' },
  { id: 'risk-hotspots', label: 'Risk Hotspots' },
];

export default function App() {
  const [health, setHealth] = useState('pending');
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState(null);

  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('dependencies');

  const [depData, setDepData] = useState(null);
  const [depLoading, setDepLoading] = useState(false);
  const [depError, setDepError] = useState(null);

  const [blastData, setBlastData] = useState(null);
  const [blastLoading, setBlastLoading] = useState(false);
  const [blastError, setBlastError] = useState(null);
  const [hops, setHops] = useState(3);

  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [incidentsError, setIncidentsError] = useState(null);

  useEffect(() => {
    api.health().then((res) => setHealth(res.ok ? 'ok' : 'down'));
    api.listServices().then((res) => {
      setServicesLoading(false);
      if (res.ok) {
        setServices(res.data.services);
        if (res.data.services.length) setSelected(res.data.services[0].name);
      } else {
        setServicesError(res.error);
      }
    });
    api.listIncidents().then((res) => {
      setIncidentsLoading(false);
      if (res.ok) setIncidents(res.data.incidents);
      else setIncidentsError(res.error);
    });
  }, []);

  useEffect(() => {
    if (!selected || activeTab !== 'dependencies') return;
    setDepLoading(true);
    setDepError(null);
    api.dependencies(selected).then((res) => {
      setDepLoading(false);
      if (res.ok) setDepData(res.data);
      else setDepError(res.error);
    });
  }, [selected, activeTab]);

  useEffect(() => {
    if (!selected || activeTab !== 'blast-radius') return;
    setBlastLoading(true);
    setBlastError(null);
    api.blastRadius(selected, hops).then((res) => {
      setBlastLoading(false);
      if (res.ok) setBlastData(res.data);
      else setBlastError(res.error);
    });
  }, [selected, activeTab, hops]);

  const selectedService = services.find((s) => s.name === selected) || null;

  return (
    <div className="app-shell">
      <TopBar health={health} />
      <Sidebar
        services={services}
        loading={servicesLoading}
        error={servicesError}
        selected={selected}
        onSelect={setSelected}
      />

      <main className="main">
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${activeTab === t.id ? 'tab--active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="canvas-area">
          {activeTab === 'dependencies' && (
            <>
              {!selected && (
                <div className="empty-state">
                  <div className="empty-state__icon">→</div>
                  <div>Select a service from the sidebar to see what it depends on.</div>
                </div>
              )}
              {selected && depLoading && (
                <div className="loading-state">
                  <span className="loading-pulse" /> tracing dependencies for {selected}…
                </div>
              )}
              {selected && depError && !depLoading && (
                <div className="error-state">
                  <div className="error-state__icon">⨯</div>
                  <div>{depError}</div>
                </div>
              )}
              {selected && depData && !depLoading && !depError && depData.edges.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state__icon">∅</div>
                  <div>{selected} has no recorded dependencies.</div>
                </div>
              )}
              {selected && depData && !depLoading && !depError && depData.edges.length > 0 && (
                <DependencyGraph origin={depData.origin} edges={depData.edges} />
              )}
            </>
          )}

          {activeTab === 'blast-radius' && (
            <>
              {!selected && (
                <div className="empty-state">
                  <div className="empty-state__icon">→</div>
                  <div>Select a service to see who's affected if it goes down.</div>
                </div>
              )}
              {selected && (
                <div className="hops-control">
                  <span>BLAST RADIUS DEPTH</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={hops}
                    onChange={(e) => setHops(Number(e.target.value))}
                  />
                  <span>{hops} hop{hops === 1 ? '' : 's'}</span>
                </div>
              )}
              {selected && blastLoading && (
                <div className="loading-state">
                  <span className="loading-pulse" /> computing blast radius for {selected}…
                </div>
              )}
              {selected && blastError && !blastLoading && (
                <div className="error-state">
                  <div className="error-state__icon">⨯</div>
                  <div>{blastError}</div>
                </div>
              )}
              {selected && blastData && !blastLoading && !blastError && blastData.affected.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state__icon">∅</div>
                  <div>Nothing downstream depends on {selected} within {hops} hops.</div>
                </div>
              )}
              {selected && blastData && !blastLoading && !blastError && blastData.affected.length > 0 && (
                <BlastRadiusGraph origin={blastData.origin} affected={blastData.affected} />
              )}
            </>
          )}

          {activeTab === 'incidents' && (
            <IncidentList incidents={incidents} loading={incidentsLoading} error={incidentsError} />
          )}

          {activeTab === 'path-finder' && <PathFinder services={services} />}

          {activeTab === 'risk-hotspots' && <RiskHotspots />}
        </div>
      </main>

      <DetailPanel service={selectedService} />
    </div>
  );
}
