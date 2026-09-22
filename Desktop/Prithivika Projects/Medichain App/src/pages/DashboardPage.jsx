// Admin dashboard: numbers, alerts, expiry watch, supply chain snapshot, charts.
// Loads two lists through the API (batches and recent scans) and works everything else out from them.
import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { api } from '../api/index.js';
import { useApiData } from '../hooks/useApiData.js';
import { useToast } from '../components/Toast.jsx';
import StatCard from '../components/StatCard.jsx';
import { LoadingCard, ErrorCard } from '../components/StateViews.jsx';
import { StatusBadge } from '../components/Badges.jsx';
import { STATUS } from '../utils/statusConfig.js';
import { buildScanAlerts, buildExpiryWatch, buildStageTotals } from '../logic/alerts.js';
import { STAGES } from '../logic/supplyChain.js';
import { formatDate, formatDateTime } from '../utils/dateUtils.js';

const DAY = 24 * 60 * 60 * 1000;

export default function DashboardPage() {
  const showToast = useToast();
  const batchesQ = useApiData(() => api.listBatches(), []);
  const scansQ = useApiData(() => api.listScans({ limit: 500 }), []);
  const batches = batchesQ.data || [];
  const scans = scansQ.data || [];
  const totalPacks = batches.reduce((sum, b) => sum + b.packCount, 0);

  // Count results
  const counts = useMemo(() => {
    const c = { GENUINE: 0, SUSPICIOUS: 0, EXPIRED: 0, RECALLED: 0, ALREADY_USED: 0 };
    scans.forEach((s) => { c[s.result] = (c[s.result] || 0) + 1; });
    return c;
  }, [scans]);

  const pieData = Object.keys(STATUS)
    .map((k) => ({ name: STATUS[k].label, value: counts[k], color: STATUS[k].color }))
    .filter((d) => d.value > 0);

  // Verifications per day for the last 7 days
  const daily = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);
      days.push({
        label: start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
        start: start.getTime(),
        end: start.getTime() + DAY,
        verifications: 0,
      });
    }
    scans.forEach((s) => {
      const d = days.find((x) => s.timestamp >= x.start && s.timestamp < x.end);
      if (d) d.verifications += 1;
    });
    return days;
  }, [scans]);

  // Suspicious scans per city
  const suspiciousByCity = useMemo(() => {
    const map = {};
    scans.filter((s) => s.result === 'SUSPICIOUS').forEach((s) => { map[s.location] = (map[s.location] || 0) + 1; });
    return Object.entries(map).map(([location, count]) => ({ location, count })).sort((a, b) => b.count - a.count);
  }, [scans]);

  const alerts = useMemo(() => buildScanAlerts(scans), [scans]);
  const expiryWatch = useMemo(() => buildExpiryWatch(batches), [batches]);
  const stageTotals = useMemo(() => buildStageTotals(batches), [batches]);

  const onReset = async () => {
    const ok = window.confirm('Reset the whole demo? This removes all scans, recalls, transfers and any batches made in the manufacturer portal.');
    if (!ok) return;
    try {
      await api.demo.reset();
      batchesQ.reload();
      scansQ.reload();
      showToast('Demo data reset to the starting state.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if ((batchesQ.loading && !batchesQ.data) || (scansQ.loading && !scansQ.data)) {
    return <div className="page"><h1>Admin dashboard</h1><LoadingCard label="Loading the dashboard…" /></div>;
  }
  const failed = (batchesQ.error && !batchesQ.data) || (scansQ.error && !scansQ.data);
  if (failed) {
    return (
      <div className="page">
        <h1>Admin dashboard</h1>
        <ErrorCard error={batchesQ.error || scansQ.error} onRetry={() => { batchesQ.reload(); scansQ.reload(); }} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Admin dashboard</h1>
          <p className="subtitle">Refreshes by itself when packs are verified or batches change.</p>
        </div>
        {api.demo && <button type="button" className="btn btn-secondary" onClick={onReset}>Reset demo data</button>}
      </div>

      <section className="stats-grid">
        <StatCard label="Total packs" value={totalPacks} />
        <StatCard label="Total verifications" value={scans.length} />
        <StatCard label="Genuine" value={counts.GENUINE} color={STATUS.GENUINE.color} />
        <StatCard label="Suspicious" value={counts.SUSPICIOUS} color={STATUS.SUSPICIOUS.color} />
        <StatCard label="Expired" value={counts.EXPIRED} color={STATUS.EXPIRED.color} />
        <StatCard label="Recalled" value={counts.RECALLED} color={STATUS.RECALLED.color} />
      </section>

      <section className="grid-2">
        <div className="card">
          <h3>Alerts <span className="count-pill">{alerts.length}</span></h3>
          <div className="alert-list">
            {alerts.length === 0 && <p className="muted">No alerts yet. Alerts appear when a scan looks wrong.</p>}
            {alerts.map((a) => (
              <div key={a.key} className={`alert-item sev-${a.severity}`}>
                <div className="alert-top">
                  <span className={`sev-pill sev-${a.severity}`}>{a.severity}</span>
                  <strong>{a.title}</strong>
                  {a.count > 1 && <span className="muted small">{a.count} scans</span>}
                  <span className="muted small alert-time">{formatDateTime(a.timestamp)}</span>
                </div>
                <div className="alert-msg">{a.message}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>Expiry watch</h3>
            <p className="muted small">Batches that are expired or expire within 30 days, and who holds the packs.</p>
            {expiryWatch.length === 0 && <p className="muted">No batches are close to expiry.</p>}
            {expiryWatch.map((b) => (
              <div key={b.batchId} className="expiry-item">
                <div>
                  <strong>{b.batchId}</strong> {b.medicine}
                  <div className="muted small">Expires {formatDate(b.expiry)}. Held by {b.heldBy || 'no one yet'}.</div>
                </div>
                <span className={`badge ${b.state === 'EXPIRED' ? 'status-EXPIRED' : 'status-SUSPICIOUS'}`}>
                  {b.state === 'EXPIRED' ? `Expired ${Math.abs(b.daysLeft)}d ago` : `${b.daysLeft} days left`}
                </span>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Packs by current holder</h3>
            <div className="holder-grid">
              {STAGES.map((s) => (
                <div key={s} className="holder-item">
                  <div className="holder-count">{stageTotals[s]}</div>
                  <div className="muted small">{s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid-3">
        <div className="card">
          <h3>Verification results</h3>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Daily verifications (last 7 days)</h3>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="verifications" name="Verifications" fill="#0E7C7B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Suspicious scans by location</h3>
          <div className="chart-box">
            {suspiciousByCity.length === 0 ? (
              <p className="muted">No suspicious scans yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={suspiciousByCity}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="location" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" name="Suspicious scans" fill={STATUS.SUSPICIOUS.color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h3>Recent verifications</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Pack ID</th><th>Medicine</th><th>Result</th><th>Time</th><th>Location</th></tr>
            </thead>
            <tbody>
              {scans.slice(0, 12).map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.packId}</strong></td>
                  <td>{s.medicine}</td>
                  <td><StatusBadge result={s.result} /></td>
                  <td>{formatDateTime(s.timestamp)}</td>
                  <td>{s.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
