// MOCK digital signature. It only imitates the idea:
// "each pack carries a code that only the manufacturer's system can produce".
// Track A replaces this with a real cryptographic signature (e.g. RSA/ECDSA).
export function makeSignature(packId, mfgDate) {
  const str = packId + mfgDate;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}
