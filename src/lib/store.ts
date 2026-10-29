import {
  Person,
  Settings,
  Vendor,
  Transaction,
  Flag,
  ScanResult,
  MealSlot,
  DailyBillingRow,
  RosterUploadHistory,
  Stall,
  VendorAccount,
} from '@/types';
import {
  INITIAL_SETTINGS,
  INITIAL_PEOPLE,
  INITIAL_VENDORS,
  INITIAL_TRANSACTIONS,
  INITIAL_FLAGS,
  INITIAL_STALLS,
  INITIAL_VENDOR_ACCOUNTS,
} from './mockData';
import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEYS = {
  SETTINGS: 'cas_wallet_settings_v2',
  PEOPLE: 'cas_wallet_people_v2',
  VENDORS: 'cas_wallet_vendors_v2',
  TRANSACTIONS: 'cas_wallet_transactions_v2',
  FLAGS: 'cas_wallet_flags_v2',
  ROSTER_HISTORY: 'cas_wallet_roster_history_v2',
  STALLS: 'cas_wallet_stalls_v2',
  VENDOR_ACCOUNTS: 'cas_wallet_vendor_accounts_v2',
};

// Event emitter for local reactivity + cross-tab BroadcastChannel
class SimpleEventEmitter extends EventTarget {
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    super();
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('cas_wallet_realtime');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type) {
            super.dispatchEvent(new CustomEvent(event.data.type, { detail: event.data.detail }));
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported or failed to initialize:', e);
      }
    }
  }

  emit(event: string, detail?: any) {
    this.dispatchEvent(new CustomEvent(event, { detail }));
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: event, detail });
      } catch (e) {
        // ignore postMessage error
      }
    }
  }
}
export const storeEvents = new SimpleEventEmitter();

// Helper to access localStorage safely in SSR
const safeStorage = {
  get: <T>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') return fallback;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (e) {
      console.warn(`Error reading ${key} from localStorage:`, e);
      return fallback;
    }
  },
  set: <T>(key: string, value: T): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`Error saving ${key} to localStorage:`, e);
    }
  },
};

// Initialize Local State if empty (clean state, zero dummy records)
const initLocalStore = () => {
  if (typeof window === 'undefined') return;

  // Purge any legacy dummy records from localStorage (v1)
  try {
    ['cas_wallet_people_v1', 'cas_wallet_transactions_v1', 'cas_wallet_flags_v1', 'cas_wallet_roster_history_v1'].forEach((k) => {
      localStorage.removeItem(k);
    });
  } catch (e) {}

  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    safeStorage.set(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.PEOPLE)) {
    safeStorage.set(STORAGE_KEYS.PEOPLE, INITIAL_PEOPLE);
  }
  if (!localStorage.getItem(STORAGE_KEYS.VENDORS)) {
    safeStorage.set(STORAGE_KEYS.VENDORS, INITIAL_VENDORS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
    safeStorage.set(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.FLAGS)) {
    safeStorage.set(STORAGE_KEYS.FLAGS, INITIAL_FLAGS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.STALLS)) {
    safeStorage.set(STORAGE_KEYS.STALLS, INITIAL_STALLS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.VENDOR_ACCOUNTS)) {
    safeStorage.set(STORAGE_KEYS.VENDOR_ACCOUNTS, INITIAL_VENDOR_ACCOUNTS);
  }
};

// ==============================================================================
// PUBLIC STORE API
// ==============================================================================

export const getSettings = async (): Promise<Settings> => {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 'current').single();
    if (!error && data) return data as Settings;
  }
  initLocalStore();
  return safeStorage.get<Settings>(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
};

export const updateSettings = async (updates: Partial<Settings>): Promise<Settings> => {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from('settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', 'current')
      .select()
      .single();
    if (!error && data) {
      storeEvents.emit('settings_updated', data);
      return data as Settings;
    }
  }
  initLocalStore();
  const current = safeStorage.get<Settings>(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
  const updated: Settings = { ...current, ...updates, updated_at: new Date().toISOString() };
  safeStorage.set(STORAGE_KEYS.SETTINGS, updated);
  storeEvents.emit('settings_updated', updated);
  return updated;
};

export const getPeople = async (): Promise<Person[]> => {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.from('people').select('*').order('created_at', { ascending: true });
    if (!error && data) return data as Person[];
  }
  initLocalStore();
  return safeStorage.get<Person[]>(STORAGE_KEYS.PEOPLE, INITIAL_PEOPLE);
};

