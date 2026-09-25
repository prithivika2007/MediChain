# MediChain API contract (for the backend developer)

The frontend talks to the backend only through the endpoints below. Build these, run
`npm run contract-test` against your server, and the frontend works with no code changes.

- Base path: `/api`. JSON in and out (`Content-Type: application/json`).
- Dates are `"YYYY-MM-DD"` strings. Times are **epoch milliseconds** (a number, for example `1789000000000`).
- Errors: an HTTP status of 400 or above with a body `{ "message": "Human readable text" }`. The frontend shows that message to the user, so write it for users.
- Auth: `Authorization: Bearer <token>`. Roles are `admin` and `manufacturer`. Customers do not sign in.

## Try it first

A working reference backend (Node, in memory) is included so you can see every request and response:

```
npm run stub            # reference backend on http://localhost:8080
npm run contract-test   # 51 checks against it (or against YOUR server: BASE_URL=http://localhost:9000/api npm run contract-test)
npm run dev:http        # the frontend, talking to the backend instead of its built-in demo
```

The reference backend's rules live in `src/mock/server/`. **`service.js` is the file to read**: one function per endpoint.
The screens never call `fetch()` directly. They use `src/api/httpApi.js` (one method per endpoint below).
If your JSON uses different field names, change them in `src/api/adapters.js` (one place) instead of editing screens.

## Endpoints

| Method and path | Who | Purpose |
|---|---|---|
| `POST /auth/login` | anyone | Sign in, get a token |
| `POST /verify` | **anyone (public)** | Verify a pack and record the scan |
| `GET /batches` | manufacturer, admin | List batches (manufacturer: own only, admin: all) |
| `POST /batches` | manufacturer | Register a batch and generate its packs |
| `GET /batches/{batchId}/packs` | manufacturer (own), admin | Packs of a batch |
| `POST /batches/{batchId}/recall` | admin | Recall a batch |
| `GET /batches/{batchId}/transfers` | manufacturer (own), admin | Supply chain hand-offs, newest first |
| `POST /batches/{batchId}/transfers` | manufacturer (own) | Record a hand-off |
| `GET /scans?limit=500` | admin | Recent verification scans, newest first |

Status codes: `200` OK, `201` created, `400` invalid input (with a clear `message`), `401` not signed in / bad token,
`403` signed in but not allowed, `404` unknown batch, `409` already done (recalling a recalled batch).

**401 versus 403 matters.** On any 401 (except the login call) the frontend signs the user out and returns to the login page.
Use 403 for "you are signed in but may not do this".

## Data shapes

**User**
```json
{ "username": "abcpharma", "role": "manufacturer", "name": "ABC Pharma", "org": "ABC Pharma" }
```
`org` is the manufacturer's company name (`null` for admins). A batch's `manufacturer` is set from the signed-in user's `org`, never from the form.

**Batch**
```json
{
  "batchId": "B002", "medicineName": "Amoxicillin", "strength": "250mg", "packSize": "10 capsules", "mrp": 120,
  "manufacturer": "MediCure Labs", "mfgDate": "2024-10-21", "expiry": "2026-10-09",
  "status": "ACTIVE", "recalledAt": null, "createdAt": 1789000000000,
  "packCount": 2,
  "stageCounts": { "Manufacturer": 0, "Distributor": 2, "Wholesaler": 0, "Retailer": 0 }
}
```
`status` is `ACTIVE` or `RECALLED`. `packCount` and `stageCounts` are calculated (the dashboard uses them, so it does not have to download every pack).

**Pack**
```json
{ "packId": "BATCH-2026-001-0001", "batchId": "BATCH-2026-001", "status": "ACTIVE", "signature": "04164133", "holder": "Manufacturer" }
```
`status` is `ACTIVE`, `USED` or `SUSPICIOUS`. `holder` is one of `Manufacturer`, `Distributor`, `Wholesaler`, `Retailer`.
Medicine, manufacturer and expiry are **not** stored on the pack. They come from its batch.

**Transfer**
```json
{ "id": "TR-1789000000000-412", "batchId": "B001", "from": "Manufacturer", "to": "Distributor",
  "quantity": 3, "location": "Chennai", "timestamp": 1789000000000, "notes": "" }
```

**Scan record** (the response of `POST /verify`, and the items of `GET /scans`)
```json
{
  "id": "1789000000000-5821", "packId": "PK004", "location": "Chennai", "timestamp": 1789000000000, "scanNumber": 5,
  "batchId": "B002", "medicine": "Amoxicillin 250mg", "manufacturer": "MediCure Labs", "packSize": "10 capsules", "mrp": 120,
  "expiry": "2026-10-09", "signatureCheck": null,
  "result": "GENUINE",
  "flags": ["EXPIRING_SOON"],
  "reasons": [ { "flag": "EXPIRING_SOON", "text": "This pack expires in 18 days." } ]
}
```
- `result`: `GENUINE`, `SUSPICIOUS`, `EXPIRED`, `RECALLED` or `ALREADY_USED`. The big headline on the verify screen.
- `flags`: every reason that applied (list below). The dashboard builds its alerts from these.
- `reasons`: the text shown to the user, one per flag.
- `signatureCheck`: `"VALID"`, `"INVALID"`, or `null` when no signature was sent.
- For an unknown pack: `batchId` `"—"`, `medicine` `"Unknown product"`, `manufacturer` `"Unknown"`, and `packSize`, `mrp`, `expiry` are `null`.

