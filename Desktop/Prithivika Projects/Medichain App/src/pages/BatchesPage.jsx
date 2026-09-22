// Admin: all batches (from every manufacturer) and the recall button.
import { useState } from 'react';
import { api } from '../api/index.js';
import { useApiData } from '../hooks/useApiData.js';
import { useToast } from '../components/Toast.jsx';
import { LoadingCard, ErrorCard } from '../components/StateViews.jsx';
import { BatchStatusBadge, ExpiryBadge } from '../components/Badges.jsx';
import { displayName } from '../logic/batchUtils.js';
import { formatDate, formatDateTime } from '../utils/dateUtils.js';

export default function BatchesPage() {
  const showToast = useToast();
  const batchesQ = useApiData(() => api.listBatches(), []);
  const [busyId, setBusyId] = useState(null); // the batch being recalled right now

  const onRecall = async (b) => {
    const ok = window.confirm(`Recall batch ${b.batchId} (${displayName(b)})?\n\nAll ${b.packCount} packs in this batch will show "RECALLED — DO NOT USE" when scanned, and no more transfers can be recorded.`);
    if (!ok) return;
    setBusyId(b.batchId);
    try {
      await api.recallBatch(b.batchId);
      showToast(`Batch ${b.batchId} recalled. Scanning any of its packs now shows RECALLED.`);
      batchesQ.reload();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  // Demo only: lets you repeat the recall demo. A real system would not un-recall a batch.
  const onRestore = async (b) => {
    setBusyId(b.batchId);
    try {
      await api.demo.undoRecall(b.batchId);
      showToast(`Recall of batch ${b.batchId} undone.`);
      batchesQ.reload();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const batches = batchesQ.data || [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Batches and recall</h1>
          <p className="subtitle">Recalling a batch affects every pack in it straight away.</p>
        </div>
      </div>

      {batchesQ.loading && !batchesQ.data && <LoadingCard label="Loading batches…" />}
      {batchesQ.error && !batchesQ.data && <ErrorCard error={batchesQ.error} onRetry={batchesQ.reload} />}

      {batchesQ.data && (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Batch</th><th>Medicine</th><th>Manufacturer</th><th>Packs</th><th>Expiry</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const recalled = b.status === 'RECALLED';
                  return (
                    <tr key={b.batchId}>
                      <td><strong>{b.batchId}</strong></td>
                      <td>{displayName(b)}</td>
                      <td>{b.manufacturer}</td>
                      <td>{b.packCount}</td>
                      <td>
                        {formatDate(b.expiry)}
                        <div><ExpiryBadge expiry={b.expiry} /></div>
                      </td>
                      <td>
                        <BatchStatusBadge status={b.status} />
                        {recalled && b.recalledAt && <div className="muted small">{formatDateTime(b.recalledAt)}</div>}
                      </td>
                      <td>
                        {recalled ? (
                          api.demo && <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === b.batchId} onClick={() => onRestore(b)}>Undo recall (demo)</button>
                        ) : (
                          <button type="button" className="btn btn-danger btn-sm" disabled={busyId === b.batchId} onClick={() => onRecall(b)}>Recall {b.batchId}</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
