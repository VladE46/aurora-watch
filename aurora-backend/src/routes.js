/**
 * routes.js
 * REST API endpoints for the AuroraWatch backend.
 *
 * POST /api/subscribe         — add a new subscriber
 * DELETE /api/unsubscribe     — remove subscriber by token
 * GET  /api/forecast          — get aurora forecast for a lat/lon
 * GET  /api/health            — health check
 */

const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();

const { dbRun, dbGet, dbAll } = require('./db');
const { getForecast }         = require('./aurora');
const { sendConfirmation }    = require('./email');

// ── Health check ──────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ── Aurora forecast ───────────────────────────────────────────────────────────
router.get('/forecast', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'Valid lat and lon query parameters are required.' });
  }

  try {
    const forecast = await getForecast(lat, lon);
    res.json({ ok: true, lat, lon, ...forecast, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Forecast error:', err);
    res.status(502).json({ error: 'Failed to fetch aurora data. Please try again.' });
  }
});

// ── Subscribe ─────────────────────────────────────────────────────────────────
router.post('/subscribe', async (req, res) => {
  const { email, lat, lon, locationName, threshold } = req.body;

  // Validate
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);
  if (isNaN(parsedLat) || isNaN(parsedLon)) {
    return res.status(400).json({ error: 'Valid lat and lon are required.' });
  }
  if (!locationName || typeof locationName !== 'string') {
    return res.status(400).json({ error: 'locationName is required.' });
  }
  const parsedThreshold = parseInt(threshold, 10) || 50;
  if (parsedThreshold < 10 || parsedThreshold > 95) {
    return res.status(400).json({ error: 'Threshold must be between 10 and 95.' });
  }

  const token = crypto.randomBytes(32).toString('hex');

  try {
    // Upsert: if email already exists, update their settings
    const existing = await dbGet('SELECT id FROM subscribers WHERE email = ?', [email]);

    if (existing) {
      await dbRun(
        `UPDATE subscribers
         SET lat=?, lon=?, location_name=?, threshold=?, active=1, token=?, updated_at=datetime('now')
         WHERE email=?`,
        [parsedLat, parsedLon, locationName, parsedThreshold, token, email]
      );
    } else {
      await dbRun(
        `INSERT INTO subscribers (email, lat, lon, location_name, threshold, token)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [email, parsedLat, parsedLon, locationName, parsedThreshold, token]
      );
    }

    // Send confirmation email (non-blocking — don't fail the request if email fails)
    sendConfirmation({
      email,
      locationName,
      threshold: parsedThreshold,
      unsubToken: token,
      frontendUrl: process.env.FRONTEND_URL,
    }).catch(err => console.error('Confirmation email failed:', err.message));

    res.status(201).json({
      ok: true,
      message: `Subscribed! You'll be alerted when aurora probability exceeds ${parsedThreshold}% at ${locationName}.`,
    });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription. Please try again.' });
  }
});

// ── Unsubscribe ───────────────────────────────────────────────────────────────
router.delete('/unsubscribe', async (req, res) => {
  const token = req.query.token || req.body?.token;
  if (!token) return res.status(400).json({ error: 'Token is required.' });

  try {
    const sub = await dbGet('SELECT id, email FROM subscribers WHERE token = ?', [token]);
    if (!sub) return res.status(404).json({ error: 'Subscription not found.' });

    await dbRun('UPDATE subscribers SET active = 0 WHERE token = ?', [token]);
    res.json({ ok: true, message: `${sub.email} has been unsubscribed.` });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to unsubscribe. Please try again.' });
  }
});

// ── Admin: list subscribers (protect this in production!) ──────────────────
router.get('/admin/subscribers', async (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  try {
    const rows = await dbAll(
      'SELECT id, email, location_name, threshold, active, created_at FROM subscribers ORDER BY created_at DESC'
    );
    res.json({ ok: true, count: rows.length, subscribers: rows });
  } catch (err) {
    res.status(500).json({ error: 'Database error.' });
  }
});

module.exports = router;
