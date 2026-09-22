// Small coloured labels used on several pages (so they always look the same).
import { STATUS } from '../utils/statusConfig.js';
import { expiryState } from '../logic/batchUtils.js';

// Verification result: Genuine, Suspicious, Expired, Recalled, Already used
export function StatusBadge({ result }) {
  const s = STATUS[result];
  return <span className={`badge status-${result}`}>{s ? s.label : result}</span>;
}

// Batch state: Active or Recalled
export function BatchStatusBadge({ status }) {
  const recalled = status === 'RECALLED';
  return <span className={`badge ${recalled ? 'status-RECALLED' : 'status-GENUINE'}`}>{recalled ? 'Recalled' : 'Active'}</span>;
}

// Shows nothing for a healthy batch; otherwise "Expired 90 days ago" / "Expires in 18 days"
export function ExpiryBadge({ expiry }) {
  const { daysLeft, state } = expiryState(expiry);
  if (state === 'OK') return null;
  if (state === 'EXPIRED') {
    return <span className="badge status-EXPIRED">Expired {Math.abs(daysLeft)} day{Math.abs(daysLeft) === 1 ? '' : 's'} ago</span>;
  }
  return <span className="badge status-SUSPICIOUS">{daysLeft === 0 ? 'Expires today' : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}</span>;
}
