// ---------------------------------------------------------------
// A tiny reference backend, only for testing the frontend's HTTP mode before the real backend exists.
//
//   npm run stub          (starts on http://localhost:8080)
//   npm run dev:http      (in a second terminal: the app, talking to this server)
//
// It has no dependencies and keeps data in memory (restart = fresh data).
// It uses the same business rules as the demo (src/mock/server/service.js).
// The real backend must give the same answers for the same requests: see API_CONTRACT.md.
// ---------------------------------------------------------------
import http from 'node:http';
import { createService, ServiceError } from '../src/mock/server/service.js';

const memory = new Map();
const store = {
  get: (key) => (memory.has(key) ? structuredClone(memory.get(key)) : null),
  set: (key, value) => { memory.set(key, structuredClone(value)); },
  remove: (key) => { memory.delete(key); },
};
const service = createService(store);
const PORT = Number(process.env.PORT || 8080);

// [method, path pattern, status on success, handler(user, params, body, query)]
const routes = [
  ['POST', '/api/auth/login',                   200, (u, p, body) => service.login(body)],
  ['POST', '/api/verify',                       200, (u, p, body) => service.verify(body)],
  ['GET',  '/api/batches',                      200, (u) => service.listBatches(u)],
  ['POST', '/api/batches',                      201, (u, p, body) => service.createBatch(u, body)],
  ['GET',  '/api/batches/:batchId/packs',       200, (u, p) => service.listPacks(u, p.batchId)],
  ['POST', '/api/batches/:batchId/recall',      200, (u, p) => service.recallBatch(u, p.batchId)],
  ['GET',  '/api/batches/:batchId/transfers',   200, (u, p) => service.listTransfers(u, p.batchId)],
  ['POST', '/api/batches/:batchId/transfers',   201, (u, p, body) => service.createTransfer(u, p.batchId, body)],
  ['GET',  '/api/scans',                        200, (u, p, b, query) => service.listScans(u, { limit: query.get('limit') })],
];

function match(method, pathname) {
  for (const [m, pattern, status, handler] of routes) {
    if (m !== method) continue;
    const names = [];
    const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '/?$');
    const found = pathname.match(regex);
    if (found) return { status, handler, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(found[i + 1])])) };
  }
  return null;
}

function send(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(payload === undefined ? '' : JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = match(req.method, url.pathname);
  if (!route) return send(res, 404, { message: `No endpoint ${req.method} ${url.pathname}.` });

  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    try {
      const body = raw ? JSON.parse(raw) : {};
      const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const user = service.userFromToken(bearer);
      const result = route.handler(user, route.params, body, url.searchParams);
      console.log(`${req.method} ${url.pathname} -> ${route.status}`);
      send(res, route.status, result);
    } catch (e) {
      const status = e instanceof ServiceError ? e.status : e instanceof SyntaxError ? 400 : 500;
      console.log(`${req.method} ${url.pathname} -> ${status} ${e.message}`);
      send(res, status, { message: e instanceof SyntaxError ? 'Request body is not valid JSON.' : e.message });
    }
  });
});

server.listen(PORT, () => console.log(`MediChain reference backend running on http://localhost:${PORT}`));
