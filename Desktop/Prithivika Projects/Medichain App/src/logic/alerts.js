// Builds the dashboard "alerts" from data the API returned.
// Nothing is stored separately: alerts are always calculated fresh from the scan list.
import { displayName, expiryState } from './batchUtils.js';
import { STAGES } from './supplyChain.js';

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2 };

const ALERT_TYPES = {
  RECALLED_BATCH:    { severity: 'critical', title: 'Recalled batch scanned' },
  IMPOSSIBLE_TRAVEL: { severity: 'high',     title: 'Impossible travel detected' },
  HIGH_SCAN_COUNT:   { severity: 'high',     title: 'Unusually high scan count' },
  INVALID_SIGNATURE: { severity: 'high',     title: 'Forged QR signature' },
  UNKNOWN_PACK:      { severity: 'high',     title: 'Unregistered pack scanned' },
  FLAGGED_PACK:      { severity: 'medium',   title: 'Flagged pack scanned' },
  EXPIRED:           { severity: 'medium',   title: 'Expired pack scanned' },
};

function reasonText(scan, flag) {
  const r = scan.reasons.find((x) => x.flag === flag);
  return r ? r.text : '';
}

function messageFor(type, scan) {
  switch (type) {
    case 'RECALLED_BATCH':    return `Pack ${scan.packId} from recalled batch ${scan.batchId} (${scan.medicine}) was scanned in ${scan.location}.`;
    case 'IMPOSSIBLE_TRAVEL': return `Pack ${scan.packId}: ${reasonText(scan, 'IMPOSSIBLE_TRAVEL')}`;
    case 'HIGH_SCAN_COUNT':   return `Pack ${scan.packId}: ${reasonText(scan, 'HIGH_SCAN_COUNT')}`;
    case 'INVALID_SIGNATURE': return `Pack ${scan.packId} was scanned in ${scan.location} with a QR code whose signature does not match.`;
    case 'UNKNOWN_PACK':      return `Pack ID "${scan.packId}" is not in the registry (scanned in ${scan.location}).`;
    case 'FLAGGED_PACK':      return `Pack ${scan.packId} (already reported as suspicious) was scanned in ${scan.location}.`;
    case 'EXPIRED':           return `Expired pack ${scan.packId} (${scan.medicine}) was scanned in ${scan.location}.`;
    default:                  return '';
  }
}

// scans must be newest-first. Repeated alerts for the same pack+type are merged.
export function buildScanAlerts(scans) {
  const map = new Map();
  for (const scan of scans) {
    for (const flag of scan.flags) {
      const def = ALERT_TYPES[flag];
      if (!def) continue;
      const key = `${flag}:${scan.packId}`;
      if (!map.has(key)) {
        map.set(key, { key, type: flag, ...def, packId: scan.packId, timestamp: scan.timestamp, message: messageFor(flag, scan), count: 0 });
      }
      map.get(key).count += 1;
    }
  }
  return [...map.values()].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.timestamp - a.timestamp
  );
}

// Batches that are expired or expire within 30 days, and who holds the packs right now.
// Uses the batch list only (each batch carries packCount and stageCounts).
export function buildExpiryWatch(batches, nowMs = Date.now()) {
  return batches
    .map((batch) => {
      const { daysLeft, state } = expiryState(batch.expiry, nowMs);
      if (state === 'OK') return null;
      const heldBy = STAGES.filter((s) => batch.stageCounts[s] > 0).map((s) => `${s} ${batch.stageCounts[s]}`).join(', ');
      return { batchId: batch.batchId, medicine: displayName(batch), expiry: batch.expiry, daysLeft, state, packCount: batch.packCount, heldBy };
    })
    .filter(Boolean)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

// How many packs sit at each stage of the supply chain, across all batches.
export function buildStageTotals(batches) {
  const totals = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const batch of batches) STAGES.forEach((s) => { totals[s] += batch.stageCounts[s] || 0; });
  return totals;
}
