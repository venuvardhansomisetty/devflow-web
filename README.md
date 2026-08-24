

# DevFlow


Explore service dependencies, incidents, and deployments as a connected graph.

DevFlow answers the questions an on-call engineer actually has during an incident:
*If Payment Service goes down, what else breaks downstream?* *What's the shortest
chain of dependencies connecting Checkout to Postgres?* *Is there one flaky
dependency behind several recent incidents?*

Backed by **CognoDB** (openCypher over Bolt), Express, and React.

---

## Why a graph database?

A service topology is a graph by nature — services depend on other services and
datastores, calls fan out and back, incidents ripple along dependency edges. A
relational schema forces this into a `dependencies` join table (`service_id`,
`depends_on_id`), and every interesting question becomes a recursive query:

| Question | Relational | Graph (Cypher) |
|---|---|---|
| Direct dependencies of a service | `SELECT ... WHERE service_id = ?` | `(s)-[:DEPENDS_ON]->(d)` |
| **Everything downstream, 3+ hops out** (blast radius) | Recursive CTE with manual cycle guarding, re-run per depth | `(origin)<-[:DEPENDS_ON*1..3]-(dependent)` — one clause |
| **Shortest path between two arbitrary services** | Recursive CTE with a visited-set and no guaranteed shortest-path semantics, or a separate graph library bolted onto the app | `shortestPath((a)-[:DEPENDS_ON\|CALLS*..8]-(b))` — native, guaranteed shortest |
| Services sharing a dependency that's linked to repeated incidents | Multi-way self-join across an incident-count subquery and a dependency-join table | One pattern match with aggregation |

The traversal depth in a service graph isn't fixed — a blast radius might be 2
hops or 6 depending on the incident — and relational joins don't scale cleanly
with variable depth the way a Cypher variable-length pattern does. That's the
core argument for a graph database here: **the interesting operations are all
path operations**, not row lookups.

---

## Data model

```
                     ┌─────────┐
                     │  Team   │
                     └────┬────┘
                          │ OWNS
                          ▼
      ┌──────────────────────────────────────┐
      │               Service                 │◄────────┐
      │  name, tier, description              │         │
      └───────┬───────────────┬───────────────┘         │
              │ DEPENDS_ON     │ CALLS                   │ DEPENDS_ON
              ▼                ▼                         │
      ┌───────────────┐  ┌───────────┐                   │
      │  Datastore     │  │  Service  │───────────────────┘
      │  name, type    │  └───────────┘
      └───────────────┘

      ┌───────────┐  AFFECTS   ┌───────────┐
      │ Incident  │───────────▶│  Service  │
      │ id, sev.  │            └───────────┘
      └───────────┘

      ┌────────────┐ DEPLOYED  ┌───────────┐
      │ Deployment │──────────▶│  Service  │
      │ id, version│           └───────────┘
      └────────────┘
```

**Nodes**
- `Service {name, tier, description}` — tier is `critical | high | medium | low`
- `Datastore {name, type}` — e.g. PostgreSQL, Redis, Kafka, MongoDB, Elasticsearch
- `Team {name}`
- `Incident {id, title, severity, status, startedAt, resolvedAt}`
- `Deployment {id, version, deployedAt, status}`

**Relationships**
- `(Service)-[:DEPENDS_ON]->(Service | Datastore)` — a hard runtime dependency
- `(Service)-[:CALLS]->(Service)` — a synchronous call, lighter than a hard dependency
- `(Team)-[:OWNS]->(Service)`
- `(Incident)-[:AFFECTS]->(Service)`
- `(Deployment)-[:DEPLOYED]->(Service)`

---

## The main queries

All Cypher lives in [`backend/src/db/queries.js`](backend/src/db/queries.js), separated
from route handlers so each one can be read and defended independently.

1. **Blast radius** (`blastRadius`, multi-hop, 1–5 configurable) — walks
   `DEPENDS_ON` *backwards* from a service to find everything that transitively
   depends on it: `(origin)<-[:DEPENDS_ON*1..N]-(dependent)`. Powers the "Blast
   Radius" tab, where affected services render in concentric rings by hop
   distance.

2. **Dependency tree** (`dependencyTree`) — the forward version: what a service
   depends on, up to 3 hops, including datastores. Powers the "Dependencies"
   tab's layered graph view.