## Request and response examples

**Login**
```
POST /api/auth/login   { "username": "abcpharma", "password": "pharma123" }
200 { "token": "<any string, for example a JWT>", "user": { ...User } }
401 { "message": "Invalid username or password." }
```

**Verify (public, no token)**
```
POST /api/verify   { "packId": "PK004", "signature": "AB12CD34", "location": "Chennai" }
200 { ...Scan record }
400 { "message": "packId is required." }
```
`signature` is `null` when the person typed the Pack ID instead of scanning. `location` is a required text label (see the travel rule).
Pack IDs are **case-insensitive** (the frontend sends them upper-cased). Signatures are case-sensitive and sent exactly as printed in the QR code.
Every call to this endpoint is stored as a scan, including failed ones (unknown pack, bad signature).

**Register a batch**
```
POST /api/batches
{ "medicineName": "Paracetamol", "strength": "500mg", "packSize": "10 tablets", "mrp": "25",
  "batchNumber": "batch-2026-001", "mfgDate": "2026-09-21", "expiryDate": "2028-09-20", "quantity": "10" }
201 { "batch": { ...Batch }, "packs": [ { ...Pack }, ... ] }
```
Numbers may arrive as strings (they come from form fields). Rules:
- Every text field is required. `batchNumber` is trimmed and upper-cased and becomes `batchId`. It must match `^[A-Z0-9][A-Z0-9-]*$` and be unique.
- `quantity` is a whole number from 1 to 500. `mrp` is a number of 0 or more. `expiryDate` must be after `mfgDate`. (A past expiry date is allowed on purpose, to test EXPIRED.)
- The **backend** creates the packs: `packId` = `batchId + "-" + 4-digit counter` (`BATCH-2026-001-0001`), status `ACTIVE`, holder `Manufacturer`, and a `signature` (see below).
- Everything above failing gives `400` with a message.

**Record a transfer**
```
POST /api/batches/B001/transfers
{ "from": "Distributor", "to": "Wholesaler", "quantity": 2, "location": "Bengaluru", "timestamp": 1789000000000, "notes": "ref 44" }
201 { ...Transfer }
```
Rules (`400` with a message when broken):
1. The batch must not be recalled.
2. `from` must be `Manufacturer`, `Distributor` or `Wholesaler`, and `to` must be the next stage. No skipping.
3. `quantity` is a whole number from 1 to the number of packs of this batch currently held at `from`.
4. `location` is not empty.
5. `timestamp` is not more than a minute in the future, and is not earlier than the newest existing transfer of that batch.
6. Then move the first `quantity` packs (in creation order) that are at `from` to `to`: set their `holder`.

**Recall**
```
POST /api/batches/B003/recall   ->  200 { ...Batch }  (status RECALLED, recalledAt = now)
409 if it is already recalled.
```
There is no un-recall endpoint. (The demo has an "Undo recall" button, hidden in http mode.)

## Verification rules (the decision `POST /verify` makes)

Look up the pack and its batch. Work through these steps, collecting **flags**. `scanNumber` is the number of earlier scans of this pack plus 1.

| Step | Condition | Flag (and text to show) |
|---|---|---|
| 0 | Pack ID not found | `UNKNOWN_PACK`, then stop with result `SUSPICIOUS` |
| 1 | Batch status is `RECALLED` | `RECALLED_BATCH` |
| 2 | Expiry date is in the past (valid through the end of the expiry day) | `EXPIRED` |
| 2 | Expires within the next 30 days (and not expired) | `EXPIRING_SOON` (a warning only) |
| 3 | A signature was sent and does not equal the pack's signature | `INVALID_SIGNATURE` (and `signatureCheck` = `INVALID`; `VALID` when it matches) |
| 4 | **Impossible travel**: see below | `IMPOSSIBLE_TRAVEL` |
| 4 | Not travelling now, but an earlier scan of this pack was flagged `IMPOSSIBLE_TRAVEL` | `PREVIOUSLY_FLAGGED` |
| 4 | `scanNumber` is 20 or more | `HIGH_SCAN_COUNT` |
| 5 | Pack status is `SUSPICIOUS` | `FLAGGED_PACK` |
| 5 | Pack status is `USED` | `ALREADY_USED` |

**Result: the first line that matches wins** (priority order):

