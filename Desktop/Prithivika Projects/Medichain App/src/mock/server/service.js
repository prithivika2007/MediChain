// ---------------------------------------------------------------
// THE MOCK BACKEND. One function per API endpoint (see API_CONTRACT.md).
//
// It does not know about HTTP or browsers: it only needs a "store" that can
// get/set/remove JSON by key. Two things use it:
//   - src/mock/mockApi.js      the browser demo (store = localStorage)
//   - backend-stub/server.mjs  a small HTTP server (store = memory) to test HTTP mode
//
// This is the file the backend developer re-implements (Java, Node, ...).
// Every method receives `user` (the signed-in person, or null) and does its own permission checks.
// ---------------------------------------------------------------
import { countByHolder } from '../../logic/supplyChain.js';
import { createSeedDb } from './seed.js';
import { evaluateScan } from './verifyPack.js';
import { buildBatch } from './registerBatch.js';
import { validateTransfer, applyTransfer } from './transfers.js';
import { TEST_CASES } from './demoCases.js';
import { USERS } from './users.js';

// An error with an HTTP-style status code (400, 401, 403, 404, 409).
export class ServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => { throw new ServiceError(status, message); };

export const KEY_PREFIX = 'medichain_db_v3_';
const TABLES = ['batches', 'packs', 'transfers', 'scans'];

const publicUser = (u) => ({ username: u.username, role: u.role, name: u.name, org: u.org });

