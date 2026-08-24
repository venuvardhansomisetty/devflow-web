const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Thin fetch wrapper. Every consumer gets a consistent shape:
 * { ok, data, error }. Callers decide how to render error/empty states -
 * this module never throws, so a single unreachable-database failure
 * can't crash a component tree.
 */
async function request(path) {
  try {
    const res = await fetch(`${BASE}${path}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, data: null, error: body.message || body.error || `Request failed (${res.status})` };
    }
    return { ok: true, data: body, error: null };
  } catch (err) {
    return { ok: false, data: null, error: 'Could not reach the DevFlow API. Is the backend running?' };
  }
}

export const api = {
  health: () => request('/health'),
  listServices: () => request('/services'),
  listIncidents: () => request('/incidents'),
  dependencies: (name) => request(`/services/${encodeURIComponent(name)}/dependencies`),
  blastRadius: (name, hops = 3) => request(`/services/${encodeURIComponent(name)}/blast-radius?hops=${hops}`),
  incidentImpact: (id) => request(`/incidents/${encodeURIComponent(id)}/impact-path`),
  shortestPath: (from, to) => request(`/services/path/find?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  riskHotspots: (days = 30, minIncidents = 2) => request(`/services/risk/hotspots?days=${days}&minIncidents=${minIncidents}`),
};
