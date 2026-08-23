const neo4j = require('neo4j-driver');

let driver = null;

/**
 * Lazily creates a single shared driver instance for the process.
 * CognoDB speaks Bolt over TLS (bolt+s://), so the official Neo4j
 * driver works unmodified - no custom SDK needed.
 */
function getDriver() {
  if (driver) return driver;

  const { COGNODB_URI, COGNODB_USER, COGNODB_PASSWORD } = process.env;

  if (!COGNODB_URI || !COGNODB_USER || !COGNODB_PASSWORD) {
    throw new Error(
      'Missing CognoDB connection details. Set COGNODB_URI, COGNODB_USER and ' +
      'COGNODB_PASSWORD in your .env file (see .env.example).'
    );
  }

  driver = neo4j.driver(
    COGNODB_URI,
    neo4j.auth.basic(COGNODB_USER, COGNODB_PASSWORD),
    { maxConnectionLifetime: 3 * 60 * 60 * 1000 ,disableLosslessIntegers: true }
  );

  return driver;
}

/**
 * Verifies connectivity once at startup so the app fails fast and loud
 * with a clear message instead of hanging on the first request.
 */
async function verifyConnection() {
  const d = getDriver();
  await d.verifyConnectivity();
}

/**
 * Runs a single Cypher statement inside a managed session and returns
 * the raw records. Every call site passes params separately - never
 * string-concatenated into the query text.
 */
async function runQuery(cypher, params = {}) {
  const session = getDriver().session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

module.exports = { getDriver, verifyConnection, runQuery, closeDriver };
