const express = require('express');
const { runQuery } = require('../config/db');
const queries = require('../db/queries');

const router = express.Router();

// GET /api/incidents - list all incidents with the services they affected
router.get('/', async (req, res, next) => {
  try {
    const records = await runQuery(queries.listIncidents);
    const incidents = records.map((r) => ({
      id: r.get('id'),
      title: r.get('title'),
      severity: r.get('severity'),
      status: r.get('status'),
      startedAt: r.get('startedAt'),
      resolvedAt: r.get('resolvedAt'),
      services: r.get('services'),
    }));
    res.json({ incidents });
  } catch (err) {
    next(err);
  }
});

// GET /api/incidents/:id/impact-path - AFFECTS -> DEPENDS_ON* chain,
// surfacing the likely root dependency behind an incident.
router.get('/:id/impact-path', async (req, res, next) => {
  try {
    const records = await runQuery(queries.incidentImpactPath, {
      incidentId: req.params.id,
    });
    if (records.length === 0) {
      return res.status(404).json({ error: `No incident found with id "${req.params.id}".` });
    }
    res.json({
      incidentId: records[0].get('incidentId'),
      title: records[0].get('title'),
      severity: records[0].get('severity'),
      directlyAffected: records[0].get('directlyAffected'),
      chain: records[0].get('chain'),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
