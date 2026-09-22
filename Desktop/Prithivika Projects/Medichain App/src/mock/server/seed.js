// Builds the whole starting database: batches, packs, transfers and scan history.
import { createSeedBatches, createSeedPacks, createSeedTransfers } from './seedData.js';
import { createSeedScans } from './seedScans.js';
import { applyTransfer } from './transfers.js';

export function createSeedDb() {
  const batches = createSeedBatches();
  let packs = createSeedPacks(batches);
  const transfers = createSeedTransfers();

  // Replay the seed hand-offs (oldest first) so every pack starts with the right holder.
  [...transfers].sort((a, b) => a.timestamp - b.timestamp).forEach((t) => { packs = applyTransfer(packs, t); });

  const scans = createSeedScans(packs, batches);
  return { batches, packs, transfers, scans };
}
