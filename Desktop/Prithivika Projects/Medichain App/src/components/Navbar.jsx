// Top bar. The links shown depend on who is signed in.
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABEL, ROLE_HOME } from '../auth/roles.js';
import { api } from '../api/index.js';

const LINKS = {
  manufacturer: [
    { to: '/manufacturer', label: 'Register batch' },
    { to: '/supply-chain', label: 'Supply chain' },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/batches', label: 'Batches & recall' },
    { to: '/supply-chain', label: 'Supply chain' },
    { to: '/admin/qr-codes', label: 'Test QR codes', demoOnly: true },
  ],
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const cls = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');
  // "demoOnly" links only make sense with the demo backend (api.demo exists)
  const links = user ? LINKS[user.role].filter((l) => !l.demoOnly || api.demo) : [];

  const onLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="navbar">
      <Link to={user ? ROLE_HOME[user.role] : '/'} className="brand">
        <span className="brand-mark" aria-hidden="true">✚</span>
        Medi<span className="brand-chain">Chain</span>
      </Link>

      <nav className="nav-links" aria-label="Main">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={cls}>{l.label}</NavLink>
        ))}
        <NavLink to="/verify" className={cls}>Verify medicine</NavLink>
      </nav>

      <div className="nav-user">
        {user ? (
          <>
            <span className="user-chip">
              <strong>{user.name}</strong>
              <span className="role-tag">{ROLE_LABEL[user.role]}</span>
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onLogout}>Sign out</button>
          </>
        ) : (
          <Link to="/" className="btn btn-ghost btn-sm">Staff sign in</Link>
        )}
      </div>
    </header>
  );
}