export function createService(store) {
  const key = (name) => KEY_PREFIX + name;

  // ---- tiny database helpers ----
  function readDb() {
    const db = {};
    let missing = false;
    for (const t of TABLES) {
      db[t] = store.get(key(t));
      if (!db[t]) missing = true;
    }
    if (!missing) return db;
    const seed = createSeedDb(); // first run: create the starting data
    TABLES.forEach((t) => store.set(key(t), seed[t]));
    return seed;
  }
  function writeDb(changes) {
    Object.entries(changes).forEach(([t, rows]) => store.set(key(t), rows));
  }

  // A batch as the API returns it: the stored fields plus packCount and stageCounts.
  function batchView(batch, packs) {
    const own = packs.filter((p) => p.batchId === batch.batchId);
    return { ...batch, packCount: own.length, stageCounts: countByHolder(own) };
  }

  function requireRole(user, roles) {
    if (!user) fail(401, 'Sign in required.');
    if (!roles.includes(user.role)) fail(403, 'You do not have permission to do that.');
    return user;
  }

  // Finds a batch and checks the user may see it (a manufacturer may only see their own).
  function findBatch(user, batchId, db) {
    const batch = db.batches.find((b) => b.batchId === batchId);
    if (!batch) fail(404, `Batch ${batchId} not found.`);
    if (user.role === 'manufacturer' && batch.manufacturer !== user.org) fail(403, 'That batch belongs to another manufacturer.');
    return batch;
  }

  return {
    // ---------- login ----------
    // Real backend: check a hashed password and return a signed token (for example a JWT).
    login({ username, password } = {}) {
      const found = USERS.find((u) => u.username === String(username || '').trim().toLowerCase() && u.password === password);
      if (!found) fail(401, 'Invalid username or password.');
      return { token: `mock.${found.username}`, user: publicUser(found) };
    },
    // Turns the "Authorization: Bearer <token>" value back into a user (or null).
    userFromToken(token) {
      if (!token || !String(token).startsWith('mock.')) return null;
      const found = USERS.find((u) => `mock.${u.username}` === token);
      return found ? publicUser(found) : null;
    },

    // ---------- public: verify a pack ----------
    verify({ packId, signature, location } = {}) {
      if (!String(packId || '').trim()) fail(400, 'packId is required.');
      if (!String(location || '').trim()) fail(400, 'location is required.');
      const db = readDb();
      const scan = evaluateScan({
        packId, signature: signature || null, location: String(location).trim(),
        now: Date.now(), packs: db.packs, batches: db.batches, previousScans: db.scans,
      });
      writeDb({ scans: [scan, ...db.scans] });
      return scan;
    },

    // ---------- batches ----------
    listBatches(user) {
      requireRole(user, ['manufacturer', 'admin']);
      const db = readDb();
      const visible = user.role === 'admin' ? db.batches : db.batches.filter((b) => b.manufacturer === user.org);
      return visible.map((b) => batchView(b, db.packs));
    },

    createBatch(user, values = {}) {
      requireRole(user, ['manufacturer']);
      const db = readDb();
      const built = buildBatch(values, user.org, db.batches, db.packs); // the manufacturer comes from the login, not the form
      if (built.error) fail(400, built.error);
      writeDb({ batches: [built.batch, ...db.batches], packs: [...db.packs, ...built.packs] });
      return { batch: batchView(built.batch, built.packs), packs: built.packs };
    },

    listPacks(user, batchId) {
      requireRole(user, ['manufacturer', 'admin']);
      const db = readDb();
      findBatch(user, batchId, db);
      return db.packs.filter((p) => p.batchId === batchId);
    },

    recallBatch(user, batchId) {
      requireRole(user, ['admin']);
      const db = readDb();
      findBatch(user, batchId, db);
      if (db.batches.find((b) => b.batchId === batchId).status === 'RECALLED') fail(409, `Batch ${batchId} is already recalled.`);
      const batches = db.batches.map((b) => (b.batchId === batchId ? { ...b, status: 'RECALLED', recalledAt: Date.now() } : b));
      writeDb({ batches });
      return batchView(batches.find((b) => b.batchId === batchId), db.packs);
    },

    // ---------- supply chain ----------
    listTransfers(user, batchId) {
      requireRole(user, ['manufacturer', 'admin']);
      const db = readDb();
      findBatch(user, batchId, db);
      return db.transfers.filter((t) => t.batchId === batchId).sort((a, b) => b.timestamp - a.timestamp);
    },

    createTransfer(user, batchId, body = {}) {
      requireRole(user, ['manufacturer']);
      const db = readDb();
      const batch = findBatch(user, batchId, db);
      const counts = countByHolder(db.packs.filter((p) => p.batchId === batchId));
      const earlier = db.transfers.filter((t) => t.batchId === batchId);
      const latestTimestamp = earlier.length ? Math.max(...earlier.map((t) => t.timestamp)) : null;

      const transfer = {
        id: `TR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        batchId,
        from: body.from,
        to: body.to,
        quantity: Number(body.quantity),
        location: String(body.location || '').trim(),
        timestamp: Number(body.timestamp),
        notes: String(body.notes || '').trim(),
      };
      const problem = validateTransfer({ batch, counts, latestTimestamp, ...transfer });
      if (problem) fail(400, problem);

      writeDb({ transfers: [...db.transfers, transfer], packs: applyTransfer(db.packs, transfer) });
      return transfer;
    },

    // ---------- admin: scan history (newest first) ----------
    listScans(user, { limit } = {}) {
      requireRole(user, ['admin']);
      const max = Math.min(Math.max(Number(limit) || 500, 1), 1000);
      return readDb().scans.slice(0, max);
    },

    // ---------- demo-only helpers (the real backend does not need these) ----------
    demo: {
      accounts: () => USERS.map((u) => ({ ...publicUser(u), password: u.password })),
      testCases: () => TEST_CASES,
      // The demo packs with the signature to put in each QR code.
      qrCases(user) {
        requireRole(user, ['admin']);
        const { packs } = readDb();
        const tested = new Set(TEST_CASES.map((t) => t.packId));
        const extra = packs
          .filter((p) => p.packId.startsWith('PK') && !tested.has(p.packId))
          .map((p) => ({ packId: p.packId, expected: null, note: 'Extra demo pack.' }));
        return [...TEST_CASES, ...extra].map((t) => {
          const real = packs.find((p) => p.packId === t.packId);
          return { ...t, signature: t.signature || (real ? real.signature : '00000000') };
        });
      },
      undoRecall(user, batchId) {
        requireRole(user, ['admin']);
        const db = readDb();
        findBatch(user, batchId, db);
        const batches = db.batches.map((b) => (b.batchId === batchId ? { ...b, status: 'ACTIVE', recalledAt: null } : b));
        writeDb({ batches });
        return batchView(batches.find((b) => b.batchId === batchId), db.packs);
      },
      reset(user) {
        requireRole(user, ['admin']);
        TABLES.forEach((t) => store.remove(key(t)));
        readDb();
        return { ok: true };
      },
    },
  };
}
