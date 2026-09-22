// The ONE place screens get their data from:   import { api } from '../api/index.js'
// Both versions have exactly the same methods, so switching is a settings change, not a code change.
import { API_MODE } from './env.js';
import { httpApi } from './httpApi.js';
import { mockApi } from '../mock/mockApi.js';

export const api = API_MODE === 'http' ? httpApi : mockApi;
