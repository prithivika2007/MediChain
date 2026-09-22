// ---------------------------------------------------------------
// MOCK USERS (server side). NOT real security: passwords sit in plain text.
// The real backend needs real logins (hashed passwords) and the same three roles.
// ---------------------------------------------------------------
export const USERS = [
  { username: 'admin',     password: 'admin123',  role: 'admin',        name: 'Regulator Admin',         org: null },
  { username: 'abcpharma', password: 'pharma123', role: 'manufacturer', name: 'ABC Pharma',              org: 'ABC Pharma' },
  { username: 'sunrise',   password: 'pharma123', role: 'manufacturer', name: 'Sunrise Pharmaceuticals', org: 'Sunrise Pharmaceuticals' },
];
