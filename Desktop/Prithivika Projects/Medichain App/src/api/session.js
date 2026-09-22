// Holds the sign-in token for the API layer, and tells the app when the server says "not signed in".
let token = null;
const listeners = new Set();

export const getToken = () => token;
export const setToken = (value) => { token = value || null; };

// The app registers here to sign the user out when any call returns 401.
export function onUnauthorized(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
export function emitUnauthorized() {
  listeners.forEach((cb) => cb());
}
