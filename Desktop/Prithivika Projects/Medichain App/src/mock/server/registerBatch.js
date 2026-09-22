// Server side of "register a batch": validate the form, then create the batch and all of its
// packs. The BACKEND generates the Pack IDs and the signatures (never the browser).
import { makeSignature } from './signature.js';
import { MAX_PACKS_PER_BATCH } from '../../config.js';

// values: the form fields. Returns { error } or { batch, packs }.
export function buildBatch(values, manufacturer, existingBatches, existingPacks, now = Date.now()) {
  const required = ['medicineName', 'strength', 'packSize', 'batchNumber', 'mfgDate', 'expiryDate'];
  if (required.some((f) => !String(values[f] ?? '').trim())) return { error: 'Fill in every field.' };

  const batchId = String(values.batchNumber).trim().toUpperCase();
  const quantity = Number(values.quantity);
  const mrp = Number(values.mrp);

  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(batchId)) {
    return { error: 'Batch number can only use letters, numbers and hyphens (no spaces).' };
  }
  if (existingBatches.some((b) => b.batchId === batchId)) {
    return { error: `Batch ${batchId} already exists. Use a different batch number.` };
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PACKS_PER_BATCH) {
    return { error: `Quantity must be a whole number from 1 to ${MAX_PACKS_PER_BATCH}.` };
  }
  if (values.mrp === '' || values.mrp == null || !Number.isFinite(mrp) || mrp < 0) return { error: 'MRP must be zero or more.' };
  if (values.expiryDate <= values.mfgDate) return { error: 'The expiry date must be after the manufacturing date.' };

  const batch = {
    batchId,
    medicineName: String(values.medicineName).trim(),
    strength: String(values.strength).trim(),
    packSize: String(values.packSize).trim(),
    mrp,
    manufacturer,
    mfgDate: values.mfgDate,
    expiry: values.expiryDate,
    status: 'ACTIVE',
    recalledAt: null,
    createdAt: now,
  };

  const taken = new Set(existingPacks.map((p) => p.packId));
  const packs = [];
  for (let i = 1; i <= quantity; i++) {
    const packId = `${batchId}-${String(i).padStart(4, '0')}`;
    if (taken.has(packId)) return { error: `Pack ID ${packId} is already in use. Choose a different batch number.` };
    packs.push({ packId, batchId, status: 'ACTIVE', signature: makeSignature(packId, batch.mfgDate), holder: 'Manufacturer' });
  }
  return { batch, packs };
}
