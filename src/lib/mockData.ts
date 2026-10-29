import { Person, Settings, Vendor, Transaction, Flag, Stall, VendorAccount } from '@/types';

// Format date helper (YYYY-MM-DD)
export const getFormattedDate = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

export const INITIAL_SETTINGS: Settings = {
  id: 'current',
  event_name: 'ISB PGP Placements 2026',
  start_date: getFormattedDate(-1),
  end_date: getFormattedDate(5),
  campuses: ['Hyderabad', 'Mohali'],
  daily_ceiling: 800,
  slot_caps: {
    breakfast: 150,
    lunch: 250,
    snacks: 100,
    beverages: 50,
    dinner: 250,
  },
  slot_max_scans: {
    breakfast: 1,
    lunch: 1,
    snacks: 2,
    beverages: 2,
    dinner: 1,
  },
  flag_anomaly_pct: 30,
  frequent_scan_window_mins: 10,
  updated_at: new Date().toISOString(),
};

export const INITIAL_STALLS: Stall[] = [
  {
    id: 'stall-1',
    name: 'Main Dining Counter (Stall 1)',
    campus: 'Hyderabad',
    vendor_name: 'Blue Spring Catering',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'stall-2',
    name: 'Atrium Beverage & Snack Bar (Stall 2)',
    campus: 'Hyderabad',
    vendor_name: 'Blue Spring Express',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'stall-3',
    name: 'Executive Lounge (Stall 3)',
    campus: 'Mohali',
    vendor_name: 'Blue Spring Catering',
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export const INITIAL_VENDOR_ACCOUNTS: VendorAccount[] = [
  {
    id: 'acc-admin',
    username: 'admin',
    password: 'CAS@960387',
    name: 'CAS Placement Operations',
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'acc-bluespring',
    username: 'bluespring',
    password: 'BlueSpring@2026',
    name: 'Blue Spring Operations Manager',
    role: 'vendor',
    campus: 'Hyderabad',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'acc-cashier-1',
    username: 'cashier1',
    password: 'Cashier@123',
    name: 'Cashier - Main Dining',
    role: 'cashier',
    stall_name: 'Main Dining Counter (Stall 1)',
    campus: 'Hyderabad',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'acc-cashier-2',
    username: 'cashier2',
    password: 'Cashier@123',
    name: 'Cashier - Atrium Cafe',
    role: 'cashier',
    stall_name: 'Atrium Beverage & Snack Bar (Stall 2)',
    campus: 'Hyderabad',
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export const INITIAL_VENDORS: Vendor[] = [
  {
    id: 'vendor-1',
    username: 'bluespring',
    name: 'Blue Spring Catering',
    stall_name: 'Main Dining Counter (Stall 1)',
    role: 'vendor',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'vendor-2',
    username: 'bluespring_cafe',
    name: 'Blue Spring Express',
    stall_name: 'Atrium Beverage & Snack Bar (Stall 2)',
    role: 'vendor',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'admin-1',
    username: 'admin',
    name: 'ISB CAS Operations',
    stall_name: 'CAS Placement Command Center',
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export const INITIAL_PEOPLE: Person[] = [];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_FLAGS: Flag[] = [];


