/**
 * aurora.js
 * Fetches real-time aurora probability from NOAA OVATION model
 * and cloud cover from Open-Meteo. Both APIs are completely free
 * and require no API key.
 */

const NOAA_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
const KP_URL   = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';

// Cache NOAA data for 5 minutes to avoid hammering their server
// when checking many subscribers in the same cron run
let noaaCache = null;
let noaaCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchNoaaData() {
  const now = Date.now();
  if (noaaCache && (now - noaaCacheTime) < CACHE_TTL_MS) {
    return noaaCache;
  }

  const res = await fetch(NOAA_URL, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`NOAA responded with ${res.status}`);
  const data = await res.json();

  noaaCache = data;
  noaaCacheTime = now;
  return data;
}

/**
 * Get aurora probability (0–100) for a lat/lon from NOAA OVATION.
 * Falls back to a latitude-based estimate if the API is unavailable.
 */
async function getAuroraProb(lat, lon) {
  try {
    const data = await fetchNoaaData();
    const coords = data.coordinates;
    if (!coords || !coords.length) return latitudeEstimate(lat);

    // Find nearest grid point (NOAA grid is ~1° resolution)
    let best = null;
    let bestDist = Infinity;
    for (const [plon, plat, prob] of coords) {
      const dist = Math.hypot(plat - lat, plon - lon);
      if (dist < bestDist) {
        bestDist = dist;
        best = prob;
      }
    }
    return best !== null ? Math.round(best) : latitudeEstimate(lat);
  } catch (err) {
    console.warn('NOAA aurora fetch failed, using estimate:', err.message);
    return latitudeEstimate(lat);
  }
}

/**
 * Rough probability estimate based purely on latitude.
 * Used as a fallback when NOAA is unreachable.
 */
function latitudeEstimate(lat) {
  const a = Math.abs(lat);
  if (a >= 70) return 45;
  if (a >= 65) return 30;
  if (a >= 60) return 18;
  if (a >= 55) return 8;
  if (a >= 50) return 4;
  return 1;
}

/**
 * Get current Kp index (0–9) from NOAA.
 * Returns null if unavailable.
 */
async function getKpIndex() {
  try {
    const res = await fetch(KP_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const rows = await res.json();
    // rows[0] is header, latest reading is last row
    if (rows.length < 2) return null;
    const latest = rows[rows.length - 1];
    const kp = parseFloat(latest[1]);
    return isNaN(kp) ? null : kp;
  } catch {
    return null;
  }
}

/**
 * Get current cloud cover % for a lat/lon from Open-Meteo (free, no key).
 * Returns null if unavailable.
 */
async function getCloudCover(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=cloudcover`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.current?.cloudcover ?? null;
  } catch {
    return null;
  }
}

/**
 * Full forecast for a location — probability, Kp, cloud cover,
 * and a plain-language verdict.
 */
async function getForecast(lat, lon) {
  const [prob, kp, cloud] = await Promise.all([
    getAuroraProb(lat, lon),
    getKpIndex(),
    getCloudCover(lat, lon),
  ]);

  const cloudy = cloud !== null && cloud > 70;
  let verdict, verdictDetail;

  if (prob >= 60 && !cloudy) {
    verdict = 'good';
    verdictDetail = 'Good conditions — go outside tonight!';
  } else if (prob >= 60 && cloudy) {
    verdict = 'medium';
    verdictDetail = `Strong aurora activity but ${Math.round(cloud)}% cloud cover may block visibility.`;
  } else if (prob >= 30) {
    verdict = 'medium';
    verdictDetail = 'Moderate activity — worth watching from a dark location.';
  } else {
    verdict = 'poor';
    verdictDetail = 'Quiet night — low geomagnetic activity.';
  }

  return { prob, kp, cloud, verdict, verdictDetail };
}

module.exports = { getAuroraProb, getKpIndex, getCloudCover, getForecast };
