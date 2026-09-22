// Verification rule settings. The real backend must use the same numbers (see API_CONTRACT.md).
export const HIGH_SCAN_THRESHOLD = 20;      // this many scans (or more) of one pack = suspicious
export const MAX_REALISTIC_SPEED_KMH = 500; // faster than this between two scans is impossible
export const MIN_DISTANCE_KM = 100;         // ignore tiny distances (same region)