1. `RECALLED_BATCH` gives `RECALLED`
2. `EXPIRED` gives `EXPIRED`
3. any of `INVALID_SIGNATURE`, `IMPOSSIBLE_TRAVEL`, `PREVIOUSLY_FLAGGED`, `HIGH_SCAN_COUNT`, `FLAGGED_PACK` gives `SUSPICIOUS`
4. `ALREADY_USED` gives `ALREADY_USED`
5. otherwise `GENUINE` (`EXPIRING_SOON` alone is still genuine)

**Impossible travel rule.** Take the most recent earlier scan of the same pack. If its `location` differs from this one:
distance = straight-line (haversine) distance between the two places; hours = time between the scans (at least 1 minute).
Flag it when **distance >= 100 km and distance / hours > 500 km/h**. Example: Chennai then Mumbai 15 minutes apart is 1033 km, so about 4100 km/h, flagged.
The frontend sends `location` as one of these names. Coordinates for the distance:

| Location | Latitude | Longitude |
|---|---|---|
| Chennai | 13.0827 | 80.2707 |
| Mumbai | 19.0760 | 72.8777 |
| Delhi | 28.6139 | 77.2090 |
| Bengaluru | 12.9716 | 77.5946 |
| Hyderabad | 17.3850 | 78.4867 |
| Kolkata | 22.5726 | 88.3639 |
| Pune | 18.5204 | 73.8567 |
| Coimbatore | 11.0168 | 76.9558 |

An unknown location name simply skips the travel rule. (Later the app can send real GPS coordinates. That is a small change in `src/pages/VerifyPage.jsx` and the contract.)

The exact numbers (20 scans, 500 km/h, 100 km, 30 days) are constants in `src/mock/server/rules.js` and `src/config.js`. The frontend also uses the 30-day value for its expiry badges.
The reference implementation is `src/mock/server/verifyPack.js` and `anomalyRules.js`.

## Signatures and the QR code

Each pack has a `signature`, made when the batch is registered. The mock (`src/mock/server/signature.js`) is a simple hash so the demo works. **Replace it with a real digital signature** (for example ECDSA or RSA over the Pack ID and batch data, with the manufacturer's or system's private key). Verification then checks the signature sent from the QR code against the pack.

The QR code contains this JSON: `{"packId":"BATCH-2026-001-0001","signature":"04164133"}`.
It is written in one place, `src/logic/qrPayload.js` (`encodeQrPayload` and `parseQrPayload`). If you want more fields (batchId, manufacturerId), change that file and tell the frontend developer.

## Permissions at a glance

| | Customer (no token) | Manufacturer | Admin |
|---|---|---|---|
| `POST /verify` | yes | yes | yes |
| `GET /batches` | no | own batches | all batches |
| `POST /batches` | no | yes | **no** (403) |
| `GET packs` / `GET transfers` of a batch | no | own batches only | all |
| `POST transfers` | no | own batches only | **no** (403) |
| `POST recall` | no | **no** (403) | yes |
| `GET /scans` | no | no | yes |

Hiding pages in the browser is not security. The backend must check the token and role on every request above.

## Suggested tables

- `users` (username, password_hash, role, name, org)
- `batches` (batch_id PK, medicine_name, strength, pack_size, mrp, manufacturer, mfg_date, expiry, status, recalled_at, created_at)
- `packs` (pack_id PK, batch_id FK, status, signature, holder)
- `transfers` (id PK, batch_id FK, from_stage, to_stage, quantity, location, timestamp, notes)
- `scans` (id PK, pack_id, location, timestamp, scan_number, result, flags, reasons, signature_check, plus the pack details shown to the user)

`packCount` and `stageCounts` are `COUNT(*)` queries grouped by batch and holder.
If Track A also writes each event to a ledger (created, transferred, recalled), append it in the same place the database is updated.

## Switching the frontend to your backend

1. Run your backend (for example on port 8080).
2. Copy `.env.example` to `.env` and set `VITE_PROXY_TARGET` to it if it is not on 8080.
3. `npm run dev:http`. The browser calls `/api/...` on the Vite dev server, which forwards to your backend, so no CORS setup is needed while developing.
4. For a deployed build set `VITE_API_MODE=http` and `VITE_API_BASE_URL` (for example `https://api.example.com/api`) before `npm run build`. A different origin needs CORS (allow `Authorization` and `Content-Type` headers and the `GET, POST, OPTIONS` methods).

In http mode these demo-only things disappear by themselves: the demo account list on the login page, the "Demo shortcuts" on the verify page, the Test QR codes page, "Reset demo data" and "Undo recall". Pages refresh themselves every 10 seconds (`VITE_POLL_MS`).

## Checklist

- [ ] Login returns `{token, user}`; wrong password gives 401 `{message}`
- [ ] Token checked on every non-public endpoint (401 without, 403 wrong role)
- [ ] `POST /verify` is public, stores every scan, follows the rules and priority above
- [ ] Batch registration validates, generates packs and signatures
- [ ] Transfers follow the six rules and update pack holders
- [ ] Recall works, is admin only, and makes later verifications return `RECALLED`
- [ ] `GET /batches` returns `packCount` and `stageCounts`
- [ ] `npm run contract-test` shows `0 failed`
