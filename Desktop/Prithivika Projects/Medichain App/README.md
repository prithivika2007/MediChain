# MediChain: medicine anti-counterfeit system 

Manufacturer portal, supply chain tracking, medicine verification, admin dashboard, anomaly alerts, recall and expiry, in one React app.

It runs in two modes. The screens are identical in both:

| Mode | What it is | Command |
|---|---|---|
| **mock** (default) | Everything runs in the browser and saves to localStorage. No backend needed. Use this for demos. | `npm run dev` |
| **http** | The same screens talking to a real backend through the API in `API_CONTRACT.md`. | `npm run dev:http` |

## Install and run
```
npm install
npm run dev
```
Open http://localhost:5173

## Demo accounts (mock mode; not real security)
| Role | Username | Password | Can open |
|---|---|---|---|
| Admin | `admin` | `admin123` | Dashboard, Batches and recall, Supply chain (view only), Test QR codes |
| Manufacturer (ABC Pharma) | `abcpharma` | `pharma123` | Register batch, Supply chain (own batches, can record transfers) |
| Manufacturer (Sunrise) | `sunrise` | `pharma123` | Same, but sees only Sunrise batches |
| Customer | none | none | Verify page only |

## Pages
| URL | Who | What |
|---|---|---|
| `/` | everyone | Start page and sign-in |
| `/verify` | everyone | Medicine Verification: scan QR or type Pack ID |
| `/manufacturer` | manufacturer | Register batch, generate Pack IDs and QR codes, export CSV/PDF |
| `/supply-chain` | manufacturer, admin | Record hand-offs, see where every pack is |
| `/admin` | admin | Dashboard: cards, alerts, expiry watch, charts, recent scans |
| `/admin/batches` | admin | All batches, recall button |
| `/admin/qr-codes` | admin (mock only) | Printable QR codes for the demo packs |

## How the code is organised (the important idea)

Screens never touch storage or `fetch`. They call **one API layer**:

```
pages/*  ->  api (src/api/index.js)  ->  mock  (src/mock/mockApi.js  -> src/mock/server/service.js, saves to localStorage)
                                     ->  http  (src/api/httpApi.js   -> your real backend)
```
The mode is chosen by `VITE_API_MODE` (see `.env.example`). Both have exactly the same methods.

```
src/
  api/            index.js (chooses mock or http), httpApi.js (one method per endpoint), adapters.js (rename fields here),
                  session.js (token), errors.js, env.js (settings)
  mock/
    mockApi.js    the demo backend as an API (adds a fake delay)
    server/       THE BACKEND'S LOGIC: service.js (one function per endpoint), verifyPack.js, anomalyRules.js,
                  registerBatch.js, transfers.js, signature.js, seed data. The backend developer re-implements this.
  hooks/useApiData.js   loads data from the API, refreshes it, handles loading and errors
  auth/           login state, role guard (RequireRole), role labels
  pages/          the screens
  components/     reusable pieces (badges, QR scanner, QR image, toasts, loading/error cards)
  logic/          display helpers used by screens: alerts, batchUtils, qrPayload, supplyChain, exports (CSV/PDF)
  config.js       settings shared with the backend (30-day expiry warning, 500 packs per batch)
backend-stub/     a tiny reference backend (Node, in memory) for testing http mode
contract-test/    checks that a backend behaves like API_CONTRACT.md
API_CONTRACT.md   the document the backend developer builds from
```

## Testing http mode without the real backend
Two terminals:
```
npm run stub          # reference backend on http://localhost:8080
npm run dev:http      # the app, talking to it (accounts: admin/admin123, abcpharma/pharma123, sunrise/pharma123)
```
And the contract test (against the stub, or against the real backend):
```
npm run contract-test
BASE_URL=http://localhost:9000/api npm run contract-test
```

## Test guide (mock mode)
**Customer:** go to `/verify`. Use the "Demo shortcuts" chips, or the QR codes on `/admin/qr-codes`.
PK001 genuine, PK004 genuine + expiry warning, PK005 already used, PK009 recalled, PK011 expired,
PK014 and FAKE-9999 suspicious, "PK013 (forged QR)" suspicious (signature does not match).

**Anomaly rules:**
- Impossible travel: verify PK001 from Chennai, switch location to Mumbai, verify again.
- 20 scans: PK003 has 18 scans. Verify it twice more; the 20th is suspicious.

**Manufacturer to customer (the full flow):**
1. Sign in as `abcpharma`. Register a batch (for example batch number `BATCH-2026-001`, 10 packs).
2. Download the CSV/PDF. Open `/verify` and type `BATCH-2026-001-0001`. It shows GENUINE.
3. Set an expiry date within 30 days to see the expiry warning, or a past date to see EXPIRED.
4. Supply chain: record Manufacturer to Distributor (say 6 packs, Chennai), then Distributor to Wholesaler.
5. Sign out, sign in as `admin`. Batches and recall: recall `BATCH-2026-001`. Verify again: RECALLED.
6. The dashboard shows the alert; the supply chain page now blocks transfers for that batch.

"Reset demo data" on the dashboard starts again. Set `VITE_MOCK_LATENCY=0` in `.env` for instant responses.

## Notes
- Camera scanning works on `localhost` (laptop webcam). Phones need https for the camera; typing the Pack ID always works.
- Scan location is a dropdown because there is no real GPS in the demo.
