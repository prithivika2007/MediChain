// ---------------------------------------------------------------
// Who is signed in. Asks the API to log in, keeps the token (in localStorage) and the user.
// If any API call later answers "401 not signed in", the user is signed out here.
// ---------------------------------------------------------------
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { setToken, onUnauthorized } from '../api/session.js';
import { useToast } from '../components/Toast.jsx';

const SESSION_KEY = 'medichain_session_v3';

// { token, user } from localStorage. Also hands the token to the API layer.
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const session = raw ? JSON.parse(raw) : null;
    setToken(session?.token);
    return session;
  } catch {
    return null;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const showToast = useToast();
  const [session, setSession] = useState(loadSession);

  // Signing out (or in) in one tab updates the other tabs too.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === SESSION_KEY) setSession(loadSession()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // The server said "not signed in" (for example the token expired).
  useEffect(() => onUnauthorized(() => {
    localStorage.removeItem(SESSION_KEY);
    setToken(null);
    setSession(null);
    showToast('Your session ended. Please sign in again.', 'error');
  }), [showToast]);

  // Throws an ApiError when the username or password is wrong.
  const login = useCallback(async (username, password) => {
    const { token, user } = await api.login({ username: username.trim(), password });
    setToken(token);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
    setSession({ token, user });
    return user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setToken(null);
    setSession(null);
  }, []);

  return <AuthContext.Provider value={{ user: session ? session.user : null, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
