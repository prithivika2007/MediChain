// Demo-only cheat-sheet: used by the "Demo shortcuts" buttons and the Test QR codes page.
// The real backend does not need this file.
// signature: only for the "forged QR" example (everything else uses the pack's real signature).
export const TEST_CASES = [
  { packId: 'PK001', expected: 'GENUINE',      note: 'Normal genuine pack. Scan from Chennai, then Mumbai to trigger the travel rule.' },
  { packId: 'PK002', expected: 'SUSPICIOUS',   note: 'History already has Chennai → Mumbai 15 minutes apart.' },
  { packId: 'PK003', expected: 'GENUINE',      note: 'Scanned 18 times already. The 20th scan becomes suspicious.' },
  { packId: 'PK004', expected: 'GENUINE',      note: 'Genuine, but shows an expiry warning (expires in 18 days).' },
  { packId: 'PK005', expected: 'ALREADY_USED', note: 'Marked as already used.' },
  { packId: 'PK006', expected: 'GENUINE',      note: 'Batch B003. Recall B003 on the admin page, then scan again.' },
  { packId: 'PK009', expected: 'RECALLED',     note: 'Batch B004 is recalled from the start.' },
  { packId: 'PK011', expected: 'EXPIRED',      note: 'Expired 90 days ago.' },
  { packId: 'PK014', expected: 'SUSPICIOUS',   note: 'Reported earlier as a cloned pack.' },
  { packId: 'FAKE-9999', expected: 'SUSPICIOUS', note: 'Not in the registry at all.' },
  { packId: 'PK013', signature: 'FORGED00', label: 'PK013 (forged QR)', expected: 'SUSPICIOUS', note: 'Real Pack ID, but the QR carries a wrong digital signature.' },
];
