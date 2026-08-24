const express = require('express');
const { runQuery } = require('../config/db');
const queries = require('../db/queries');

const router = express.Router();

// GET /api/services - list all services with owning team (for sidebar/search)
router.get('/', async (req, res, next) => {
  try {
    const records = await runQuery(queries.listServices);
    const services = records.map((r) => ({
      name: r.get('name'),
      tier: r.get('tier'),
      description: r.get('description'),
      team: r.get('team'),
    }));
    res.json({ services });
  } catch (err) {
    next(err);
  }
});

// --- Static sub-routes come first so Express never mistakes "path" or
// "risk" for a :name param on the routes declared further down. ---------

// GET /api/services/path/find?from=A&to=B - shortest path between two
// services through DEPENDS_ON/CALLS relationships, direction-agnostic.
router.get('/path/find', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'Both "from" and "to" query params are required.' });
    }
    const records = await runQuery(queries.shortestPath, { from, to });
    if (records.length === 0) {
      return res.json({ found: false });
    }
    const hopsVal = records[0].get('hops');
    res.json({
      found: true,
      path: records[0].get('path'),
      relTypes: records[0].get('relTypes'),
      hops: hopsVal && hopsVal.toNumber ? hopsVal.toNumber() : hopsVal,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/services/risk/hotspots?days=30&minIncidents=2
router.get('/risk/hotspots', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const minIncidents = parseInt(req.query.minIncidents, 10) || 2;
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const records = await runQuery(queries.riskHotspots, { sinceDate, minIncidents });
    const hotspots = records.map((r) => ({
      sharedDependency: r.get('sharedDependency'),
      dependencyType: r.get('dependencyType'),
      affectedServices: r.get('affectedServices'),
    }));
    res.json({ hotspots, sinceDate, minIncidents });
  } catch (err) {
    next(err);
  }
});

// --- Dynamic :name routes ------------------------------------------------

// GET /api/services/:name/dependencies - transitive dependency tree (for graph canvas)
router.get('/:name/dependencies', async (req, res, next) => {
  try {
    const records = await runQuery(queries.dependencyTree, {
      serviceName: req.params.name,
    });
    const edges = records[0]?.get('edges') || [];
    res.json({ origin: req.params.name, edges: edges.filter((e) => e.from) });
  } catch (err) {
    next(err);
  }
});

// GET /api/services/:name/blast-radius?hops=3 - who is transitively affected
// if this service goes down. `hops` is validated/clamped inside queries.js,
// not interpolated from raw input.
router.get('/:name/blast-radius', async (req, res, next) => {
  try {
    const cypher = queries.blastRadius(req.query.hops);
    const records = await runQuery(cypher, { serviceName: req.params.name });
    if (records.length === 0) {
      return res.json({ origin: req.params.name, affected: [] });
    }
    res.json({
      origin: records[0].get('origin'),
      affected: records[0].get('affected'),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
