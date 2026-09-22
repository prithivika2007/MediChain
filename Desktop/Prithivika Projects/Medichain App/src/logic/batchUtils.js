// Small helpers shared by every page that shows a batch.
import { daysUntil } from '../utils/dateUtils.js';
import { EXPIRY_WARNING_DAYS } from '../config.js';

// "Paracetamol" + "500mg"  ->  "Paracetamol 500mg"
export function displayName(batch) {
  return batch ? `${batch.medicineName} ${batch.strength}`.trim() : 'Unknown product';
}

// state is 'EXPIRED', 'EXPIRING_SOON' or 'OK'. One rule used everywhere.
export function expiryState(expiry, nowMs = Date.now()) {
  const daysLeft = daysUntil(expiry, nowMs);
  const state = daysLeft < 0 ? 'EXPIRED' : daysLeft <= EXPIRY_WARNING_DAYS ? 'EXPIRING_SOON' : 'OK';
  return { daysLeft, state };
}
