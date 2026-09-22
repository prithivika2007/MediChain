// Server side of the supply chain: check a transfer, then move the packs.
import { STAGES } from '../../logic/supplyChain.js';
import { formatDateTime } from '../../utils/dateUtils.js';

// Returns an error message, or '' when the transfer is fine.
// counts: packs per stage for this batch. latestTimestamp: newest earlier transfer of this batch (or null).
export function validateTransfer({ batch, counts, latestTimestamp, from, to, quantity, location, timestamp, now = Date.now() }) {
  if (batch.status === 'RECALLED') return 'This batch is recalled, so no more transfers can be recorded.';
  const fromIndex = STAGES.indexOf(from);
  if (fromIndex < 0 || fromIndex >= STAGES.length - 1) return 'Choose a stage that still has packs to pass on.';
  if (to !== STAGES[fromIndex + 1]) return `Packs at ${from} can only move to ${STAGES[fromIndex + 1]}.`;
  const available = counts[from] || 0;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > available) {
    return `Quantity must be between 1 and ${available} (the packs currently at ${from}).`;
  }
  if (!String(location || '').trim()) return 'Enter the location of this hand-off.';
  if (!Number.isFinite(timestamp)) return 'Choose a date and time for this transfer.';
  if (timestamp > now + 60 * 1000) return 'The transfer time cannot be in the future.';
  if (latestTimestamp != null && timestamp < latestTimestamp) {
    return `The transfer time must be after the previous transfer (${formatDateTime(latestTimestamp)}).`;
  }
  return '';
}

// The first `quantity` packs of the batch that are at "from" move to "to". Returns the new pack list.
export function applyTransfer(packs, transfer) {
  let left = transfer.quantity;
  return packs.map((p) => {
    if (left > 0 && p.batchId === transfer.batchId && p.holder === transfer.from) {
      left -= 1;
      return { ...p, holder: transfer.to };
    }
    return p;
  });
}
