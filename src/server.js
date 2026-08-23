require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { verifyConnection, closeDriver } = require('./config/db');
const servicesRoutes = require('./routes/services.routes');
const incidentsRoutes = require('./routes/incidents.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Simple request log - handy while walking through the code with reviewers.
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.get('/api/health', async (req, res) => {
  try {
    await verifyConnection();
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', database: 'unreachable', message: err.message });
  }
});

app.use('/api/services', servicesRoutes);
app.use('/api/incidents', incidentsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` });
});

app.use(errorHandler);

async function start() {
  try {
    await verifyConnection();
    console.log('Connected to CognoDB.');
  } catch (err) {
    console.error('Warning: could not connect to CognoDB at startup.');
    console.error(err.message);
    console.error('The server will still start; requests will return 503 until the database is reachable.');
  }

  app.listen(PORT, () => {
    console.log(`DevFlow API listening on http://localhost:${PORT}`);
  });
}

process.on('SIGINT', async () => {
  await closeDriver();
  process.exit(0);
});

start();
