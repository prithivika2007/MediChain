// ---------------------------------------------------------------
// RULE-BASED ANOMALY DETECTION (no machine learning!)
// Each rule is a small function that answers: "is this scan weird?"
// ---------------------------------------------------------------
import { CITIES } from './cities.js';
import { MAX_REALISTIC_SPEED_KMH, MIN_DISTANCE_KM, HIGH_SCAN_THRESHOLD } from './rules.js';
import { formatDuration } from '../../utils/dateUtils.js';

// Straight-line distance between two cities (haversine formula).
export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// RULE 1: same pack scanned in two far-apart places within an impossible time.
// Example: Chennai 10:00, Mumbai 10:15  ->  1000+ km in 15 min  ->  suspicious.
export function checkImpossibleTravel(previousScansOfPack, location, nowMs) {
  if (previousScansOfPack.length === 0) return null;

  // find the most recent earlier scan of this pack
  const last = previousScansOfPack.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
  if (last.location === location) return null;

  const from = CITIES[last.location];
  const to = CITIES[location];
  if (!from || !to) return null;

  const km = distanceKm(from, to);
  const minutes = Math.max(Math.round((nowMs - last.timestamp) / 60000), 0);
  const hours = Math.max((nowMs - last.timestamp) / 3600000, 1 / 60); // avoid dividing by zero
  const speed = km / hours;

  if (km >= MIN_DISTANCE_KM && speed > MAX_REALISTIC_SPEED_KMH) {
    const gap = minutes < 1 ? 'less than a minute' : `only ${formatDuration(minutes)}`;
    return {
      message: `Scanned in ${location} ${gap} after a scan in ${last.location} (${Math.round(km)} km apart).`,
    };
  }
  return null;
}

// RULE 2: same pack scanned an unusually large number of times.
export function checkHighScanCount(scanNumber) {
  if (scanNumber >= HIGH_SCAN_THRESHOLD) {
    return { message: `This pack has been scanned ${scanNumber} times (limit is ${HIGH_SCAN_THRESHOLD}).` };
  }
  return null;
}
