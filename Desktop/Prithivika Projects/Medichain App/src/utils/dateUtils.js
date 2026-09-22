// Small helpers for working with dates. No libraries needed.
const DAY_MS = 24 * 60 * 60 * 1000;

export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// "2026-10-09" style date, n days from today (n can be negative).
export function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

// Value for <input type="datetime-local">, in the user's own time zone.
export function toDateTimeLocal(ms = Date.now()) {
  const d = new Date(ms);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// How many days are left until the expiry date? Negative = already expired.
// A pack is valid until the END of its expiry day.
export function daysUntil(isoDate, nowMs = Date.now()) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const endOfExpiryDay = new Date(y, m - 1, d, 23, 59, 59).getTime();
  return Math.floor((endOfExpiryDay - nowMs) / DAY_MS);
}

export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function formatDateTime(ms) {
  return new Date(ms).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function formatDateTimeFull(ms) {
  return new Date(ms).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
}

export function formatDuration(minutes) {
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
