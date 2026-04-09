/**
 * cron.js
 * Runs on a schedule (default: every hour).
 * For each active subscriber, checks current aurora probability.
 * If it exceeds their threshold AND they haven't been alerted recently,
 * sends an email via Brevo.
 *
 * Run standalone:  node src/cron.js
 * Or import into server.js for in-process scheduling.
 */

require('dotenv').config();

const cron = require('node-cron');
const { initDb, dbAll, dbGet, dbRun } = require('./db');
const { getAuroraProb, getKpIndex, getCloudCover } = require('./aurora');
const { sendAuroraAlert } = require('./email');

const SCHEDULE             = process.env.ALERT_CRON_SCHEDULE    || '0 * * * *';
const MIN_INTERVAL_HOURS   = parseInt(process.env.MIN_ALERT_INTERVAL_HOURS || '4', 10);

async function checkAndAlert() {
  console.log(`[${new Date().toISOString()}] Aurora check started`);

  let subscribers;
  try {
    subscribers = await dbAll(
      "SELECT * FROM subscribers WHERE active = 1"
    );
  } catch (err) {
    console.error('Failed to fetch subscribers:', err.message);
    return;
  }

  if (!subscribers.length) {
    console.log('No active subscribers — nothing to do.');
    return;
  }

  console.log(`Checking ${subscribers.length} subscriber(s)...`);

  // Fetch global Kp once (same for all locations)
  const kp = await getKpIndex();

  let alertsSent = 0;
  let skipped = 0;

  for (const sub of subscribers) {
    try {
      // Rate-limit: skip if we already alerted this subscriber recently
      const recentAlert = await dbGet(
        `SELECT sent_at FROM alert_log
         WHERE subscriber_id = ?
         AND sent_at > datetime('now', '-${MIN_INTERVAL_HOURS} hours')
         ORDER BY sent_at DESC LIMIT 1`,
        [sub.id]
      );

      if (recentAlert) {
        skipped++;
        continue;
      }

      const [prob, cloud] = await Promise.all([
        getAuroraProb(sub.lat, sub.lon),
        getCloudCover(sub.lat, sub.lon),
      ]);

      if (prob < sub.threshold) {
        console.log(`  ${sub.email} @ ${sub.location_name}: ${prob}% < threshold ${sub.threshold}% — skip`);
        continue;
      }

      console.log(`  ${sub.email} @ ${sub.location_name}: ${prob}% >= threshold ${sub.threshold}% — ALERTING`);

      await sendAuroraAlert({
        email:        sub.email,
        locationName: sub.location_name,
        prob,
        kp,
        cloud,
        threshold:    sub.threshold,
        unsubToken:   sub.token,
        frontendUrl:  process.env.FRONTEND_URL,
      });

      // Log the alert
      await dbRun(
        'INSERT INTO alert_log (subscriber_id, aurora_prob, kp_index, cloud_cover) VALUES (?, ?, ?, ?)',
        [sub.id, prob, kp, cloud]
      );

      alertsSent++;

    } catch (err) {
      console.error(`  Error processing ${sub.email}:`, err.message);
    }
  }

  console.log(`[${new Date().toISOString()}] Check complete — ${alertsSent} alert(s) sent, ${skipped} rate-limited.`);
}

async function startCron() {
  await initDb();
  console.log(`Aurora alert cron starting — schedule: "${SCHEDULE}"`);
  console.log(`Min alert interval: ${MIN_INTERVAL_HOURS}h per subscriber`);

  // Run once immediately on startup, then on schedule
  await checkAndAlert();

  cron.schedule(SCHEDULE, checkAndAlert);
}

// Allow running standalone or importing into server.js
if (require.main === module) {
  startCron().catch(err => {
    console.error('Cron startup failed:', err);
    process.exit(1);
  });
}

module.exports = { startCron, checkAndAlert };
