// Public page (mobile-first): "Medicine Verification". No login needed.
import { useState } from 'react';
import { api } from '../api/index.js';
import QRScanner from '../components/QRScanner.jsx';
import ResultCard from '../components/ResultCard.jsx';
import { LOCATION_NAMES } from '../data/locations.js';
import { parseQrPayload } from '../logic/qrPayload.js';
import { DEFAULT_LOCATION } from '../config.js';

export default function VerifyPage() {
  const [packId, setPackId] = useState('');
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Used by the Verify button, the QR scanner and the demo shortcuts.
  // "text" is either a plain Pack ID or the JSON inside a MediChain QR code.
  const runVerify = async (text, forcedSignature = null) => {
    const parsed = parseQrPayload(text);
    if (!parsed.packId) {
      setError('Enter a Pack ID first.');
      return;
    }
    setError('');
    setScanning(false);
    setBusy(true);
    try {
      const scan = await api.verify({ packId: parsed.packId, signature: forcedSignature || parsed.signature, location });
      setPackId(scan.packId);
      setResult(scan);
    } catch (err) {
      setResult(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runVerify(packId);
  };

  return (
    <div className="page page-narrow">
      <h1>Medicine Verification</h1>
      <p className="subtitle">Scan the QR code on your medicine pack, or type the Pack ID printed on it.</p>

      <div className="card">
        {scanning ? (
          <QRScanner onScan={runVerify} onClose={() => setScanning(false)} />
        ) : (
          <button type="button" className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={() => { setResult(null); setScanning(true); }}>
            Scan QR code
          </button>
        )}

        <div className="divider"><span>or</span></div>

        <form onSubmit={handleSubmit}>
          <label className="field" htmlFor="packId">
            <span>Enter Pack ID</span>
            <input
              id="packId"
              className="input"
              value={packId}
              placeholder="For example PK001"
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => setPackId(e.target.value)}
            />
          </label>

          <label className="field" htmlFor="location">
            <span>Scan location (simulated)</span>
            <select id="location" className="input" value={location} onChange={(e) => setLocation(e.target.value)}>
              {LOCATION_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          {error && <p className="error-text" role="alert">{error}</p>}

          <button type="submit" className="btn btn-dark btn-block btn-lg" disabled={busy}>{busy ? 'Verifying…' : 'Verify'}</button>
        </form>
      </div>

      {result && <ResultCard scan={result} />}

      {api.demo && (
        <details className="card demo-box">
          <summary>Demo shortcuts for presentations</summary>
          <p className="muted small">Each button verifies that pack from the location selected above. Pack IDs made in the manufacturer portal work too.</p>
          <div className="chips">
            {api.demo.testCases.map((t) => (
              <button key={t.label || t.packId} type="button" className="chip" title={t.note} disabled={busy} onClick={() => runVerify(t.packId, t.signature)}>
                {t.label || t.packId}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