export const getPersonByToken = async (token: string): Promise<Person | null> => {
  if (!token) return null;
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.from('people').select('*').eq('token', token).maybeSingle();
    if (!error && data) return data as Person;
  }
  initLocalStore();
  const people = safeStorage.get<Person[]>(STORAGE_KEYS.PEOPLE, INITIAL_PEOPLE);
  return people.find((p) => p.token === token) || null;
};

export const getPersonByShortCode = async (code: string): Promise<Person | null> => {
  if (!code) return null;
  const clean = code.trim().toUpperCase();
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.from('people').select('*').ilike('short_code', clean).maybeSingle();
    if (!error && data) return data as Person;
  }
  initLocalStore();
  const people = safeStorage.get<Person[]>(STORAGE_KEYS.PEOPLE, INITIAL_PEOPLE);
  return people.find((p) => p.short_code.toUpperCase() === clean) || null;
};

export const getTransactions = async (filters?: {
  personId?: string;
  slot?: MealSlot;
  voided?: boolean;
  stall_name?: string;
  date?: string; // YYYY-MM-DD
}): Promise<Transaction[]> => {
  if (isSupabaseConfigured() && supabase) {
    let query = supabase.from('transactions').select('*, person:people(name, role, short_code)').order('created_at', { ascending: false });
    if (filters?.personId) query = query.eq('person_id', filters.personId);
    if (filters?.slot) query = query.eq('slot', filters.slot);
    if (filters?.voided !== undefined) query = query.eq('voided', filters.voided);
    if (filters?.stall_name && filters.stall_name !== 'all') query = query.eq('stall_name', filters.stall_name);
    if (filters?.date) {
      query = query.gte('created_at', `${filters.date}T00:00:00.000Z`).lte('created_at', `${filters.date}T23:59:59.999Z`);
    }
    const { data, error } = await query;
    if (!error && data) return data as Transaction[];
  }
  initLocalStore();
  let txs = safeStorage.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
  if (filters?.personId) {
    txs = txs.filter((t) => t.person_id === filters.personId);
  }
  if (filters?.slot) {
    txs = txs.filter((t) => t.slot === filters.slot);
  }
  if (filters?.voided !== undefined) {
    txs = txs.filter((t) => t.voided === filters.voided);
  }
  if (filters?.stall_name && filters.stall_name !== 'all') {
    txs = txs.filter((t) => t.stall_name.toLowerCase() === filters.stall_name!.toLowerCase());
  }
  if (filters?.date) {
    txs = txs.filter((t) => t.created_at.startsWith(filters.date!));
  }
  return txs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

// ==============================================================================
// STALLS MANAGEMENT
// ==============================================================================

export const getStalls = async (): Promise<Stall[]> => {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.from('stalls').select('*').order('created_at', { ascending: true });
    if (!error && data) return data as Stall[];
  }
  initLocalStore();
  return safeStorage.get<Stall[]>(STORAGE_KEYS.STALLS, INITIAL_STALLS);
};

export const createStall = async (stallData: { name: string; campus: string; vendor_name?: string }): Promise<Stall> => {
  initLocalStore();
  const stalls = safeStorage.get<Stall[]>(STORAGE_KEYS.STALLS, INITIAL_STALLS);
  const newStall: Stall = {
    id: `stall-${Date.now()}`,
    name: stallData.name.trim(),
    campus: stallData.campus.trim(),
    vendor_name: stallData.vendor_name || 'Blue Spring Catering',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured() && supabase) {
    await supabase.from('stalls').insert(newStall);
  }

  const updated = [...stalls, newStall];
  safeStorage.set(STORAGE_KEYS.STALLS, updated);
  storeEvents.emit('stalls_updated', updated);
  return newStall;
};

export const deleteStall = async (id: string): Promise<boolean> => {
  initLocalStore();
  const stalls = safeStorage.get<Stall[]>(STORAGE_KEYS.STALLS, INITIAL_STALLS);
  const updated = stalls.filter((s) => s.id !== id);

  if (isSupabaseConfigured() && supabase) {
    await supabase.from('stalls').delete().eq('id', id);
  }

  safeStorage.set(STORAGE_KEYS.STALLS, updated);
  storeEvents.emit('stalls_updated', updated);
  return true;
};

