// One place that defines how each verification result looks and reads.
export const STATUS = {
  GENUINE:      { label: 'Genuine',      title: '✓ Product Verified',                   message: 'This pack matches our records.',                           color: '#16a34a' },
  SUSPICIOUS:   { label: 'Suspicious',   title: '⚠ Suspicious Product',                 message: 'Do not use this medicine. Report it to your pharmacist.',  color: '#ea580c' },
  EXPIRED:      { label: 'Expired',      title: '⚠ Expired Product',                    message: 'This medicine is past its expiry date. Do not use it.',    color: '#ca8a04' },
  RECALLED:     { label: 'Recalled',     title: '⚠ RECALLED — DO NOT USE',              message: 'This batch has been recalled. Return it to the pharmacy.', color: '#dc2626' },
  ALREADY_USED: { label: 'Already used', title: '⚠ Already Verified / Previously Used', message: 'This pack was verified and used before.',                  color: '#2563eb' },
};
