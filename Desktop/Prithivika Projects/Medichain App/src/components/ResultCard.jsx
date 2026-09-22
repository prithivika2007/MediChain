// Big coloured card that shows the verification result.
import { STATUS } from '../utils/statusConfig.js';
import { daysUntil, formatDate, formatDateTimeFull } from '../utils/dateUtils.js';

function expiryNote(daysLeft) {
  if (daysLeft == null) return '';
  if (daysLeft < 0) return ` (expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago)`;
  if (daysLeft === 0) return ' (expires today)';
  return ` (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)`;
}

export default function ResultCard({ scan }) {
  const s = STATUS[scan.result];
  const daysLeft = scan.expiry ? daysUntil(scan.expiry, scan.timestamp) : null;
  const expiryWarning = scan.reasons.find((r) => r.flag === 'EXPIRING_SOON');
  const otherReasons = scan.reasons.filter((r) => r.flag !== 'EXPIRING_SOON');
  // For a normal genuine pack there is nothing extra to explain
  const showReasons = otherReasons.length > 0 && scan.result !== 'GENUINE';

  return (
    <div className={`result-card status-${scan.result}`}>
      <div className="result-header">
        <h2>{s.title}</h2>
        <p>{s.message}</p>
      </div>

      {expiryWarning && (
        <div className="warning-banner">⏳ Expiry warning: {expiryWarning.text}</div>
      )}

      {showReasons && (
        <div className="reasons">
          <strong>Why?</strong>
          <ul>
            {otherReasons.map((r, i) => <li key={i}>{r.text}</li>)}
          </ul>
        </div>
      )}

      <dl className="details">
        <div><dt>Medicine</dt><dd>{scan.medicine}</dd></div>
        <div><dt>Batch number</dt><dd>{scan.batchId}</dd></div>
        <div><dt>Manufacturer</dt><dd>{scan.manufacturer}</dd></div>
        <div><dt>Expiry date</dt><dd>{scan.expiry ? formatDate(scan.expiry) + expiryNote(daysLeft) : '—'}</dd></div>
        {scan.packSize && <div><dt>Pack size</dt><dd>{scan.packSize}</dd></div>}
        {scan.mrp != null && <div><dt>Printed price (MRP)</dt><dd>₹{scan.mrp}</dd></div>}
        <div><dt>Pack ID</dt><dd>{scan.packId}</dd></div>
        {scan.signatureCheck && (
          <div>
            <dt>QR signature</dt>
            <dd className={scan.signatureCheck === 'VALID' ? 'text-ok' : 'text-bad'}>
              {scan.signatureCheck === 'VALID' ? 'Valid' : 'Does not match'}
            </dd>
          </div>
        )}
        <div><dt>Verification time</dt><dd>{formatDateTimeFull(scan.timestamp)}</dd></div>
        <div><dt>Scan location</dt><dd>{scan.location}</dd></div>
        <div><dt>Times scanned</dt><dd>{scan.scanNumber}</dd></div>
      </dl>
    </div>
  );
}
