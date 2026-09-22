// Manufacturer portal: register a batch, generate pack IDs + QR codes, export for printing.
// Everything is loaded and saved through the API. The server generates the Pack IDs and signatures.
import { useRef, useState } from 'react';
import { api } from '../api/index.js';
import { useApiData } from '../hooks/useApiData.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import QRImage from '../components/QRImage.jsx';
import { LoadingCard, ErrorCard } from '../components/StateViews.jsx';
import { BatchStatusBadge, ExpiryBadge } from '../components/Badges.jsx';
import { encodeQrPayload } from '../logic/qrPayload.js';
import { displayName } from '../logic/batchUtils.js';
import { downloadCsv, downloadPdf } from '../logic/exports.js';
import { MAX_PACKS_PER_BATCH } from '../config.js';
import { daysFromNow, formatDate } from '../utils/dateUtils.js';

const SHOW_QR = 24;     // how many QR codes to draw on screen (the PDF has all of them)
const SHOW_ROWS = 50;   // how many table rows to show before "Show all"

function emptyForm() {
  return {
    medicineName: '', strength: '', packSize: '', mrp: '', batchNumber: '',
    mfgDate: daysFromNow(0), expiryDate: daysFromNow(730), quantity: 10,
  };
}

export default function ManufacturerPage() {
  const { user } = useAuth();
  const showToast = useToast();
  const resultsRef = useRef(null);

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [showAllRows, setShowAllRows] = useState(false);
  const [exporting, setExporting] = useState(false);

  // The server only returns this manufacturer's own batches.
  const batchesQ = useApiData(() => api.listBatches(), []);
  const packsQ = useApiData(() => (selectedId ? api.listPacks(selectedId) : Promise.resolve([])), [selectedId], { live: false });

  const batches = batchesQ.data || [];
  const selected = batches.find((b) => b.batchId === selectedId) || null;
  const selectedPacks = packsQ.data || [];

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const openBatch = (batchId) => {
    setSelectedId(batchId);
    setShowAllRows(false);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { batch, packs } = await api.createBatch(form);
      showToast(`Batch ${batch.batchId} registered with ${packs.length} packs.`);
      setForm(emptyForm());
      batchesQ.reload();
      openBatch(batch.batchId);
    } catch (err) {
      setError(err.message); // for example "Batch B001 already exists"
    } finally {
      setSaving(false);
    }
  };

  const handlePdf = async () => {
    setExporting(true);
    try {
      await downloadPdf(selected, selectedPacks);
      showToast('PDF downloaded.');
    } catch {
      showToast('Could not create the PDF. Try the CSV export instead.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const visibleRows = showAllRows ? selectedPacks : selectedPacks.slice(0, SHOW_ROWS);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Manufacturer portal</h1>
          <p className="subtitle">Register a batch, then print the QR codes on your packaging line.</p>
        </div>
      </div>

      <section className="card">
        <h2>Register a new batch</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field">
              <span>Manufacturer</span>
              <input className="input" value={user.org} readOnly />
            </label>
            <label className="field">
              <span>Medicine name</span>
              <input className="input" value={form.medicineName} onChange={setField('medicineName')} required placeholder="For example Paracetamol" />
            </label>
            <label className="field">
              <span>Strength</span>
              <input className="input" value={form.strength} onChange={setField('strength')} required placeholder="For example 500mg" />
            </label>
            <label className="field">
              <span>Pack size</span>
              <input className="input" value={form.packSize} onChange={setField('packSize')} required placeholder="For example 10 tablets" />
            </label>
            <label className="field">
              <span>MRP (₹)</span>
              <input className="input" type="number" min="0" step="0.01" value={form.mrp} onChange={setField('mrp')} required />
            </label>
            <label className="field">
              <span>Batch number</span>
              <input className="input" value={form.batchNumber} onChange={setField('batchNumber')} required placeholder="For example BATCH-2026-001" />
              <small className="hint">Letters, numbers and hyphens. Pack IDs will be {(form.batchNumber || 'BATCH-2026-001').toUpperCase()}-0001, -0002 and so on.</small>
            </label>
            <label className="field">
              <span>Manufacturing date</span>
              <input className="input" type="date" value={form.mfgDate} onChange={setField('mfgDate')} required />
            </label>
            <label className="field">
              <span>Expiry date</span>
              <input className="input" type="date" value={form.expiryDate} onChange={setField('expiryDate')} required />
            </label>
            <label className="field">
              <span>Number of packs</span>
              <input className="input" type="number" min="1" max={MAX_PACKS_PER_BATCH} value={form.quantity} onChange={setField('quantity')} required />
              <small className="hint">Up to {MAX_PACKS_PER_BATCH} per batch.</small>
            </label>
          </div>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-lg form-submit" disabled={saving}>
            {saving ? 'Registering…' : 'Register batch and generate QR codes'}
          </button>
        </form>
      </section>

      {selected && (
        <section className="card" ref={resultsRef}>
          <div className="results-head">
            <div>
              <h2>Packs in batch {selected.batchId}</h2>
              <p className="muted">{displayName(selected)}, {selected.packCount} packs, expires {formatDate(selected.expiry)}</p>
            </div>
            <div className="actions">
              <button type="button" className="btn btn-secondary" disabled={!selectedPacks.length} onClick={() => downloadCsv(selected, selectedPacks)}>Download CSV</button>
              <button type="button" className="btn btn-secondary" onClick={handlePdf} disabled={exporting || !selectedPacks.length}>
                {exporting ? 'Creating PDF…' : 'Download PDF of QR codes'}
              </button>
            </div>
          </div>

          {packsQ.loading && <p className="muted">Loading packs…</p>}
          {packsQ.error && !packsQ.data && <ErrorCard error={packsQ.error} onRetry={packsQ.reload} />}

          {selectedPacks.length > 0 && (
            <>
              <div className="qr-grid">
                {selectedPacks.slice(0, SHOW_QR).map((p) => (
                  <div key={p.packId} className="qr-item">
                    <QRImage value={encodeQrPayload(p.packId, p.signature)} size={120} alt={`QR code for ${p.packId}`} />
                    <p>{p.packId}</p>
                  </div>
                ))}
              </div>
              {selectedPacks.length > SHOW_QR && (
                <p className="muted small">Showing the first {SHOW_QR} QR codes. The PDF has all {selectedPacks.length}.</p>
              )}

              <h3 className="table-title">Pack details</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Pack ID</th><th>Medicine</th><th>Batch</th><th>MRP</th><th>Mfg date</th><th>Expiry</th><th>Signature</th></tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((p) => (
                      <tr key={p.packId}>
                        <td><strong>{p.packId}</strong></td>
                        <td>{displayName(selected)}</td>
                        <td>{selected.batchId}</td>
                        <td>₹{selected.mrp}</td>
                        <td>{formatDate(selected.mfgDate)}</td>
                        <td>{formatDate(selected.expiry)}</td>
                        <td><code>{p.signature}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedPacks.length > SHOW_ROWS && (
                <button type="button" className="btn btn-secondary btn-sm table-more" onClick={() => setShowAllRows((v) => !v)}>
                  {showAllRows ? `Show first ${SHOW_ROWS}` : `Show all ${selectedPacks.length} rows`}
                </button>
              )}
            </>
          )}
        </section>
      )}

      <section className="card">
        <h2>Your batches</h2>
        {batchesQ.loading && !batchesQ.data && <p className="muted">Loading your batches…</p>}
        {batchesQ.error && !batchesQ.data && <ErrorCard error={batchesQ.error} onRetry={batchesQ.reload} />}
        {batchesQ.data && batches.length === 0 && <p className="muted">No batches yet. Register your first batch above.</p>}
        {batches.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Batch</th><th>Medicine</th><th>Packs</th><th>Expiry</th><th>Status</th><th>QR codes</th></tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.batchId}>
                    <td><strong>{b.batchId}</strong></td>
                    <td>{displayName(b)}</td>
                    <td>{b.packCount}</td>
                    <td>
                      {formatDate(b.expiry)}
                      <div><ExpiryBadge expiry={b.expiry} /></div>
                    </td>
                    <td><BatchStatusBadge status={b.status} /></td>
                    <td><button type="button" className="btn btn-secondary btn-sm" onClick={() => openBatch(b.batchId)}>View packs</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
