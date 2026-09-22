// Settings read from the .env files (see .env.example). All optional.
//   VITE_API_MODE      "mock" (default: everything runs in the browser) or "http" (real backend)
//   VITE_API_BASE_URL  where the backend lives when the mode is "http". Default "/api"
//   VITE_MOCK_LATENCY  fake delay in ms for the mock, so loading states are visible. Default 250
//   VITE_POLL_MS       how often (ms) live pages refresh in http mode. 0 turns polling off. Default 10000
export const API_MODE = import.meta.env.VITE_API_MODE || 'mock';
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export const MOCK_LATENCY_MS = Number(import.meta.env.VITE_MOCK_LATENCY ?? 250);
export const POLL_MS = Number(import.meta.env.VITE_POLL_MS ?? 10000);
