// Shared supply chain vocabulary. Every transfer moves packs one step forward:
// Manufacturer -> Distributor -> Wholesaler -> Retailer.
// The backend stores a "holder" on every pack. The screens only read it.
export const STAGES = ['Manufacturer', 'Distributor', 'Wholesaler', 'Retailer'];

// How many packs each stage holds. packs: [{ holder: 'Distributor', ... }]
export function countByHolder(packs) {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0]));
  packs.forEach((p) => { if (counts[p.holder] !== undefined) counts[p.holder] += 1; });
  return counts;
}

export function packStatusLabel(holder, batchRecalled) {
  if (batchRecalled) return 'Recalled';
  const i = STAGES.indexOf(holder);
  if (i === 0) return 'In stock';
  if (i === STAGES.length - 1) return 'Delivered';
  return 'In transit';
}