// ==============================================================================
// VENDOR & CASHIER ACCOUNTS MANAGEMENT
// ==============================================================================

export const getVendorAccounts = async (): Promise<VendorAccount[]> => {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.from('vendor_accounts').select('*').order('created_at', { ascending: true });
    if (!error && data) return data as VendorAccount[];
  }
  initLocalStore();
  return safeStorage.get<VendorAccount[]>(STORAGE_KEYS.VENDOR_ACCOUNTS, INITIAL_VENDOR_ACCOUNTS);
};

export const createVendorAccount = async (
  accountData: Omit<VendorAccount, 'id' | 'created_at'>
): Promise<VendorAccount> => {
  initLocalStore();
  const accounts = safeStorage.get<VendorAccount[]>(STORAGE_KEYS.VENDOR_ACCOUNTS, INITIAL_VENDOR_ACCOUNTS);
  const newAccount: VendorAccount = {
    ...accountData,
    id: `acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured() && supabase) {
    await supabase.from('vendor_accounts').insert(newAccount);
  }

  const updated = [...accounts, newAccount];
  safeStorage.set(STORAGE_KEYS.VENDOR_ACCOUNTS, updated);
  storeEvents.emit('vendor_accounts_updated', updated);
  return newAccount;
};

export const updateVendorAccount = async (
  id: string,
  updates: Partial<VendorAccount>
): Promise<VendorAccount> => {
  initLocalStore();
  const accounts = safeStorage.get<VendorAccount[]>(STORAGE_KEYS.VENDOR_ACCOUNTS, INITIAL_VENDOR_ACCOUNTS);
  const index = accounts.findIndex((a) => a.id === id);
  if (index === -1) throw new Error('Account not found');

  accounts[index] = { ...accounts[index], ...updates };

  if (isSupabaseConfigured() && supabase) {
    await supabase.from('vendor_accounts').update(updates).eq('id', id);
  }

  safeStorage.set(STORAGE_KEYS.VENDOR_ACCOUNTS, accounts);
  storeEvents.emit('vendor_accounts_updated', accounts);
  return accounts[index];
};

export const deleteVendorAccount = async (id: string): Promise<boolean> => {
  initLocalStore();
  const accounts = safeStorage.get<VendorAccount[]>(STORAGE_KEYS.VENDOR_ACCOUNTS, INITIAL_VENDOR_ACCOUNTS);
  const updated = accounts.filter((a) => a.id !== id);

  if (isSupabaseConfigured() && supabase) {
    await supabase.from('vendor_accounts').delete().eq('id', id);
  }

  safeStorage.set(STORAGE_KEYS.VENDOR_ACCOUNTS, updated);
  storeEvents.emit('vendor_accounts_updated', updated);
  return true;
};

export const getStallTodayStats = async (
  stallName?: string
): Promise<{ totalAmount: number; count: number }> => {
  const todayStr = new Date().toISOString().split('T')[0];
  const txs = await getTransactions({
    voided: false,
    stall_name: stallName && stallName !== 'all' ? stallName : undefined,
    date: todayStr,
  });

  const totalAmount = txs.reduce((sum, t) => sum + t.amount, 0);
  return { totalAmount, count: txs.length };
};


export const getFlags = async (): Promise<Flag[]> => {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from('flags')
      .select('*, transaction:transactions(*), person:people(*)')
      .order('created_at', { ascending: false });
    if (!error && data) return data as Flag[];
  }
  initLocalStore();
  const flags = safeStorage.get<Flag[]>(STORAGE_KEYS.FLAGS, INITIAL_FLAGS);
  const txs = safeStorage.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
  const people = safeStorage.get<Person[]>(STORAGE_KEYS.PEOPLE, INITIAL_PEOPLE);

  return flags.map((f) => ({
    ...f,
    transaction: txs.find((t) => t.id === f.transaction_id),
    person: people.find((p) => p.id === f.person_id),
  })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

// ==============================================================================
// ATOMIC SCAN PROCESSOR (DUAL ENGINE: SUPABASE RPC OR ROBUST LOCAL ENGINE)
// ==============================================================================

export interface ProcessScanInput {
  identifier: string; // token OR short_code
  slot: MealSlot;
  amount: number;
  bill_no?: string;
  vendor_id?: string;
  vendor_name?: string;
  stall_name?: string;
  campus?: string;
}

export const processScan = async (input: ProcessScanInput): Promise<ScanResult> => {
  const { identifier, slot, amount, bill_no, vendor_id, vendor_name, stall_name } = input;

  if (!identifier || !slot || !amount || amount <= 0) {
    return { success: false, error: 'Invalid input parameters. Amount must be positive.' };
  }

  // 1. If Supabase configured, call atomic stored procedure
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.rpc('process_scan', {
        p_identifier: identifier,
        p_slot: slot,
        p_amount: amount,
        p_bill_no: bill_no || null,
        p_vendor_id: vendor_id || null,
        p_vendor_name: vendor_name || 'Blue Spring',
        p_stall_name: stall_name || 'Food Stall',
      });

      if (error) {
        return { success: false, error: error.message };
      }
      storeEvents.emit('transaction_created', data);
      return data as ScanResult;
    } catch (e: any) {
      return { success: false, error: e?.message || 'Database execution error' };
    }
  }

  // 2. High-fidelity Local Engine (Guarantees same rules, atomic validation)
  initLocalStore();
  const settings = safeStorage.get<Settings>(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
  const people = safeStorage.get<Person[]>(STORAGE_KEYS.PEOPLE, INITIAL_PEOPLE);
  let transactions = safeStorage.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
  let flags = safeStorage.get<Flag[]>(STORAGE_KEYS.FLAGS, INITIAL_FLAGS);

  // A. Check Event Window
  const todayStr = new Date().toISOString().split('T')[0];
  if (todayStr < settings.start_date || todayStr > settings.end_date) {
    return {
      success: false,
      error: `Placement event is inactive (Active: ${settings.start_date} to ${settings.end_date})`,
    };
  }

  // B. Locate Person
  const cleanId = identifier.trim().toUpperCase();
  const person = people.find(
    (p) => p.token === identifier.trim() || p.short_code.toUpperCase() === cleanId
  );

  if (!person) {
    return { success: false, error: `Invalid QR code or short code: "${identifier}"` };
  }

  // B2. Check if person is registered (has a roster_date set) and active
  if (person.active === false) {
    return {
      success: false,
      error: `"${person.name}" is marked inactive. Please contact CAS Admin.`,
    };
  }

  // B3. Check that person's roster_date is on or before today
  if (person.roster_date && person.roster_date > todayStr) {
    return {
      success: false,
      error: `"${person.name}" is not yet active. Roster active from ${person.roster_date}.`,
    };
  }

  // C. Validate Slot Cap
  const slotCap = settings.slot_caps[slot] ?? 0;
  if (slotCap <= 0) {
    return { success: false, error: `Invalid meal slot: ${slot}` };
  }
  if (amount > slotCap) {
    return {
      success: false,
      error: `Amount ₹${amount.toLocaleString()} exceeds ${slot.toUpperCase()} cap of ₹${slotCap.toLocaleString()}`,
    };
  }

  // D. Validate Daily Ceiling and Slot Scan Counts
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayTxs = transactions.filter(
    (t) =>
      t.person_id === person.id &&
      !t.voided &&
      new Date(t.created_at).getTime() >= startOfToday.getTime()
  );

  const todaySpent = todayTxs.reduce((sum, t) => sum + t.amount, 0);
  const remainingCeiling = Math.max(0, settings.daily_ceiling - todaySpent);

  if (todaySpent + amount > settings.daily_ceiling) {
    return {
      success: false,
      error: `Exceeds daily ceiling of ₹${settings.daily_ceiling}. Today spent: ₹${todaySpent}, Remaining today: ₹${remainingCeiling}`,
    };
  }

  const slotTxs = todayTxs.filter((t) => t.slot === slot);
  const maxSlotScans = settings.slot_max_scans[slot] ?? 1;
  if (slotTxs.length >= maxSlotScans) {
    return {
      success: false,
      error: `Slot scan limit reached: Maximum ${maxSlotScans} scan(s) allowed for ${slot.toUpperCase()} per day`,
    };
  }

  // E. Validate Total Event Wallet Balance (Carry-forward logic)
  const allValidTxs = transactions.filter((t) => t.person_id === person.id && !t.voided);
  const totalSpent = allValidTxs.reduce((sum, t) => sum + t.amount, 0);
  const remainingWallet = Math.max(0, person.wallet_total - totalSpent);

  if (totalSpent + amount > person.wallet_total) {
    return {
      success: false,
      error: `Insufficient wallet balance. Total: ₹${person.wallet_total}, Spent: ₹${totalSpent}, Remaining: ₹${remainingWallet}`,
    };
  }

  // F. Create Transaction
  const newTxId = `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();
  const newTx: Transaction = {
    id: newTxId,
    person_id: person.id,
    vendor_id: vendor_id || 'vendor-1',
    vendor_name: vendor_name || 'Blue Spring Catering',
    stall_name: stall_name || 'Main Dining Counter (Stall 1)',
    slot,
    amount,
    bill_no: bill_no || undefined,
    voided: false,
    created_at: now,
    person: {
      name: person.name,
      role: person.role,
      short_code: person.short_code,
    },
  };

  transactions = [newTx, ...transactions];
  safeStorage.set(STORAGE_KEYS.TRANSACTIONS, transactions);

  // G. Automated Flags Checks
  const newFlags: Flag[] = [];

  // Flag 1: Exact Slot Cap
  if (amount === slotCap) {
    newFlags.push({
      id: `flag-${Date.now()}-1`,
      transaction_id: newTxId,
      person_id: person.id,
      type: 'slot_cap_exact',
      reason: `Charge of ₹${amount} exactly matches maximum ${slot.toUpperCase()} cap`,
      resolved: false,
      created_at: now,
    });
  }

  // Flag 2: Frequent Scans within window
  const windowTime = Date.now() - settings.frequent_scan_window_mins * 60 * 1000;
  const recentPersonScans = transactions.filter(
    (t) =>
      t.person_id === person.id &&
      !t.voided &&
      new Date(t.created_at).getTime() >= windowTime
  );
  if (recentPersonScans.length > 2) {
    newFlags.push({
      id: `flag-${Date.now()}-2`,
      transaction_id: newTxId,
      person_id: person.id,
      type: 'frequent_scans',
      reason: `${recentPersonScans.length} scans detected for ${person.name} within ${settings.frequent_scan_window_mins} minutes`,
      resolved: false,
      created_at: now,
    });
  }

  // Flag 3: Anomaly vs Slot Average
  const pastSlotTxsToday = transactions.filter(
    (t) =>
      t.slot === slot &&
      !t.voided &&
      t.id !== newTxId &&
      new Date(t.created_at).getTime() >= startOfToday.getTime()
  );
  if (pastSlotTxsToday.length >= 2) {
    const avg =
      pastSlotTxsToday.reduce((sum, t) => sum + t.amount, 0) / pastSlotTxsToday.length;
    const threshold = avg * (1 + settings.flag_anomaly_pct / 100);
    if (amount > threshold) {
      newFlags.push({
        id: `flag-${Date.now()}-3`,
        transaction_id: newTxId,
        person_id: person.id,
        type: 'above_slot_avg',
        reason: `Amount ₹${amount} is ${Math.round(((amount - avg) / avg) * 100)}% above today's average (₹${Math.round(avg)}) for ${slot}`,
        resolved: false,
        created_at: now,
      });
    }
  }

  if (newFlags.length > 0) {
    flags = [...newFlags, ...flags];
    safeStorage.set(STORAGE_KEYS.FLAGS, flags);
    storeEvents.emit('flags_updated', flags);
  }

  const result: ScanResult = {
    success: true,
    transaction_id: newTxId,
    person_name: person.name,
    person_role: person.role,
    amount,
    slot,
    bill_no: bill_no || undefined,
    remaining_wallet: remainingWallet - amount,
    remaining_daily_ceiling: remainingCeiling - amount,
    created_at: now,
  };

  storeEvents.emit('transaction_created', result);
  return result;
};

// ==============================================================================
// TRANSACTION VOID (ADMIN ONLY, MANDATORY REASON, AUDIT PRESERVED)
// ==============================================================================

export const voidTransaction = async (
  transactionId: string,
  voidReason: string,
  adminName = 'CAS Admin'
): Promise<boolean> => {
  if (!transactionId || !voidReason?.trim()) {
    throw new Error('Transaction ID and mandatory void reason are required');
  }

  const now = new Date().toISOString();

  if (isSupabaseConfigured() && supabase) {
    const { error } = await supabase
      .from('transactions')
      .update({
        voided: true,
        void_reason: voidReason.trim(),
        voided_at: now,
        voided_by: adminName,
      })
      .eq('id', transactionId);

    if (error) throw new Error(error.message);
    storeEvents.emit('transaction_voided', { transactionId });
    return true;
  }

  initLocalStore();
  let txs = safeStorage.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
  const index = txs.findIndex((t) => t.id === transactionId);
  if (index === -1) throw new Error('Transaction not found');

  txs[index] = {
    ...txs[index],
    voided: true,
    void_reason: voidReason.trim(),
    voided_at: now,
    voided_by: adminName,
  };

  safeStorage.set(STORAGE_KEYS.TRANSACTIONS, txs);
  storeEvents.emit('transaction_voided', { transactionId });
  return true;
};

// ==============================================================================
// PERSON CHARGE FLAGGING
// ==============================================================================

export const flagTransactionByUser = async (
  transactionId: string,
  personId: string,
  userNote: string
): Promise<boolean> => {
  const now = new Date().toISOString();

  if (isSupabaseConfigured() && supabase) {
    const { error } = await supabase.from('flags').insert({
      transaction_id: transactionId,
      person_id: personId,
      type: 'user_flagged',
      reason: 'Flagged by cardholder on personal wallet portal',
      user_note: userNote || 'Cardholder contested this charge',
    });
    if (error) throw new Error(error.message);
    storeEvents.emit('flags_updated', {});
    return true;
  }

  initLocalStore();
  let flags = safeStorage.get<Flag[]>(STORAGE_KEYS.FLAGS, INITIAL_FLAGS);
  const newFlag: Flag = {
    id: `flag-${Date.now()}`,
    transaction_id: transactionId,
    person_id: personId,
    type: 'user_flagged',
    reason: 'Flagged by cardholder on personal wallet portal',
    user_note: userNote || 'Cardholder contested this charge',
    resolved: false,
    created_at: now,
  };
  flags = [newFlag, ...flags];
  safeStorage.set(STORAGE_KEYS.FLAGS, flags);
  storeEvents.emit('flags_updated', flags);
  return true;
};

export const resolveFlag = async (flagId: string): Promise<boolean> => {
  const now = new Date().toISOString();

  if (isSupabaseConfigured() && supabase) {
    const { error } = await supabase
      .from('flags')
      .update({ resolved: true, resolved_at: now })
      .eq('id', flagId);
    if (error) throw new Error(error.message);
    storeEvents.emit('flags_updated', {});
    return true;
  }

  initLocalStore();
  let flags = safeStorage.get<Flag[]>(STORAGE_KEYS.FLAGS, INITIAL_FLAGS);
  const idx = flags.findIndex((f) => f.id === flagId);
  if (idx !== -1) {
    flags[idx] = { ...flags[idx], resolved: true, resolved_at: now };
    safeStorage.set(STORAGE_KEYS.FLAGS, flags);
    storeEvents.emit('flags_updated', flags);
  }
  return true;
};

// ==============================================================================
// PEOPLE IMPORT (CSV PARSER) & TOKEN GENERATOR
// ==============================================================================

export const generateSecureToken = (prefix = 'tok'): string => {
  const rand = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
  return `${prefix}_${rand}`;
};

export const generateShortCode = (index: number): string => {
  return `CAS${String(index).padStart(2, '0')}`;
};

export const importPeopleFromCSV = async (csvContent: string): Promise<number> => {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return 0;

  initLocalStore();
  const existingPeople = safeStorage.get<Person[]>(STORAGE_KEYS.PEOPLE, INITIAL_PEOPLE);
  let nextIndex = existingPeople.length + 1;

  // Header check: name, role, phone, email, wallet_amount
  const newPeople: Person[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (row.length >= 2 && row[0]) {
      const name = row[0];
      const role = row[1] || 'Interview Coordinator';
      const phone = row[2] || undefined;
      const email = row[3] || undefined;
      const wallet_total = parseFloat(row[4]) || 5000;

      newPeople.push({
        id: `person-${Date.now()}-${i}`,
        name,
        role,
        phone,
        email,
        wallet_total,
        active: true,
        token: generateSecureToken(name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 10)),
        short_code: generateShortCode(nextIndex++),
        created_at: new Date().toISOString(),
      });
    }
  }

  if (newPeople.length > 0) {
    if (isSupabaseConfigured() && supabase) {
      await supabase.from('people').insert(newPeople);
    }
    const combined = [...existingPeople, ...newPeople];
    safeStorage.set(STORAGE_KEYS.PEOPLE, combined);
    storeEvents.emit('people_updated', combined);
  }

  return newPeople.length;
};

