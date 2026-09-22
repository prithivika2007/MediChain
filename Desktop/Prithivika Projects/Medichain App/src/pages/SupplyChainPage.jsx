// Supply chain tracking: record hand-offs and see where every pack is.
// Manufacturers can record transfers for their own batches. Admins can view every batch.
// The server keeps the "holder" of every pack and checks every transfer.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/index.js';
import { useApiData } from '../hooks/useApiData.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { LoadingCard, ErrorCard } from '../components/StateViews.jsx';
import { BatchStatusBadge, ExpiryBadge } from '../components/Badges.jsx';
import { LOCATION_NAMES } from '../data/locations.js';
import { displayName } from '../logic/batchUtils.js';
import { STAGES, countByHolder, packStatusLabel } from '../logic/supplyChain.js';
import { formatDate, formatDateTime, toDateTimeLocal } from '../utils/dateUtils.js';

const SHOW_ROWS = 50;

export default function SupplyChainPage() {
  const { user } = useAuth();
  const showToast = useToast();
  const canRecord = user.role === 'manufacturer';

  const [selectedId, setSelectedId] = useState(null);
  const [fromStage, setFromStage] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [location, setLocation] = useState('');
  const [when, setWhen] = useState(() => toDateTimeLocal());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [stageFilter, setStageFilter] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [packSearch, setPackSearch] = useState('');
  const [showAllPacks, setShowAllPacks] = useState(false);

  const batchesQ = useApiData(() => api.listBatches(), []);
  const batches = batchesQ.data || [];
  const batch = batches.find((b) => b.batchId === selectedId) || batches[0] || null;
  const batchId = batch ? batch.batchId : null;

  // Packs (with their current holder) and transfers of the selected batch.
  const detailQ = useApiData(
    () => (batchId ? Promise.all([api.listPacks(batchId), api.listTransfers(batchId)]).then(([packs, transfers]) => ({ packs, transfers })) : Promise.resolve(null)),
    [batchId]
  );

  if (batchesQ.loading && !batchesQ.data) return <div className="page"><h1>Supply chain tracking</h1><LoadingCard label="Loading batches…" /></div>;
  if (batchesQ.error && !batchesQ.data) return <div className="page"><h1>Supply chain tracking</h1><ErrorCard error={batchesQ.error} onRetry={batchesQ.reload} /></div>;
  if (!batch) {
    return (
      <div className="page">
        <h1>Supply chain tracking</h1>
        <div className="card">
          <p className="muted">There are no batches to track yet.</p>
          {canRecord && <Link to="/manufacturer" className="btn btn-primary">Register a batch</Link>}
        </div>
      </div>
    );
  }

  const detail = detailQ.data;
  const packs = detail ? detail.packs : [];
  const transfers = detail ? [...detail.transfers].sort((a, b) => b.timestamp - a.timestamp) : [];
  const counts = countByHolder(packs);
  const recalled = batch.status === 'RECALLED';
  const movable = STAGES.slice(0, -1).filter((s) => counts[s] > 0);
  const from = movable.includes(fromStage) ? fromStage : movable[0];
  const to = from ? STAGES[STAGES.indexOf(from) + 1] : '';
  const available = from ? counts[from] : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createTransfer(batchId, {
        from, to, quantity: Number(quantity), location: location.trim(),
        timestamp: new Date(when).getTime(), notes: notes.trim(),
      });
      showToast(`Transfer recorded: ${quantity} pack${Number(quantity) === 1 ? '' : 's'} from ${from} to ${to}.`);
      setNotes('');
      setQuantity('1');
      setWhen(toDateTimeLocal());
      detailQ.reload();
      batchesQ.reload();
    } catch (err) {
      setError(err.message); // the server checks the rules, for example "Quantity must be between 1 and 30"
    } finally {
      setSaving(false);
    }
  };

  const search = locationSearch.trim().toLowerCase();
  const history = transfers.filter((t) =>
    (!stageFilter || t.from === stageFilter || t.to === stageFilter) &&
    (!search || t.location.toLowerCase().includes(search))
  );

  const packQuery = packSearch.trim().toUpperCase();
  const packRows = packs.filter((p) => !packQuery || p.packId.includes(packQuery));
  const shownPackRows = showAllPacks ? packRows : packRows.slice(0, SHOW_ROWS);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Supply chain tracking</h1>
          <p className="subtitle">Follow every hand-off from manufacturer to retailer.</p>
        </div>
      </div>

      <section className="card">
        <h2>Select a batch</h2>
        <select className="input batch-select" value={batchId} onChange={(e) => { setSelectedId(e.target.value); setShowAllPacks(false); setPackSearch(''); setError(''); }} aria-label="Batch">
          {batches.map((b) => (
            <option key={b.batchId} value={b.batchId}>{b.batchId}: {displayName(b)}</option>
          ))}
        </select>

        <dl className="summary-grid">
          <div><dt>Medicine</dt><dd>{displayName(batch)}</dd></div>
          <div><dt>Manufacturer</dt><dd>{batch.manufacturer}</dd></div>
          <div><dt>Packs in batch</dt><dd>{batch.packCount}</dd></div>
          <div><dt>Expiry</dt><dd>{formatDate(batch.expiry)} <ExpiryBadge expiry={batch.expiry} /></dd></div>
          <div><dt>Batch status</dt><dd><BatchStatusBadge status={batch.status} /></dd></div>
        </dl>
      </section>

      {detailQ.loading && !detail && <LoadingCard label="Loading this batch…" />}
      {detailQ.error && !detail && <ErrorCard error={detailQ.error} onRetry={detailQ.reload} />}

      {detail && (
        <>
          <section className="card">
            <h2>Where the packs are now</h2>
            <div className="journey">
              {STAGES.map((stage, i) => {
                const lastIn = transfers.find((t) => t.to === stage); // newest hand-off into this stage
                const n = counts[stage];
                return (
                  <div key={stage} className="journey-step">
                    <div className={`stage ${n > 0 ? 'has-packs' : ''}`}>
                      <div className="stage-name">{stage}</div>
                      <div className="stage-count">{n}</div>
                      <div className="stage-detail">
                        {i === 0 ? 'Batch created' : lastIn ? `Last received in ${lastIn.location}` : 'Nothing received yet'}
                      </div>
                    </div>
                    {i < STAGES.length - 1 && <div className="journey-arrow" aria-hidden="true">→</div>}
                  </div>
                );
              })}
            </div>
          </section>

          {canRecord && (
            <section className="card">
              <h2>Record a transfer</h2>
              {recalled ? (
                <p className="notice notice-bad">Batch {batch.batchId} has been recalled, so no more transfers can be recorded.</p>
              ) : movable.length === 0 ? (
                <p className="notice">Every pack in this batch has reached a retailer. There is nothing left to transfer.</p>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="form-grid">
                    <label className="field">
                      <span>From</span>
                      <select className="input" value={from} onChange={(e) => setFromStage(e.target.value)}>
                        {movable.map((s) => <option key={s} value={s}>{s} ({counts[s]} pack{counts[s] === 1 ? '' : 's'})</option>)}
                      </select>
                    </label>
                    <label className="field">
                      <span>To</span>
                      <input className="input" value={to} readOnly />
                    </label>
                    <label className="field">
                      <span>Number of packs</span>
                      <input className="input" type="number" min="1" max={available} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                      <small className="hint">{available} available at {from}.</small>
                    </label>
                    <label className="field">
                      <span>Location</span>
                      <input className="input" list="location-options" value={location} onChange={(e) => setLocation(e.target.value)} required placeholder="For example Chennai" />
                      <datalist id="location-options">{LOCATION_NAMES.map((c) => <option key={c} value={c} />)}</datalist>
                    </label>
                    <label className="field">
                      <span>Date and time</span>
                      <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
                    </label>
                    <label className="field">
                      <span>Reference or notes (optional)</span>
                      <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </label>
                  </div>
                  {error && <p className="error-text" role="alert">{error}</p>}
                  <button type="submit" className="btn btn-primary btn-lg form-submit" disabled={saving}>{saving ? 'Recording…' : 'Record transfer'}</button>
                </form>
              )}
            </section>
          )}

          <section className="card">
            <div className="results-head">
              <div>
                <h2>Transfer history</h2>
                <p className="muted">Every recorded hand-off for this batch, newest first.</p>
              </div>
              <div className="filters">
                <select className="input" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} aria-label="Filter by stage">
                  <option value="">All stages</option>
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input className="input" type="search" placeholder="Search location" value={locationSearch} onChange={(e) => setLocationSearch(e.target.value)} />
              </div>
            </div>
            {history.length === 0 ? (
              <p className="muted">No transfers match. {transfers.length === 0 && 'This batch is still with the manufacturer.'}</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Date and time</th><th>From</th><th>To</th><th>Packs</th><th>Location</th><th>Notes</th></tr>
                  </thead>
                  <tbody>
                    {history.map((t) => (
                      <tr key={t.id}>
                        <td>{formatDateTime(t.timestamp)}</td>
                        <td>{t.from}</td>
                        <td>{t.to}</td>
                        <td>{t.quantity}</td>
                        <td>{t.location}</td>
                        <td className="muted">{t.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <div className="results-head">
              <div>
                <h2>Pack status</h2>
                <p className="muted">Who holds each pack right now.</p>
              </div>
              <input className="input filter-input" type="search" placeholder="Search Pack ID" value={packSearch} onChange={(e) => { setPackSearch(e.target.value); setShowAllPacks(false); }} />
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Pack ID</th><th>Medicine</th><th>Current holder</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {shownPackRows.map((pack) => {
                    const stageIndex = STAGES.indexOf(pack.holder);
                    return (
                      <tr key={pack.packId}>
                        <td><strong>{pack.packId}</strong></td>
                        <td>{displayName(batch)}</td>
                        <td>{pack.holder}</td>
                        <td><span className={`badge ${recalled ? 'status-RECALLED' : stageIndex === 3 ? 'status-GENUINE' : stageIndex === 0 ? 'status-ALREADY_USED' : 'status-EXPIRED'}`}>{packStatusLabel(pack.holder, recalled)}</span></td>
                      </tr>
                    );
                  })}
                  {shownPackRows.length === 0 && <tr><td colSpan="4" className="muted">No packs match that search.</td></tr>}
                </tbody>
              </table>
            </div>
            {packRows.length > SHOW_ROWS && (
              <button type="button" className="btn btn-secondary btn-sm table-more" onClick={() => setShowAllPacks((v) => !v)}>
                {showAllPacks ? `Show first ${SHOW_ROWS}` : `Show all ${packRows.length} packs`}
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
