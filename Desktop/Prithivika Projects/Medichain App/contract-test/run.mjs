// ---------------------------------------------------------------
// CONTRACT TEST for the backend developer. No dependencies, needs Node 18+.
//
//   npm run contract-test                                  (tests http://localhost:8080/api)
//   BASE_URL=http://localhost:9000/api npm run contract-test
//
// It talks to a running backend over plain HTTP and checks the behaviour described in API_CONTRACT.md.
// It creates its own batches (random batch numbers) so it does not depend on seed data and can be re-run.
// Needs three accounts (change with env vars): admin / abcpharma / sunrise, see API_CONTRACT.md.
// ---------------------------------------------------------------
const BASE = (process.env.BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '');
const ACCOUNTS = {
  admin: [process.env.ADMIN_USER || 'admin', process.env.ADMIN_PASS || 'admin123'],
  abc:   [process.env.MFR_USER || 'abcpharma', process.env.MFR_PASS || 'pharma123'],
  other: [process.env.MFR2_USER || 'sunrise', process.env.MFR2_PASS || 'pharma123'],
};

let passed = 0, failed = 0;
const check = (cond, name, detail = '') => {
  if (cond) passed++; else failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && detail ? `   (${detail})` : ''}`);
};

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  return { status: res.status, data };
}
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
const form = (id, extra = {}) => ({ medicineName: 'Testamol', strength: '500mg', packSize: '10 tablets', mrp: 25, batchNumber: id, mfgDate: day(-30), expiryDate: day(700), quantity: 5, ...extra });

async function login(name) {
  const [username, password] = ACCOUNTS[name];
  const r = await call('POST', '/auth/login', { body: { username, password } });
  if (r.status !== 200) { console.log(`Cannot sign in as ${name} (${username}): status ${r.status}. Fix the accounts first.`); process.exit(2); }
  return r.data;
}

console.log(`Testing ${BASE}\n`);

// ---- auth ----
let r = await call('POST', '/auth/login', { body: { username: 'admin', password: 'definitely-wrong' } });
check(r.status === 401 && typeof r.data?.message === 'string', 'login with a wrong password -> 401 with {message}', `status ${r.status}`);
const admin = await login('admin'), abc = await login('abc'), other = await login('other');
check(admin.user.role === 'admin' && abc.user.role === 'manufacturer' && abc.user.org && typeof abc.token === 'string', 'login returns {token, user:{username, role, name, org}}');

// ---- permissions ----
r = await call('GET', '/batches');
check(r.status === 401, 'GET /batches without a token -> 401', `status ${r.status}`);
r = await call('GET', '/scans', { token: abc.token });
check(r.status === 403, 'manufacturer cannot GET /scans -> 403', `status ${r.status}`);
r = await call('POST', '/batches', { token: admin.token, body: form('X') });
check(r.status === 403, 'admin cannot POST /batches -> 403', `status ${r.status}`);

// ---- verify (public) ----
r = await call('POST', '/verify', { body: { packId: 'NO-SUCH-PACK', location: 'Chennai' } });
check(r.status === 200 && r.data.result === 'SUSPICIOUS' && r.data.flags.includes('UNKNOWN_PACK'), 'verify unknown pack -> SUSPICIOUS + UNKNOWN_PACK', JSON.stringify(r.data));
r = await call('POST', '/verify', { body: { location: 'Chennai' } });
check(r.status === 400 && r.data?.message, 'verify without packId -> 400 with {message}', `status ${r.status}`);
r = await call('POST', '/verify', { body: { packId: 'X' } });
check(r.status === 400, 'verify without location -> 400', `status ${r.status}`);

// ---- register a batch ----
const id = `CT-${suffix}`;
r = await call('POST', '/batches', { token: abc.token, body: form(id.toLowerCase()) });
check(r.status === 201, 'POST /batches -> 201', `status ${r.status} ${JSON.stringify(r.data)}`);
const { batch, packs } = r.data || {};
check(batch?.batchId === id, 'batch number is upper-cased into batchId', batch?.batchId);
check(batch?.manufacturer === abc.user.org, 'manufacturer comes from the login, not the form');
check(packs?.length === 5 && packs.every((p) => p.packId && p.signature && p.holder === 'Manufacturer' && p.batchId === id), 'packs generated with packId, signature, holder=Manufacturer');
check(packs?.[0]?.packId === `${id}-0001`, 'pack ids look like BATCH-0001', packs?.[0]?.packId);
check(batch?.packCount === 5 && batch?.stageCounts?.Manufacturer === 5, 'batch has packCount and stageCounts');
r = await call('POST', '/batches', { token: abc.token, body: form(id) });
check(r.status === 400 && /exist/i.test(r.data?.message || ''), 'duplicate batch number -> 400', `status ${r.status}`);
r = await call('POST', '/batches', { token: abc.token, body: form('E1', { expiryDate: day(-40), mfgDate: day(-30) }) });
check(r.status === 400, 'expiry before manufacturing date -> 400', `status ${r.status}`);
r = await call('POST', '/batches', { token: abc.token, body: form('E2', { quantity: 501 }) });
check(r.status === 400, 'more than 500 packs -> 400', `status ${r.status}`);

// ---- visibility ----
r = await call('GET', '/batches', { token: abc.token });
check(r.status === 200 && r.data.some((b) => b.batchId === id) && r.data.every((b) => b.manufacturer === abc.user.org), 'manufacturer lists only their own batches');
r = await call('GET', '/batches', { token: other.token });
check(!r.data.some((b) => b.batchId === id), "another manufacturer does not see it");
r = await call('GET', '/batches', { token: admin.token });
check(r.data.some((b) => b.batchId === id), 'admin sees it');
r = await call('GET', `/batches/${id}/packs`, { token: other.token });
check(r.status === 403, "another manufacturer's packs -> 403", `status ${r.status}`);
r = await call('GET', '/batches/NOPE-404/packs', { token: admin.token });
check(r.status === 404, 'unknown batch -> 404', `status ${r.status}`);
r = await call('GET', `/batches/${id}/packs`, { token: abc.token });
check(r.status === 200 && r.data.length === 5, 'GET /batches/{id}/packs');

// ---- verification rules ----
const [p1, p2, p3] = packs;
r = await call('POST', '/verify', { body: { packId: p1.packId, signature: p1.signature, location: 'Chennai' } });
check(r.data?.result === 'GENUINE' && r.data.signatureCheck === 'VALID' && r.data.medicine === 'Testamol 500mg' && r.data.manufacturer === abc.user.org, 'genuine pack with valid signature', JSON.stringify(r.data));
check(r.data?.scanNumber === 1 && r.data.batchId === id && r.data.location === 'Chennai' && typeof r.data.timestamp === 'number' && Array.isArray(r.data.reasons), 'scan record has scanNumber, batchId, location, timestamp (ms), reasons[]');
r = await call('POST', '/verify', { body: { packId: p1.packId.toLowerCase(), location: 'Chennai' } });
check(r.data?.result === 'GENUINE' && r.data.signatureCheck === null && r.data.scanNumber === 2, 'Pack ID is case-insensitive; no signature -> signatureCheck null');
r = await call('POST', '/verify', { body: { packId: p2.packId, signature: 'WRONG-SIGNATURE', location: 'Chennai' } });
check(r.data?.result === 'SUSPICIOUS' && r.data.flags.includes('INVALID_SIGNATURE') && r.data.signatureCheck === 'INVALID', 'wrong signature -> SUSPICIOUS + INVALID_SIGNATURE');
r = await call('POST', '/verify', { body: { packId: p1.packId, location: 'Mumbai' } });
check(r.data?.result === 'SUSPICIOUS' && r.data.flags.includes('IMPOSSIBLE_TRAVEL'), 'Chennai then Mumbai within seconds -> IMPOSSIBLE_TRAVEL');
r = await call('POST', '/verify', { body: { packId: p1.packId, location: 'Mumbai' } });
check(r.data?.result === 'SUSPICIOUS' && r.data.flags.includes('PREVIOUSLY_FLAGGED'), 'later scans stay suspicious -> PREVIOUSLY_FLAGGED');
let last;
for (let i = 1; i <= 20; i++) last = (await call('POST', '/verify', { body: { packId: p3.packId, location: 'Delhi' } })).data;
check(last?.scanNumber === 20 && last.result === 'SUSPICIOUS' && last.flags.includes('HIGH_SCAN_COUNT'), '20th scan of a pack -> HIGH_SCAN_COUNT');

const soon = `CS-${suffix}`, old = `CO-${suffix}`;
r = await call('POST', '/batches', { token: abc.token, body: form(soon, { expiryDate: day(10), quantity: 1 }) });
r = await call('POST', '/verify', { body: { packId: `${soon}-0001`, location: 'Chennai' } });
check(r.data?.result === 'GENUINE' && r.data.flags.includes('EXPIRING_SOON'), 'expires within 30 days -> GENUINE + EXPIRING_SOON');
r = await call('POST', '/batches', { token: abc.token, body: form(old, { mfgDate: day(-400), expiryDate: day(-5), quantity: 1 }) });
check(r.status === 201, 'a batch with a past expiry date can be registered (for testing)', `status ${r.status}`);
r = await call('POST', '/verify', { body: { packId: `${old}-0001`, location: 'Chennai' } });
check(r.data?.result === 'EXPIRED' && r.data.flags.includes('EXPIRED'), 'past expiry -> EXPIRED');

// ---- supply chain ----
const T = (o = {}) => ({ from: 'Manufacturer', to: 'Distributor', quantity: 2, location: 'Chennai', timestamp: Date.now() - 5000, notes: 'ref-1', ...o });
r = await call('POST', `/batches/${id}/transfers`, { token: other.token, body: T() });
check(r.status === 403, "another manufacturer cannot record a transfer -> 403", `status ${r.status}`);
r = await call('POST', `/batches/${id}/transfers`, { token: admin.token, body: T() });
check(r.status === 403, 'admin cannot record a transfer -> 403', `status ${r.status}`);
r = await call('POST', `/batches/${id}/transfers`, { token: abc.token, body: T({ quantity: 6 }) });
check(r.status === 400 && r.data?.message, 'quantity above stock -> 400 with message', `status ${r.status}`);
r = await call('POST', `/batches/${id}/transfers`, { token: abc.token, body: T({ to: 'Retailer' }) });
check(r.status === 400, 'skipping a stage -> 400', `status ${r.status}`);
r = await call('POST', `/batches/${id}/transfers`, { token: abc.token, body: T({ timestamp: Date.now() + 3600e3 }) });
check(r.status === 400, 'transfer time in the future -> 400', `status ${r.status}`);
r = await call('POST', `/batches/${id}/transfers`, { token: abc.token, body: T({ location: '  ' }) });
check(r.status === 400, 'empty location -> 400', `status ${r.status}`);
r = await call('POST', `/batches/${id}/transfers`, { token: abc.token, body: T() });
check(r.status === 201 && r.data.id && r.data.quantity === 2 && r.data.from === 'Manufacturer' && r.data.to === 'Distributor', 'POST transfer -> 201 with id');
r = await call('POST', `/batches/${id}/transfers`, { token: abc.token, body: T({ timestamp: Date.now() - 600000 }) });
check(r.status === 400, 'transfer older than the previous one -> 400', `status ${r.status}`);
r = await call('POST', `/batches/${id}/transfers`, { token: abc.token, body: T({ from: 'Distributor', to: 'Wholesaler', quantity: 1, timestamp: Date.now() - 1000 }) });
check(r.status === 201, 'second hop Distributor -> Wholesaler');
r = await call('GET', `/batches/${id}/packs`, { token: abc.token });
const holders = r.data.map((p) => p.holder);
check(holders.filter((h) => h === 'Manufacturer').length === 3 && holders.filter((h) => h === 'Distributor').length === 1 && holders.filter((h) => h === 'Wholesaler').length === 1, 'pack holders follow the transfers (3 / 1 / 1)', holders.join(','));
r = await call('GET', `/batches`, { token: abc.token });
const cnt = r.data.find((b) => b.batchId === id).stageCounts;
check(cnt.Manufacturer === 3 && cnt.Distributor === 1 && cnt.Wholesaler === 1 && cnt.Retailer === 0, 'batch stageCounts follow the transfers', JSON.stringify(cnt));
r = await call('GET', `/batches/${id}/transfers`, { token: admin.token });
check(r.status === 200 && r.data.length === 2 && r.data[0].timestamp > r.data[1].timestamp, 'transfers listed newest first (admin may read)');

// ---- recall ----
r = await call('POST', `/batches/${id}/recall`, { token: abc.token });
check(r.status === 403, 'manufacturer cannot recall -> 403', `status ${r.status}`);
r = await call('POST', `/batches/${id}/recall`, { token: admin.token });
check(r.status === 200 && r.data.status === 'RECALLED' && r.data.recalledAt, 'admin recalls -> 200, status RECALLED, recalledAt set');
r = await call('POST', `/batches/${id}/recall`, { token: admin.token });
check(r.status === 409, 'recalling twice -> 409', `status ${r.status}`);
r = await call('POST', '/verify', { body: { packId: p1.packId, location: 'Chennai' } });
check(r.data?.result === 'RECALLED' && r.data.flags.includes('RECALLED_BATCH'), 'verify after recall -> RECALLED (beats every other result)');
r = await call('POST', `/batches/${id}/transfers`, { token: abc.token, body: T({ from: 'Manufacturer', timestamp: Date.now() }) });
check(r.status === 400, 'recalled batch rejects transfers -> 400', `status ${r.status}`);

// ---- scan history ----
r = await call('GET', '/scans?limit=5', { token: admin.token });
check(r.status === 200 && r.data.length === 5 && r.data[0].timestamp >= r.data[4].timestamp, 'GET /scans?limit=5 -> 5 scans, newest first');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
