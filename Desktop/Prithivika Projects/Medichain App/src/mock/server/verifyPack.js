// ---------------------------------------------------------------
// THE VERIFICATION DECISION (server side). Given one scan, decide the result.
// It is a "pure function": inputs in, scan record out. No screen, no storage.
// The real backend must return the same shape. Rules are written out in API_CONTRACT.md.
// ---------------------------------------------------------------
import { formatDate } from '../../utils/dateUtils.js';
import { displayName, expiryState } from '../../logic/batchUtils.js';
import { checkImpossibleTravel, checkHighScanCount } from './anomalyRules.js';

export function normalizePackId(text) {
  return String(text || '').trim().toUpperCase();
}

// signature: the value read from the QR code, or null when the Pack ID was typed by hand.
export function evaluateScan({ packId, signature = null, location, now, packs, batches, previousScans }) {
  const id = normalizePackId(packId);
  const pack = packs.find((p) => p.packId === id);
  const history = previousScans.filter((s) => s.packId === id); // earlier scans of THIS pack
  const scanNumber = history.length + 1;

  const record = {
    id: `${now}-${Math.floor(Math.random() * 100000)}`,
    packId: id,
    location,
    timestamp: now,
    scanNumber,
  };

  // Step 0: pack not in our database at all -> suspicious
  if (!pack) {
    return {
      ...record,
      batchId: '—',
      medicine: 'Unknown product',
      manufacturer: 'Unknown',
      packSize: null,
      mrp: null,
      expiry: null,
      signatureCheck: null,
      result: 'SUSPICIOUS',
      flags: ['UNKNOWN_PACK'],
      reasons: [{ flag: 'UNKNOWN_PACK', text: 'This Pack ID is not registered in the system. It may be a fake or a misprinted label.' }],
    };
  }

  const batch = batches.find((b) => b.batchId === pack.batchId);
  const flags = [];
  const reasons = [];
  const addFlag = (flag, text) => { flags.push(flag); reasons.push({ flag, text }); };

  // Step 1: recall check
  if (batch.status === 'RECALLED') {
    addFlag('RECALLED_BATCH', `Batch ${pack.batchId} has been recalled. Do not use this medicine.`);
  }

  // Step 2: expiry check
  const { daysLeft, state } = expiryState(batch.expiry, now);
  if (state === 'EXPIRED') {
    addFlag('EXPIRED', `This pack expired on ${formatDate(batch.expiry)}.`);
  } else if (state === 'EXPIRING_SOON') {
    addFlag('EXPIRING_SOON', daysLeft === 0 ? 'This pack expires today.' : `This pack expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`);
  }

  // Step 3: digital signature check (only when the pack was scanned from a QR code)
  let signatureCheck = null;
  if (signature) {
    signatureCheck = String(signature).toUpperCase() === pack.signature ? 'VALID' : 'INVALID';
    if (signatureCheck === 'INVALID') {
      addFlag('INVALID_SIGNATURE', 'The signature in this QR code does not match the pack. The QR code may be forged or copied.');
    }
  }

  // Step 4: anomaly rules
  const travel = checkImpossibleTravel(history, location, now);
  if (travel) {
    addFlag('IMPOSSIBLE_TRAVEL', travel.message);
  } else if (history.some((s) => s.flags.includes('IMPOSSIBLE_TRAVEL'))) {
    addFlag('PREVIOUSLY_FLAGGED', 'This pack was earlier scanned in two far-apart places in an impossible time.');
  }

  const highCount = checkHighScanCount(scanNumber);
  if (highCount) addFlag('HIGH_SCAN_COUNT', highCount.message);

  // Step 5: status stored on the pack itself
  if (pack.status === 'SUSPICIOUS') {
    addFlag('FLAGGED_PACK', 'This pack was already reported as suspicious (possible cloned label).');
  }
  if (pack.status === 'USED') {
    addFlag('ALREADY_USED', 'This pack was already verified and used earlier.');
  }

  // Step 6: pick ONE final result. The order below is the priority.
  let result = 'GENUINE';
  if (flags.includes('RECALLED_BATCH')) result = 'RECALLED';
  else if (flags.includes('EXPIRED')) result = 'EXPIRED';
  else if (['INVALID_SIGNATURE', 'IMPOSSIBLE_TRAVEL', 'PREVIOUSLY_FLAGGED', 'HIGH_SCAN_COUNT', 'FLAGGED_PACK'].some((f) => flags.includes(f))) result = 'SUSPICIOUS';
  else if (flags.includes('ALREADY_USED')) result = 'ALREADY_USED';

  return {
    ...record,
    batchId: pack.batchId,
    medicine: displayName(batch),
    manufacturer: batch.manufacturer,
    packSize: batch.packSize,
    mrp: batch.mrp,
    expiry: batch.expiry,
    signatureCheck,
    result,
    flags,
    reasons,
  };
}
