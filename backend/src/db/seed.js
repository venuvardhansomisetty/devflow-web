require('dotenv').config();
const { getDriver, closeDriver } = require('../config/db');

// --- Seed data -----------------------------------------------------------
// A realistic slice of an e-commerce platform's service topology: teams
// that own services, services that call and depend on each other and on
// datastores, plus a handful of incidents and deployments over the last
// ~45 days so the "risk hotspots" and "recent incidents" queries have
// something meaningful to surface.

const teams = ['Platform', 'Commerce', 'Payments', 'Growth'];

const datastores = [
  { name: 'payments-postgres', type: 'PostgreSQL' },
  { name: 'orders-postgres', type: 'PostgreSQL' },
  { name: 'catalog-mongo', type: 'MongoDB' },
  { name: 'session-redis', type: 'Redis' },
  { name: 'events-kafka', type: 'Kafka' },
  { name: 'search-elasticsearch', type: 'Elasticsearch' },
];

const services = [
  { name: 'Auth Service', team: 'Platform', tier: 'critical', description: 'Issues and validates session tokens for every request.' },
  { name: 'User Service', team: 'Platform', tier: 'critical', description: 'Owns user profile and account data.' },
  { name: 'Payment Service', team: 'Payments', tier: 'critical', description: 'Processes card charges and refunds.' },
  { name: 'Fraud Detection', team: 'Payments', tier: 'high', description: 'Scores transactions for fraud risk in real time.' },
  { name: 'Billing Service', team: 'Payments', tier: 'high', description: 'Generates invoices and manages subscriptions.' },
  { name: 'Order Service', team: 'Commerce', tier: 'critical', description: 'Owns order lifecycle from creation to fulfillment.' },
  { name: 'Cart Service', team: 'Commerce', tier: 'high', description: 'Manages active shopping carts.' },
  { name: 'Checkout Service', team: 'Commerce', tier: 'critical', description: 'Orchestrates the checkout flow end to end.' },
  { name: 'Inventory Service', team: 'Commerce', tier: 'high', description: 'Tracks stock levels across warehouses.' },
  { name: 'Shipping Service', team: 'Commerce', tier: 'medium', description: 'Books carriers and generates tracking numbers.' },
  { name: 'Catalog Service', team: 'Commerce', tier: 'high', description: 'Owns product listings and pricing.' },
  { name: 'Search Service', team: 'Growth', tier: 'medium', description: 'Full-text and faceted product search.' },
  { name: 'Recommendation Service', team: 'Growth', tier: 'low', description: 'Generates personalised product recommendations.' },
  { name: 'Notification Service', team: 'Platform', tier: 'medium', description: 'Sends email, SMS and push notifications.' },
  { name: 'Analytics Service', team: 'Growth', tier: 'low', description: 'Aggregates event data for dashboards.' },
];

// [from, to] - "from" DEPENDS_ON "to". "to" may be a service or datastore name.
const dependsOn = [
  ['Payment Service', 'payments-postgres'],
  ['Payment Service', 'Fraud Detection'],
  ['Billing Service', 'payments-postgres'],
  ['Billing Service', 'Payment Service'],
  ['Fraud Detection', 'events-kafka'],
  ['Order Service', 'orders-postgres'],
  ['Order Service', 'events-kafka'],
  ['Checkout Service', 'Cart Service'],
  ['Checkout Service', 'Payment Service'],
  ['Checkout Service', 'Order Service'],
  ['Checkout Service', 'Inventory Service'],
  ['Cart Service', 'session-redis'],
  ['Cart Service', 'Catalog Service'],
  ['Inventory Service', 'orders-postgres'],
  ['Shipping Service', 'Order Service'],
  ['Shipping Service', 'events-kafka'],
  ['Catalog Service', 'catalog-mongo'],
  ['Search Service', 'search-elasticsearch'],
  ['Search Service', 'Catalog Service'],
  ['Recommendation Service', 'catalog-mongo'],
  ['Recommendation Service', 'Analytics Service'],
  ['Analytics Service', 'events-kafka'],
  ['Notification Service', 'events-kafka'],
  ['User Service', 'session-redis'],
];

// [from, to] - "from" CALLS "to" synchronously (lighter-weight than a hard dependency).
const calls = [
  ['Checkout Service', 'Auth Service'],
  ['Order Service', 'Auth Service'],
  ['Payment Service', 'Auth Service'],
  ['Cart Service', 'Auth Service'],
  ['Order Service', 'Notification Service'],
  ['Payment Service', 'Notification Service'],
  ['Shipping Service', 'Notification Service'],
  ['Checkout Service', 'User Service'],
  ['Search Service', 'Recommendation Service'],
];

function daysAgo(n, hour = 14) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

