export type MealSlot = 'breakfast' | 'lunch' | 'snacks' | 'beverages' | 'dinner';

export type UserRole =
  | 'Interview Coordinator'
  | 'Driver'
  | 'CAS Staff'
  | 'Student Volunteer'
  | 'Recruiter Host';

export type Campus = 'Hyderabad' | 'Mohali';

export interface Person {
  id: string;
  name: string;
  role: UserRole | string;
  token: string;
  short_code: string;
  access_code?: string;      // 4 to 10 chars, case-insensitive unique code
  phone?: string;
  email?: string;
  wallet_total: number;
  campus?: Campus | string;
  roster_date?: string;      // YYYY-MM-DD — active from this date
  active?: boolean;          // false = soft-deleted (spent but deactivated)
  created_at: string;
}

export interface Settings {
  id: string;
  event_name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  campuses?: string[];
  daily_ceiling: number;
  slot_caps: Record<MealSlot, number>;
  slot_max_scans: Record<MealSlot, number>;
  flag_anomaly_pct: number;
  frequent_scan_window_mins: number;
  updated_at: string;
}

export interface Stall {
  id: string;
  name: string;
  campus: string;
  stall_code: string;        // Code used by cashier to log in
  code_active: boolean;      // Whether this stall code is enabled
  vendor_id?: string;
  vendor_name?: string;
  is_active: boolean;
  created_at: string;
}

export type VendorAccountRole = 'admin' | 'vendor' | 'cashier';

export interface VendorAccount {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: VendorAccountRole;
  stall_id?: string;
  stall_name?: string;
  campus?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthSession {
  user: VendorAccount;
  token?: string;
  login_at: string;
}

export interface Vendor {
  id: string;
  username: string;
  password_hash?: string;
  name: string;
  stall_name: string;
  role: 'vendor' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  person_id: string;
  vendor_id?: string;
  vendor_name: string;
  stall_name: string;
  slot: MealSlot;
  amount: number;
  bill_no?: string;
  voided: boolean;
  void_reason?: string;
  voided_at?: string;
  voided_by?: string;
  created_at: string;
  person?: {
    name: string;
    role: string;
    short_code: string;
  };
}

export interface Flag {
  id: string;
  transaction_id: string;
  person_id: string;
  type: 'slot_cap_exact' | 'above_slot_avg' | 'frequent_scans' | 'user_flagged';
  reason: string;
  user_note?: string;
  resolved: boolean;
  resolved_at?: string;
  created_at: string;
  transaction?: Transaction;
  person?: Person;
}

export interface ScanResult {
  success: boolean;
  error?: string;
  transaction_id?: string;
  person_name?: string;
  person_role?: string;
  amount?: number;
  slot?: MealSlot;
  bill_no?: string;
  remaining_wallet?: number;
  remaining_daily_ceiling?: number;
  created_at?: string;
}

export interface DailyBillingRow {
  date: string;
  slot: string;
  vendor_name: string;
  stall_name: string;
  transaction_count: number;
  total_amount: number;
}

// ── Roster Upload ────────────────────────────────────────────────────────────

/** A single parsed row from the .xlsx roster file */
export interface RosterRow {
  rowIndex: number;        // 1-based row in Excel (excludes header)
  name: string;
  role: string;
  phone?: string;
  email?: string;
  access_code?: string;    // User-provided or auto-generated code
  wallet_amount: number;
  valid: boolean;
  errors: string[];
}

/** Log of every scan attempt, accepted or rejected */
export interface ScanAttempt {
  id: string;
  timestamp: string;       // ISO timestamp
  stall_code?: string;
  stall_name?: string;
  person_code?: string;
  person_name?: string;
  slot?: MealSlot;
  amount?: number;
  status: 'accepted' | 'rejected';
  reason?: string;
}

/** Persisted record of each upload operation */
export interface RosterUploadHistory {
  id: string;
  upload_date: string;     // YYYY-MM-DD — the "active from" date chosen by admin
  campus: string;
  file_name: string;
  added: number;
  updated: number;
  skipped: number;
  uploaded_by: string;
  uploaded_at: string;     // ISO timestamp
}
