// Public customer-facing Keshless Tickets site (where buyers browse + buy).
// Used by the auth pages' top bar to let organizers get back to the landing
// page. Override per-environment via VITE_LANDING_URL if needed.
export const LANDING_URL = import.meta.env.VITE_LANDING_URL || 'https://tickets.keshless.com';

export interface Country {
  name: string;
  code: string;
  flag: string;
}

export const SADC_COUNTRIES: Country[] = [
  { name: 'South Africa', code: '+27', flag: '🇿🇦' },
  { name: 'Mauritius', code: '+230', flag: '🇲🇺' },
  { name: 'Democratic Republic of Congo', code: '+243', flag: '🇨🇩' },
  { name: 'Angola', code: '+244', flag: '🇦🇴' },
  { name: 'Seychelles', code: '+248', flag: '🇸🇨' },
  { name: 'Tanzania', code: '+255', flag: '🇹🇿' },
  { name: 'Mozambique', code: '+258', flag: '🇲🇿' },
  { name: 'Zambia', code: '+260', flag: '🇿🇲' },
  { name: 'Madagascar', code: '+261', flag: '🇲🇬' },
  { name: 'Zimbabwe', code: '+263', flag: '🇿🇼' },
  { name: 'Namibia', code: '+264', flag: '🇳🇦' },
  { name: 'Malawi', code: '+265', flag: '🇲🇼' },
  { name: 'Lesotho', code: '+266', flag: '🇱🇸' },
  { name: 'Botswana', code: '+267', flag: '🇧🇼' },
  { name: 'Eswatini', code: '+268', flag: '🇸🇿' },
  { name: 'Comoros', code: '+269', flag: '🇰🇲' },
];

// Default country (Eswatini)
export const DEFAULT_COUNTRY = SADC_COUNTRIES.find(c => c.code === '+268') || SADC_COUNTRIES[0];