3. **Incident impact path** (`incidentImpactPath`) — from an `Incident`, follows
   `AFFECTS` then the longest available `DEPENDS_ON` chain to surface a likely
   root dependency. Renders as a chain from "affected service" to "root
   dependency" in the Incidents tab.

4. **Shortest path** (`shortestPath`) — *the relational-database-awkward one.*
   `shortestPath((a)-[:DEPENDS_ON|CALLS*..8]-(b))` finds the shortest connection
   between any two services regardless of direction, in a single clause, with
   guaranteed shortest-path semantics. Powers the "Path Finder" tab.

5. **Risk hotspots** (`riskHotspots`) — *also relational-awkward.* Finds
   datastores/services that are a shared dependency of two or more services
   which each had incidents in the last N days — i.e. a likely single point of
   failure behind several unrelated-looking incidents. Combines an aggregation
   (`count(DISTINCT i)`) with a graph traversal (`-[:DEPENDS_ON]->`) in one
   query.

All queries are parameterised through the official Neo4j driver (`session.run(cypher, params)`)
— no string-concatenated Cypher anywhere. The one exception is documented inline
in `queries.js`: Cypher doesn't allow a bound parameter inside a variable-length
relationship pattern (`*1..$hops` isn't valid openCypher), so the hop count for
blast radius is validated and clamped to a safe integer range (1–5) server-side
before being inlined into the query text — the actual untrusted input (the
service name) stays a normal bound parameter throughout.

---

## Project structure

```
devflow/
├── backend/
│   ├── src/
│   │   ├── config/db.js          # driver setup, connection verification, query runner
│   │   ├── db/
│   │   │   ├── queries.js        # all Cypher, documented
│   │   │   └── seed.js           # loads realistic seed data
│   │   ├── routes/
│   │   │   ├── services.routes.js
│   │   │   └── incidents.routes.js
│   │   ├── middleware/errorHandler.js
│   │   └── server.js
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── components/           # Sidebar, GraphCanvas, DetailPanel, IncidentList, PathFinder, RiskHotspots, TopBar
    │   ├── api.js                 # fetch wrapper, never throws — callers get {ok, data, error}
    │   └── App.jsx
    └── .env.example
```

---

## Setup

### 1. Create a CognoDB instance

1. Sign up at [console.cognodb.com/signup](https://console.cognodb.com/signup) (no card required).
2. Create a free `c0` instance and pick a region — provisions in under a minute.
3. Copy the connection URI (`bolt+s://<instance-id>.databases.cognodb.cloud`) and
   the generated password for user `cognodb`. **The password is shown once** —
   save it now.

### 2. Backend

```bash
cd backend
cp .env.example .env
# edit .env with your COGNODB_URI and COGNODB_PASSWORD
npm install
npm run seed   # loads teams, services, datastores, incidents, deployments
npm run dev    # starts the API on http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev    # starts on http://localhost:5173, proxies /api to :4000
```

Open `http://localhost:5173`.

### Error handling

If the backend can't reach CognoDB — wrong credentials, instance paused, network
issue — it still starts (logging a clear warning) and every route returns a
`503 DATABASE_UNAVAILABLE` with a plain-language message instead of crashing.
The frontend surfaces this as an inline error state per panel, and the top bar
shows a live connection indicator.


---
## Deployment link

Demo:https://devflow-web-five.vercel.app/


---



## Screenshots

<img width="1366" height="728" alt="Screenshot 2026-08-23 215410" src="https://github.com/user-attachments/assets/c1caa20f-6a29-4ea4-9a42-e9d8dbf760d1" />
<img width="1366" height="728" alt="Screenshot 2026-08-23 215350" src="https://github.com/user-attachments/assets/0980b5b0-745f-4f01-8604-5d2025b13677" />



<img width="1365" height="687" alt="Screenshot 2026-08-23 215516" src="https://github.com/user-attachments/assets/5cccd5c4-0238-4102-8f71-f128599dbd1a" />
<img width="1365" height="690" alt="Screenshot 2026-08-23 215456" src="https://github.com/user-attachments/assets/59745221-82f5-4853-a938-7e30d793aef0" />
<img width="1365" height="685" alt="Screenshot 2026-08-23 215433" src="https://github.com/user-attachments/assets/d7087ea2-ed6c-41e3-b3ef-7cb36b43417b" />

---
## Screen Recording

<div style="position: relative; padding-bottom: 56.22254758418741%; height: 0;"><iframe src="https://www.loom.com/embed/80d1f3a9f51a4beea9cde442cbc8148a" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>