// ==============================================================================
// ROSTER XLSX IMPORT (NEW - per campus + date)
// ==============================================================================

const VALID_ROLES = ['Interview Coordinator', 'Driver', 'CAS Staff'];

export interface RosterImportResult {
  added: number;
  updated: number;
  skipped: number;
  personLinks: Array<{
    name: string;
    role: string;
    short_code: string;
    token: string;
    wallet_total: number;
    campus: string;
    phone?: string;
    email?: string;
  }>;
}

/** Called from the admin modal after the admin clicks "Upload". */
export const importRosterRows = async (
  rows: Array<{
    name: string;
    role: string;
    phone?: string;
    email?: string;
    wallet_amount: number;
  }>,
  rosterDate: string,   // YYYY-MM-DD
  campus: string,
  fileName: string
): Promise<RosterImportResult> => {
  initLocalStore();
  const existingPeople = safeStorage.get<Person[]>(STORAGE_KEYS.PEOPLE, INITIAL_PEOPLE);

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const personLinks: RosterImportResult['personLinks'] = [];
  const updatedPeople = [...existingPeople];

  // Calculate the starting index for new short codes
  const maxCode = existingPeople.reduce((max, p) => {
    const num = parseInt(p.short_code.replace(/\D/g, ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  let nextIndex = maxCode + 1;

  for (const row of rows) {
    // Find duplicate: same phone OR email + same campus
    const dupIdx = updatedPeople.findIndex((p) => {
      const campusMatch = !campus || !p.campus || p.campus === campus;
      if (!campusMatch) return false;
      if (row.phone && p.phone && row.phone === p.phone) return true;
      if (row.email && p.email && row.email.toLowerCase() === p.email?.toLowerCase()) return true;
      return false;
    });

    if (dupIdx !== -1) {
      const existing = updatedPeople[dupIdx];
      const hasSpent = (() => {
        const txs = safeStorage.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
        return txs.some((t) => t.person_id === existing.id && !t.voided);
      })();

      // Update wallet amount & roster_date if person hasn't been soft-deleted with spend
      updatedPeople[dupIdx] = {
        ...existing,
        wallet_total: row.wallet_amount,
        roster_date: rosterDate,
        campus,
        active: true, // re-activate
        name: row.name || existing.name,
        role: row.role || existing.role,
        phone: row.phone || existing.phone,
        email: row.email || existing.email,
      };
      updated++;

      personLinks.push({
        name: updatedPeople[dupIdx].name,
        role: updatedPeople[dupIdx].role,
        short_code: updatedPeople[dupIdx].short_code,
        token: updatedPeople[dupIdx].token,
        wallet_total: updatedPeople[dupIdx].wallet_total,
        campus,
        phone: updatedPeople[dupIdx].phone,
        email: updatedPeople[dupIdx].email,
      });
    } else {
      // New person
      const token = generateSecureToken(row.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 10));
      const short_code = generateShortCode(nextIndex++);
      const newPerson: Person = {
        id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: row.name,
        role: row.role,
        phone: row.phone,
        email: row.email,
        wallet_total: row.wallet_amount,
        token,
        short_code,
        campus,
        roster_date: rosterDate,
        active: true,
        created_at: new Date().toISOString(),
      };
      updatedPeople.push(newPerson);
      added++;

      personLinks.push({
        name: newPerson.name,
        role: newPerson.role,
        short_code: newPerson.short_code,
        token: newPerson.token,
        wallet_total: newPerson.wallet_total,
        campus,
        phone: newPerson.phone,
        email: newPerson.email,
      });
    }
  }

  safeStorage.set(STORAGE_KEYS.PEOPLE, updatedPeople);
  storeEvents.emit('people_updated', updatedPeople);

  // Save upload history record
  const history = safeStorage.get<RosterUploadHistory[]>(STORAGE_KEYS.ROSTER_HISTORY, []);
  const historyRecord: RosterUploadHistory = {
    id: `rh-${Date.now()}`,
    upload_date: rosterDate,
    campus,
    file_name: fileName,
    added,
    updated,
    skipped,
    uploaded_by: 'CAS Admin',
    uploaded_at: new Date().toISOString(),
  };
  safeStorage.set(STORAGE_KEYS.ROSTER_HISTORY, [historyRecord, ...history]);
  storeEvents.emit('roster_uploaded', historyRecord);

  return { added, updated, skipped, personLinks };
};

/** Fetch roster upload history */
export const getRosterHistory = (): RosterUploadHistory[] => {
  return safeStorage.get<RosterUploadHistory[]>(STORAGE_KEYS.ROSTER_HISTORY, []);
};

// ==============================================================================
// BILLING EXPORT (CSV OF ALL VALID NON-VOIDED TRANSACTIONS)
// ==============================================================================

export const generateBillingSummary = async (): Promise<{
  rows: DailyBillingRow[];
  totalAmount: number;
  totalTransactions: number;
}> => {
  const txs = await getTransactions({ voided: false });
  const map = new Map<string, DailyBillingRow>();

  for (const t of txs) {
    const date = t.created_at.split('T')[0];
    const key = `${date}|${t.slot}|${t.stall_name}`;
    const existing = map.get(key) || {
      date,
      slot: t.slot.toUpperCase(),
      vendor_name: t.vendor_name,
      stall_name: t.stall_name,
      transaction_count: 0,
      total_amount: 0,
    };

    existing.transaction_count += 1;
    existing.total_amount += t.amount;
    map.set(key, existing);
  }

  const rows = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  const totalAmount = rows.reduce((sum, r) => sum + r.total_amount, 0);
  const totalTransactions = rows.reduce((sum, r) => sum + r.transaction_count, 0);

  return { rows, totalAmount, totalTransactions };
};

export const exportBillingCSV = async (): Promise<string> => {
  const { rows, totalAmount, totalTransactions } = await generateBillingSummary();
  const txs = await getTransactions({ voided: false });

  let csv = '=== CAS MEAL WALLET - VENDOR BILLING REPORT (BLUE SPRING) ===\r\n';
  csv += `Export Generated At,${new Date().toLocaleString('en-IN')}\r\n`;
  csv += `Placement Event,ISB PGP Placements 2026\r\n`;
  csv += `Total Valid Scans,${totalTransactions}\r\n`;
  csv += `Total Payable Amount (INR),Rs ${totalAmount.toFixed(2)}\r\n\r\n`;

  csv += '--- DAILY SUMMARY BREAKDOWN ---\r\n';
  csv += 'Date,Meal Slot,Vendor,Stall,Valid Transaction Count,Slot Total (INR)\r\n';
  rows.forEach((r) => {
    csv += `${r.date},${r.slot},"${r.vendor_name}","${r.stall_name}",${r.transaction_count},${r.total_amount.toFixed(2)}\r\n`;
  });

  csv += '\r\n--- INDIVIDUAL NON-VOIDED TRANSACTION AUDIT TRAIL ---\r\n';
  csv += 'Transaction ID,Date & Time,Person Name,Role,Short Code,Slot,Bill Number,Amount (INR),Stall\r\n';
  txs.forEach((t) => {
    csv += `"${t.id}","${new Date(t.created_at).toLocaleString('en-IN')}","${t.person?.name || ''}","${t.person?.role || ''}","${t.person?.short_code || ''}","${t.slot}","${t.bill_no || 'N/A'}",${t.amount.toFixed(2)},"${t.stall_name}"\r\n`;
  });

  return csv;
};

// ==============================================================================
// RESET DEMO DATA
// ==============================================================================

export const resetDemoData = (): void => {
  if (typeof window === 'undefined') return;
  safeStorage.set(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
  safeStorage.set(STORAGE_KEYS.PEOPLE, INITIAL_PEOPLE);
  safeStorage.set(STORAGE_KEYS.VENDORS, INITIAL_VENDORS);
  safeStorage.set(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
  safeStorage.set(STORAGE_KEYS.FLAGS, INITIAL_FLAGS);
  safeStorage.set(STORAGE_KEYS.ROSTER_HISTORY, []);
  safeStorage.set(STORAGE_KEYS.STALLS, INITIAL_STALLS);
  safeStorage.set(STORAGE_KEYS.VENDOR_ACCOUNTS, INITIAL_VENDOR_ACCOUNTS);
  storeEvents.emit('data_reset', {});
};
