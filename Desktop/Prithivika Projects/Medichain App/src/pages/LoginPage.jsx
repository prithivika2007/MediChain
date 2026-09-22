// Start page: mock sign-in for staff, and a way in for customers (no account needed).
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_HOME, ROLE_LABEL } from '../auth/roles.js';
import { api } from '../api/index.js';

const STEPS = [
  { title: 'Manufacturer', text: 'Registers a batch and prints a signed QR code on every pack.' },
  { title: 'Distributor and wholesaler', text: 'Pass the packs on. Each hand-off is recorded with place and time.' },
  { title: 'Retailer', text: 'Receives the packs and sells them.' },
  { title: 'Patient', text: 'Scans the QR code to check the pack is genuine, in date and not recalled.' },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(location.state?.notice || '');
  const [busy, setBusy] = useState(false);

  // Already signed in: go straight to your own home page.
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const signedIn = await login(username, password);
      navigate(ROLE_HOME[signedIn.role]);
    } catch (err) {
      setError(err.status === 401 ? 'That username and password do not match.' : err.message);
      setBusy(false);
    }
  };

  const fill = (u) => {
    setUsername(u.username);
    setPassword(u.password);
    setError('');
  };

  return (
    <div className="login-shell">
      <section className="login-story">
        <h1>Every pack accounted for, from factory to patient.</h1>
        <ol className="chain-steps">
          {STEPS.map((s) => (
            <li key={s.title} className="chain-step">
              <div className="chain-step-title">{s.title}</div>
              <div className="chain-step-text">{s.text}</div>
            </li>
          ))}
        </ol>
        <p className="story-foot">Regulators watch for recalls, expired stock and suspicious scans the whole way.</p>
      </section>

      <section className="login-panel">
        <div className="card login-card">
          <h2>Sign in</h2>
          <p className="muted">For manufacturers and regulators.</p>

          <form onSubmit={handleSubmit}>
            <label className="field">
              <span>Username</span>
              <input className="input" value={username} autoComplete="username" onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label className="field">
              <span>Password</span>
              <input className="input" type="password" value={password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {error && <p className="error-text" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>

          {api.demo && (
            <div className="demo-accounts">
              <h3>Demo accounts</h3>
              <p className="muted small">Demo only. These are not real logins. Select one to fill the form.</p>
              {api.demo.accounts.map((u) => (
                <button key={u.username} type="button" className="demo-row" onClick={() => fill(u)}>
                  <span>
                    <strong>{u.name}</strong>
                    <span className="muted small"> {ROLE_LABEL[u.role]}</span>
                  </span>
                  <span className="demo-cred">{u.username} / {u.password}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card customer-box">
          <h3>Checking a medicine you bought?</h3>
          <p className="muted">You do not need an account. Scan the QR code on the pack.</p>
          <Link to="/verify" className="btn btn-dark btn-block">Verify a medicine</Link>
        </div>
      </section>
    </div>
  );
}
