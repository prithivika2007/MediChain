// What is written inside every QR code: {"packId":"...","signature":"..."}
// The manufacturer portal writes it, the verification page reads it.
export function encodeQrPayload(packId, signature) {
  return JSON.stringify({ packId, signature });
}

// Accepts either the JSON above or a plain Pack ID typed by hand.
export function parseQrPayload(text) {
  const raw = String(text || '').trim();
  if (raw.startsWith('{')) {
    try {
      const obj = JSON.parse(raw);
      if (obj && obj.packId) {
        return {
          packId: String(obj.packId).trim().toUpperCase(),
          signature: obj.signature ? String(obj.signature).trim() : null, // keep exactly as printed: real signatures are case-sensitive
        };
      }
    } catch {
      /* not JSON: fall through and treat it as a plain Pack ID */
    }
  }
  return { packId: raw.toUpperCase(), signature: null };
}
