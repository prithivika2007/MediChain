import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="page page-narrow">
      <div className="card">
        <h1>Page not found</h1>
        <p className="muted">That address does not exist in MediChain.</p>
        <Link to="/" className="btn btn-primary">Go to the start page</Link>
      </div>
    </div>
  );
}
