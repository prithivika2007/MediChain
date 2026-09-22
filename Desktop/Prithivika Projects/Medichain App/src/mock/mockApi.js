// ---------------------------------------------------------------
// The DEMO backend. Same methods as api/httpApi.js, but the "server" (mock/server/service.js)
// runs inside the browser and saves to localStorage. It pretends to be slow (VITE_MOCK_LATENCY)
// so loading screens behave like they will with a real network.
// ---------------------------------------------------------------
import { createService, ServiceError, KEY_PREFIX } from './server/service.js';
import { ApiError } from '../api/errors.js';
import { getToken, emitUnauthorized } from '../api/session.js';
import { MOCK_LATENCY_MS } from '../api/env.js';

const store = {
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: ignore in the demo */ }
  },
  remove(key) { localStorage.removeItem(key); },
};

const service = createService(store);

const wait = () => (MOCK_LATENCY_MS > 0 ? new Promise((r) => setTimeout(r, MOCK_LATENCY_MS * (0.5 + Math.random()))) : Promise.resolve());

// Runs a service method as the currently signed-in user, turning its errors into ApiErrors.
async function call(fn, { auth = true } = {}) {
  await wait();
  try {
    return fn(service.userFromToken(getToken()));
  } catch (e) {
    if (e instanceof ServiceError) {
      if (e.status === 401 && auth) emitUnauthorized();
      throw new ApiError(e.status, e.message);
    }
    throw e;
  }
}

export const mockApi = {
  mode: 'mock',

  login: (credentials) => call(() => service.login(credentials), { auth: false }),
  verify: (params) => call(() => service.verify(params), { auth: false }),
  listBatches: () => call((u) => service.listBatches(u)),
  createBatch: (values) => call((u) => service.createBatch(u, values)),
  listPacks: (batchId) => call((u) => service.listPacks(u, batchId)),
  recallBatch: (batchId) => call((u) => service.recallBatch(u, batchId)),
  listTransfers: (batchId) => call((u) => service.listTransfers(u, batchId)),
  createTransfer: (batchId, body) => call((u) => service.createTransfer(u, batchId, body)),
  listScans: (options) => call((u) => service.listScans(u, options)),

  // Another browser tab changed the data (the browser tells us through the "storage" event).
  subscribe(callback) {
    const onStorage = (e) => { if (e.key && e.key.startsWith(KEY_PREFIX)) callback(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  },

  // Demo-only extras. Against a real backend, api.demo is null and these screens hide themselves.
  demo: {
    accounts: service.demo.accounts(),
    testCases: service.demo.testCases(),
    qrCases: () => call((u) => service.demo.qrCases(u)),
    undoRecall: (batchId) => call((u) => service.demo.undoRecall(u, batchId)),
    reset: () => call((u) => service.demo.reset(u)),
  },
};