const incidents = [
  { id: 'INC-1042', title: 'Elevated checkout latency', severity: 'high', status: 'resolved', startedAt: daysAgo(2, 9), resolvedAt: daysAgo(2, 11), affects: ['Checkout Service'] },
  { id: 'INC-1041', title: 'Payment declines spike', severity: 'critical', status: 'resolved', startedAt: daysAgo(4, 15), resolvedAt: daysAgo(4, 17), affects: ['Payment Service', 'Billing Service'] },
  { id: 'INC-1038', title: 'Postgres connection pool exhaustion', severity: 'critical', status: 'resolved', startedAt: daysAgo(6, 3), resolvedAt: daysAgo(6, 5), affects: ['Payment Service', 'Billing Service'] },
  { id: 'INC-1035', title: 'Cart items disappearing', severity: 'medium', status: 'resolved', startedAt: daysAgo(9, 20), resolvedAt: daysAgo(9, 21), affects: ['Cart Service'] },
  { id: 'INC-1030', title: 'Order confirmation emails delayed', severity: 'low', status: 'resolved', startedAt: daysAgo(12, 8), resolvedAt: daysAgo(12, 8), affects: ['Notification Service'] },
  { id: 'INC-1027', title: 'Kafka consumer lag on order events', severity: 'high', status: 'resolved', startedAt: daysAgo(15, 6), resolvedAt: daysAgo(15, 9), affects: ['Order Service', 'Shipping Service', 'Analytics Service'] },
  { id: 'INC-1019', title: 'Fraud scoring timeouts during flash sale', severity: 'critical', status: 'resolved', startedAt: daysAgo(20, 10), resolvedAt: daysAgo(20, 12), affects: ['Fraud Detection', 'Payment Service'] },
  { id: 'INC-1005', title: 'Search results stale after catalog update', severity: 'medium', status: 'resolved', startedAt: daysAgo(28, 13), resolvedAt: daysAgo(28, 15), affects: ['Search Service'] },
  { id: 'INC-1055', title: 'Checkout 500s after latest deploy', severity: 'high', status: 'investigating', startedAt: daysAgo(0, 11), resolvedAt: null, affects: ['Checkout Service', 'Payment Service'] },
];

const deployments = [
  { id: 'dep-2201', version: 'v2.14.0', service: 'Checkout Service', deployedAt: daysAgo(0, 10), status: 'success' },
  { id: 'dep-2198', version: 'v1.9.3', service: 'Payment Service', deployedAt: daysAgo(4, 14), status: 'success' },
  { id: 'dep-2190', version: 'v3.2.0', service: 'Cart Service', deployedAt: daysAgo(9, 19), status: 'rolled_back' },
  { id: 'dep-2175', version: 'v1.4.1', service: 'Fraud Detection', deployedAt: daysAgo(20, 9), status: 'success' },
];

async function seed() {
  const driver = getDriver();
  const session = driver.session();

  try {
    console.log('Clearing existing data...');
    await session.run('MATCH (n) DETACH DELETE n');

    console.log('Creating constraints...');
    await session.run('CREATE CONSTRAINT service_name IF NOT EXISTS FOR (s:Service) REQUIRE s.name IS UNIQUE');
    await session.run('CREATE CONSTRAINT datastore_name IF NOT EXISTS FOR (d:Datastore) REQUIRE d.name IS UNIQUE');
    await session.run('CREATE CONSTRAINT team_name IF NOT EXISTS FOR (t:Team) REQUIRE t.name IS UNIQUE');
    await session.run('CREATE CONSTRAINT incident_id IF NOT EXISTS FOR (i:Incident) REQUIRE i.id IS UNIQUE');

    console.log('Seeding teams...');
    for (const name of teams) {
      await session.run('MERGE (:Team {name: $name})', { name });
    }

    console.log('Seeding datastores...');
    for (const ds of datastores) {
      await session.run('MERGE (:Datastore {name: $name, type: $type})', ds);
    }

    console.log('Seeding services + OWNS...');
    for (const s of services) {
      await session.run(
        `MERGE (svc:Service {name: $name})
         SET svc.tier = $tier, svc.description = $description
         WITH svc
         MATCH (t:Team {name: $team})
         MERGE (t)-[:OWNS]->(svc)`,
        s
      );
    }

    console.log('Seeding DEPENDS_ON...');
    for (const [from, to] of dependsOn) {
      await session.run(
        `MATCH (a:Service {name: $from})
         MATCH (b) WHERE (b:Service OR b:Datastore) AND b.name = $to
         MERGE (a)-[:DEPENDS_ON]->(b)`,
        { from, to }
      );
    }

    console.log('Seeding CALLS...');
    for (const [from, to] of calls) {
      await session.run(
        `MATCH (a:Service {name: $from}), (b:Service {name: $to})
         MERGE (a)-[:CALLS]->(b)`,
        { from, to }
      );
    }

    console.log('Seeding incidents + AFFECTS...');
    for (const inc of incidents) {
      await session.run(
        `MERGE (i:Incident {id: $id})
         SET i.title = $title, i.severity = $severity, i.status = $status,
             i.startedAt = $startedAt, i.resolvedAt = $resolvedAt`,
        inc
      );
      for (const svcName of inc.affects) {
        await session.run(
          `MATCH (i:Incident {id: $id}), (s:Service {name: $svcName})
           MERGE (i)-[:AFFECTS]->(s)`,
          { id: inc.id, svcName }
        );
      }
    }

    console.log('Seeding deployments + DEPLOYED...');
    for (const d of deployments) {
      await session.run(
        `MERGE (dep:Deployment {id: $id})
         SET dep.version = $version, dep.deployedAt = $deployedAt, dep.status = $status
         WITH dep
         MATCH (s:Service {name: $service})
         MERGE (dep)-[:DEPLOYED]->(s)`,
        d
      );
    }

    const counts = await session.run(
      `MATCH (n) WITH count(n) AS nodes
       MATCH ()-[r]->() RETURN nodes, count(r) AS rels`
    );
    const record = counts.records[0];
    console.log(`Done. ${record.get('nodes')} nodes, ${record.get('rels')} relationships.`);
  } finally {
    await session.close();
    await closeDriver();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
