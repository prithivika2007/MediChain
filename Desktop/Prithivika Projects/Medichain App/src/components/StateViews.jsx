// What a screen shows while it waits for the server, or when the server said no.
export function LoadingCard({ label = 'Loading…' }) {
  return (
    <div className="card state-card" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorCard({ error, onRetry }) {
  return (
    <div className="card state-card state-error" role="alert">
      <div>
        <strong>Could not load this.</strong>
        <div>{error?.message || 'Something went wrong.'}</div>
      </div>
      {onRetry && <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}
