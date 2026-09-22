// ---------------------------------------------------------------
// SEED DATA: the mock backend's starting "database". Edit freely!
// Batches created later in the Manufacturer Portal are saved next to these.
// ---------------------------------------------------------------
import { daysFromNow } from '../../utils/dateUtils.js';
import { makeSignature } from './signature.js';

const DAY = 24 * 60 * 60 * 1000;

// A function (not a constant) so relative dates such as "expires in 18 days" are worked out when the demo starts.
export function createSeedBatches() {
  const now = Date.now();
  const b = (batchId, medicineName, strength, packSize, mrp, manufacturer, mfgDate, expiry, extra = {}) => ({
    batchId, medicineName, strength, packSize, mrp, manufacturer, mfgDate, expiry,
    status: 'ACTIVE', recalledAt: null, createdAt: now - 60 * DAY, ...extra,
  });
  return [
    b('B001', 'Paracetamol',  '500mg', '10 tablets',  25, 'ABC Pharma',              '2025-07-01',   '2027-06-30'),
    b('B002', 'Amoxicillin',  '250mg', '10 capsules', 120, 'MediCure Labs',           daysFromNow(-700), daysFromNow(18)),   // expiry warning
    b('B003', 'Metformin',    '500mg', '15 tablets',  45, 'Sunrise Pharmaceuticals', daysFromNow(-200), daysFromNow(500)),  // recalled in the demo
    b('B004', 'Ibuprofen',    '400mg', '10 tablets',  32, 'HealWell Pharma',         daysFromNow(-300), daysFromNow(200),  // already recalled
      { status: 'RECALLED', recalledAt: now - 3 * DAY }),
    b('B005', 'Cetirizine',   '10mg',  '10 tablets',  28, 'Zenith Remedies',         daysFromNow(-800), daysFromNow(-90)),  // already expired
    b('B006', 'Azithromycin', '500mg', '3 tablets',   95, 'ABC Pharma',              daysFromNow(-30),  daysFromNow(700)),
  ];
}

// pack.status is 'ACTIVE' (normal), 'USED' (already dispensed) or 'SUSPICIOUS' (reported as fake/cloned).
// pack.holder is who has the pack now (starts at the manufacturer).
// Medicine, manufacturer and expiry are NOT repeated here: they come from the pack's batch.
export function createSeedPacks(batches) {
  const rows = [
    ['PK001', 'B001'], ['PK002', 'B001'], ['PK003', 'B001'],
    ['PK004', 'B002'], ['PK005', 'B002', 'USED'],
    ['PK006', 'B003'], ['PK007', 'B003'], ['PK008', 'B003'],
    ['PK009', 'B004'], ['PK010', 'B004'],
    ['PK011', 'B005'], ['PK012', 'B005'],
    ['PK013', 'B006'], ['PK014', 'B006', 'SUSPICIOUS'], ['PK015', 'B006'],
  ];
  return rows.map(([packId, batchId, status = 'ACTIVE']) => {
    const batch = batches.find((x) => x.batchId === batchId);
    return { packId, batchId, status, signature: makeSignature(packId, batch.mfgDate), holder: 'Manufacturer' };
  });
}

// Some hand-offs so the Supply Chain page is not empty at the start.
export function createSeedTransfers() {
  const now = Date.now();
  let n = 0;
  const t = (batchId, from, to, quantity, location, daysAgo) => ({
    id: `TR-seed-${++n}`, batchId, from, to, quantity, location,
    timestamp: now - daysAgo * DAY, notes: '',
  });
  return [
    t('B001', 'Manufacturer', 'Distributor', 3, 'Chennai', 12),
    t('B001', 'Distributor', 'Wholesaler', 2, 'Bengaluru', 8),
    t('B002', 'Manufacturer', 'Distributor', 2, 'Coimbatore', 5),
    t('B003', 'Manufacturer', 'Distributor', 3, 'Pune', 3),
    t('B004', 'Manufacturer', 'Distributor', 2, 'Delhi', 9),
    t('B005', 'Manufacturer', 'Distributor', 2, 'Kolkata', 20),
    t('B006', 'Manufacturer', 'Distributor', 3, 'Mumbai', 20),
    t('B006', 'Distributor', 'Wholesaler', 3, 'Hyderabad', 15),
    t('B006', 'Wholesaler', 'Retailer', 2, 'Hyderabad', 10),
  ];
}
