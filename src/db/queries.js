/**
 * All Cypher lives here, separated from route handlers, so the queries
 * can be read, tested and explained independently of Express plumbing.
 * Every query is parameterised - the driver sends params separately
 * from the query text, so there is no string concatenation anywhere.
 */

// --- Lookups -----------------------------------------------------------

const listServices = `
  MATCH (s:Service)
  OPTIONAL MATCH (t:Team)-[:OWNS]->(s)
  RETURN s.name AS name, s.tier AS tier, s.description AS description,
         t.name AS team
  ORDER BY s.name
`;

const listIncidents = `
  MATCH (i:Incident)-[:AFFECTS]->(s:Service)
  RETURN i.id AS id, i.title AS title, i.severity AS severity,
         i.status AS status, i.startedAt AS startedAt, i.resolvedAt AS resolvedAt,
         collect(DISTINCT s.name) AS services
  ORDER BY i.startedAt DESC
`;

// --- Multi-hop traversal: blast radius ----------------------------------
// "If this service goes down, what else is affected?" - walks DEPENDS_ON
// backwards (who depends on me) up to `hops` levels. A relational schema
// would need a recursive CTE with manual cycle guarding; here it's one
// variable-length pattern.

// Cypher does not allow a bound parameter inside a variable-length
// relationship pattern (e.g. *1..$hops is not valid openCypher), so hops
// is exported as a small function that validates/clamps the value to a
// safe integer range and inlines *only that vetted integer*. The service
// name - the actual untrusted input - stays a normal bound parameter.
function blastRadius(hops = 3) {
  const safeHops = Math.min(Math.max(parseInt(hops, 10) || 3, 1), 5);
  return `
    MATCH (origin:Service {name: $serviceName})
    MATCH path = (origin)<-[:DEPENDS_ON*1..${safeHops}]-(dependent:Service)
    WITH origin, dependent, min(length(path)) AS distance
    RETURN origin.name AS origin,
           collect(DISTINCT {name: dependent.name, distance: distance}) AS affected
    ORDER BY distance
  `;
}

// --- Multi-hop traversal: upstream dependency chain ----------------------
// Direct + transitive things a service relies on (datastores included),
// used to render the dependency tree in the graph canvas.

const dependencyTree = `
  MATCH (origin:Service {name: $serviceName})
  OPTIONAL MATCH path = (origin)-[:DEPENDS_ON*1..3]->(dep)
  WITH origin, collect(DISTINCT path) AS paths
  UNWIND (CASE WHEN size(paths) = 0 THEN [null] ELSE paths END) AS p
  WITH origin, p WHERE p IS NOT NULL
  UNWIND range(0, length(p) - 1) AS idx
  WITH origin,
       nodes(p)[idx]  AS fromNode,
       nodes(p)[idx+1] AS toNode
  RETURN origin.name AS origin,
         collect(DISTINCT {
           from: fromNode.name,
           to: toNode.name,
           toType: labels(toNode)[0]
         }) AS edges
`;

// --- Incident root-cause path --------------------------------------------
// From an incident, follow AFFECTS then DEPENDS_ON to surface the
// underlying dependency chain that likely caused it.

const incidentImpactPath = `
  MATCH (i:Incident {id: $incidentId})-[:AFFECTS]->(s:Service)
  OPTIONAL MATCH depPath = (s)-[:DEPENDS_ON*1..3]->(root)
  WITH i, s, depPath
  ORDER BY length(depPath) DESC
  WITH i, s, collect(depPath)[0] AS longestPath
  RETURN i.id AS incidentId, i.title AS title, i.severity AS severity,
         s.name AS directlyAffected,
         [n IN nodes(coalesce(longestPath, s)) | n.name] AS chain
`;

// --- SQL-awkward query 1: shortest path between two services -------------
// Variable-length, direction-agnostic shortest path through the
// dependency/call graph. This is a single Cypher clause; the SQL
// equivalent needs a recursive CTE with visited-set tracking and no
// guaranteed shortest-path semantics.

const shortestPath = `
  MATCH (a:Service {name: $from}), (b:Service {name: $to})
  MATCH p = shortestPath((a)-[:DEPENDS_ON|CALLS*..8]-(b))
  RETURN [n IN nodes(p) | n.name] AS path,
         [r IN relationships(p) | type(r)] AS relTypes,
         length(p) AS hops
`;

// --- SQL-awkward query 2: risk hotspots -----------------------------------
// Services hit by 2+ incidents in the last N days that also share a
// common downstream dependency with each other - i.e. a single flaky
// dependency correlated with repeated incidents across services. This
// needs a self-join across a derived incident-count table plus a graph
// traversal in SQL; here it's one pattern match with aggregation.

const riskHotspots = `
  MATCH (i:Incident)-[:AFFECTS]->(s:Service)
  WHERE i.startedAt >= $sinceDate
  WITH s, count(DISTINCT i) AS incidentCount
  WHERE incidentCount >= $minIncidents
  MATCH (s)-[:DEPENDS_ON]->(shared)
  WITH shared, collect(DISTINCT {service: s.name, incidents: incidentCount}) AS affectedServices
  WHERE size(affectedServices) >= 2
  RETURN shared.name AS sharedDependency, labels(shared)[0] AS dependencyType,
         affectedServices
  ORDER BY size(affectedServices) DESC
`;

module.exports = {
  listServices,
  listIncidents,
  blastRadius,
  dependencyTree,
  incidentImpactPath,
  shortestPath,
  riskHotspots,
};
