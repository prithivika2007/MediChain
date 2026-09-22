// Wrap a page in <RequireRole roles={['admin']}> to keep everyone else out.
// Not signed in -> back to the login page. Wrong role -> back to their own home page.
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { ROLE_HOME } from './roles.js';

export default function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/" replace state={{ notice: 'Sign in with a staff account to open that page.' }} />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }
  return children;
}
