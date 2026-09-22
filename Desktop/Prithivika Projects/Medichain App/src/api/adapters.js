// ---------------------------------------------------------------
// If the real backend names or shapes a field differently, fix it HERE, once.
// Every response from the HTTP backend passes through these functions before a screen sees it.
// (Right now they just make sure the fields the screens rely on exist.)
// ---------------------------------------------------------------
const ZERO_COUNTS = { Manufacturer: 0, Distributor: 0, Wholesaler: 0, Retailer: 0 };

export const toBatch = (raw) => ({
  ...raw,
  mrp: Number(raw.mrp),
  packCount: raw.packCount ?? 0,
  stageCounts: { ...ZERO_COUNTS, ...(raw.stageCounts || {}) },
});

export const toPack = (raw) => ({ ...raw });

export const toTransfer = (raw) => ({ ...raw, quantity: Number(raw.quantity), timestamp: Number(raw.timestamp) });

export const toScan = (raw) => ({
  ...raw,
  flags: raw.flags || [],
  reasons: raw.reasons || [],
  signatureCheck: raw.signatureCheck ?? null,
});
