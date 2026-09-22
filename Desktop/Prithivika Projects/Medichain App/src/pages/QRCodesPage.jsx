// Admin (demo only): printable QR codes for the demo packs, so the camera scanner can be tested
// without real packaging. Batches made in the manufacturer portal have their own QR sheets.
import { api } from '../api/index.js';
import { useApiData } from '../hooks/useApiData.js';
import QRImage from '../components/QRImage.jsx';
import { LoadingCard, ErrorCard } from '../components/StateViews.jsx';
import { StatusBadge } from '../components/Badges.jsx';
import { encodeQrPayload } from '../logic/qrPayload.js';

export default function QRCodesPage() {
  const casesQ = useApiData(() => (api.demo ? api.demo.qrCases() : Promise.resolve([])), [], { live: false });

  if (!api.demo) {
    return (
      <div className="page page-narrow">
        <div className="card">
          <h1>Test QR codes</h1>
          <p className="muted">This page only exists with the demo data. Manufacturers print real QR codes from the manufacturer portal.</p>
        </div>
      </div>
    );
  }

  const cards = (casesQ.data || []).map((c) => ({ ...c, key: c.label || c.packId, payload: encodeQrPayload(c.packId, c.signature) }));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Test QR codes</h1>
          <p className="subtitle">Show one of these to the camera on the Verify page. Use a second screen or print this page.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>Print</button>
      </div>

      {casesQ.loading && !casesQ.data && <LoadingCard label="Loading QR codes…" />}
      {casesQ.error && !casesQ.data && <ErrorCard error={casesQ.error} onRetry={casesQ.reload} />}

      <div className="qr-grid qr-grid-wide">
        {cards.map((c) => (
          <div key={c.key} className="card qr-card">
            <QRImage value={c.payload} size={140} alt={`QR code for ${c.key}`} />
            <div className="qr-id">{c.label || c.packId}</div>
            {c.expected && <StatusBadge result={c.expected} />}
            <div className="muted small">{c.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
