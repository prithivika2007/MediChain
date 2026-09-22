// Creates realistic starting history (about 60 scans over the last 7 days)
// so the dashboard is not empty the first time you open it.
// It uses the SAME evaluateScan() function as the real app, so results are consistent.
import { evaluateScan } from './verifyPack.js';

// Small fixed-seed random generator: gives the same "random" numbers every time.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function createSeedScans(packs, batches) {
  const now = Date.now();
  const rand = mulberry32(2026);
  const events = [];
  const add = (packId, location, timestamp) => events.push({ packId, location, timestamp });

  // Normal scans: [pack, location, how many scans over the last 7 days]
  // (kept at least 5 hours old so scanning them from another city during a demo does not
  //  accidentally trigger the impossible-travel rule)
  const normal = [
    ['PK001', 'Chennai', 6],
    ['PK003', 'Bengaluru', 18],   // 18 scans: two more live scans will trigger the "20+ scans" rule
    ['PK004', 'Coimbatore', 4],
    ['PK006', 'Pune', 5],
    ['PK007', 'Delhi', 4],
    ['PK008', 'Kolkata', 4],
    ['PK013', 'Bengaluru', 5],
    ['PK015', 'Hyderabad', 4],
  ];
  for (const [packId, location, count] of normal) {
    for (let i = 0; i < count; i++) add(packId, location, now - 5 * HOUR - Math.floor(rand() * 7 * DAY));
  }

  // Special stories for the demo
  const yesterday10 = new Date();
  yesterday10.setDate(yesterday10.getDate() - 1);
  yesterday10.setHours(10, 0, 0, 0);
  add('PK002', 'Chennai', yesterday10.getTime());               // 10:00 AM Chennai
  add('PK002', 'Mumbai', yesterday10.getTime() + 15 * MIN);     // 10:15 AM Mumbai -> impossible!

  add('PK005', 'Coimbatore', now - 2 * DAY);                    // already used
  add('PK009', 'Delhi', now - 5 * HOUR);                        // recalled batch B004
  add('PK010', 'Mumbai', now - 26 * HOUR);
  add('PK011', 'Kolkata', now - 5 * HOUR);                      // expired
  add('PK011', 'Kolkata', now - 30 * HOUR);
  add('PK012', 'Pune', now - 50 * HOUR);
  add('PK014', 'Mumbai', now - 6 * HOUR);                       // flagged pack
  add('FAKE-9999', 'Delhi', now - 8 * HOUR);                    // unknown pack

  // Replay events oldest -> newest through the real engine
  events.sort((a, b) => a.timestamp - b.timestamp);
  const scans = [];
  for (const ev of events) {
    scans.push(evaluateScan({ ...ev, now: ev.timestamp, packs, batches, previousScans: scans }));
  }
  return scans.sort((a, b) => b.timestamp - a.timestamp); // newest first
}
