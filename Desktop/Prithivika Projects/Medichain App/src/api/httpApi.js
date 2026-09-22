// ---------------------------------------------------------------
// The REAL backend client. One method per endpoint in API_CONTRACT.md.
// Screens never call fetch() themselves: they call these methods (through `api`).
// ---------------------------------------------------------------
import { API_BASE_URL, POLL_MS } from './env.js';
import { ApiError } from './errors.js';
import { getToken, emitUnauthorized } from './session.js';
import { toBatch, toPack, toTransfer, toScan } from './adapters.js';

async function request(method, path, { body, query, auth = true } = {}) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  if (query) Object.entries(query).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, v); });

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the backend is running.');
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { /* not JSON */ }
  }

  if (!response.ok) {
    if (response.status === 401 && auth) emitUnauthorized(); // token missing/expired: the app signs the user out
    const fallback = response.status >= 500
      ? 'The server is not responding properly. Check that the backend is running.'
      : `Request failed (${response.status}).`;
    throw new ApiError(response.status, (data && data.message) || fallback);
  }
  return data;
}

const enc = encodeURIComponent;

export const httpApi = {
  mode: 'http',
  demo: null, // demo-only features (demo shortcuts, reset, test QR sheet) do not exist against a real backend

  // POST /auth/login  ->  { token, user }
  async login({ username, password }) {
    const data = await request('POST', '/auth/login', { body: { username, password }, auth: false });
    return { token: data.token, user: data.user };
  },

  // POST /verify  ->  scan record. Public (no token needed).
  async verify({ packId, signature, location }) {
    const data = await request('POST', '/verify', { body: { packId, signature: signature || null, location }, auth: false });
    return toScan(data);
  },

  // GET /batches  ->  Batch[]  (a manufacturer gets only their own, an admin gets all)
  async listBatches() {
    return (await request('GET', '/batches')).map(toBatch);
  },

  // POST /batches  ->  { batch, packs }
  async createBatch(values) {
    const data = await request('POST', '/batches', { body: values });
    return { batch: toBatch(data.batch), packs: data.packs.map(toPack) };
  },

  // GET /batches/{batchId}/packs  ->  Pack[]
  async listPacks(batchId) {
    return (await request('GET', `/batches/${enc(batchId)}/packs`)).map(toPack);
  },

  // POST /batches/{batchId}/recall  ->  Batch   (admin only)
  async recallBatch(batchId) {
    return toBatch(await request('POST', `/batches/${enc(batchId)}/recall`));
  },

  // GET /batches/{batchId}/transfers  ->  Transfer[]  (newest first)
  async listTransfers(batchId) {
    return (await request('GET', `/batches/${enc(batchId)}/transfers`)).map(toTransfer);
  },

  // POST /batches/{batchId}/transfers  ->  Transfer
  async createTransfer(batchId, body) {
    return toTransfer(await request('POST', `/batches/${enc(batchId)}/transfers`, { body }));
  },

  // GET /scans?limit=500  ->  scan record[]  (newest first, admin only)
  async listScans({ limit = 500 } = {}) {
    return (await request('GET', '/scans', { query: { limit } })).map(toScan);
  },

  // Live pages call this to refresh now and then (a real backend could push instead).
  subscribe(callback) {
    if (!POLL_MS) return () => {};
    const id = setInterval(callback, POLL_MS);
    return () => clearInterval(id);
  },
};
