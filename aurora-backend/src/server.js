/**
 * server.js
 * AuroraWatch backend — Express API + cron alerts in one process.
 * Deploy to Railway, Render, or Fly.io (all have free tiers).
 */

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const { initDb } = require('./db');
const routes    = require('./routes');
const { startCron } = require('./cron');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5500',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
  ],
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-admin-secret'],
}));
app.use(express.json());

// Simple request logger
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', routes);

// Unsubscribe GET link (from email click) — redirects to frontend
app.get('/unsubscribe', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).send('Invalid unsubscribe link.');
  try {
    const { dbRun, dbGet } = require('./db');
    const sub = await dbGet('SELECT email FROM subscribers WHERE token = ?', [token]);
    if (!sub) return res.status(404).send('Subscription not found.');
    await dbRun('UPDATE subscribers SET active = 0 WHERE token = ?', [token]);
    const frontend = process.env.FRONTEND_URL || 'http://localhost:5500';
    res.redirect(`${frontend}?unsubscribed=true`);
  } catch (err) {
    res.status(500).send('Something went wrong. Please try again.');
  }
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Startup ───────────────────────────────────────────────────────────────────
async function main() {
  await initDb();
  await startCron();
  app.listen(PORT, () => {
    console.log(`AuroraWatch backend running on http://localhost:${PORT}`);
    console.log(`Frontend: ${process.env.FRONTEND_URL || '(set FRONTEND_URL in .env)'}`);
  });
}

main().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
