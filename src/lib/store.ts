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
  ScanAttempt,
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
  SCAN_ATTEMPTS: 'cas_wallet_scan_attempts_v2',
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

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// ==============================================================================
// INDIA TIME (ASIA/KOLKATA) & DATE HELPERS
// ==============================================================================

/**
 * Returns YYYY-MM-DD in India Standard Time (Asia/Kolkata).
 * Midnight to midnight in India defines the start and end of each day.
 */
export const getIndiaDateString = (dateInput: Date | string = new Date()): string => {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
};

// ==============================================================================
// DEVICE RATE-LIMITING (5 WRONG ATTEMPTS -> 15 MIN LOCKOUT)
// ==============================================================================

const RATE_LIMIT_STORAGE_KEY = 'cas_rate_limits_v2';

export interface RateLimitStatus {
  allowed: boolean;
  remainingMinutes: number;
  attempts: number;
}

export const checkRateLimit = (key: 'person_code' | 'stall_code'): RateLimitStatus => {
  if (typeof window === 'undefined') return { allowed: true, remainingMinutes: 0, attempts: 0 };
  try {
    const raw = localStorage.getItem(`${RATE_LIMIT_STORAGE_KEY}_${key}`);
    if (!raw) return { allowed: true, remainingMinutes: 0, attempts: 0 };
    const state = JSON.parse(raw);
    const now = Date.now();
    if (state.lockedUntil && now < state.lockedUntil) {
      const remainingMinutes = Math.max(1, Math.ceil((state.lockedUntil - now) / 60000));
      return { allowed: false, remainingMinutes, attempts: state.attempts || 5 };
    }
    if (state.lockedUntil && now >= state.lockedUntil) {
      // Lock expired, automatically clear
      localStorage.removeItem(`${RATE_LIMIT_STORAGE_KEY}_${key}`);
      return { allowed: true, remainingMinutes: 0, attempts: 0 };
    }
    return { allowed: true, remainingMinutes: 0, attempts: state.attempts || 0 };
  } catch (e) {
    return { allowed: true, remainingMinutes: 0, attempts: 0 };
  }
};

export const recordFailedAttempt = (key: 'person_code' | 'stall_code'): RateLimitStatus => {
  if (typeof window === 'undefined') return { allowed: true, remainingMinutes: 0, attempts: 1 };
  try {
    const storageKey = `${RATE_LIMIT_STORAGE_KEY}_${key}`;
    const raw = localStorage.getItem(storageKey);
    const state = raw ? JSON.parse(raw) : { attempts: 0, lockedUntil: 0 };
    const attempts = (state.attempts || 0) + 1;
    if (attempts >= 5) {
      const lockedUntil = Date.now() + 15 * 60 * 1000; // 15 minutes lockout
      localStorage.setItem(storageKey, JSON.stringify({ attempts, lockedUntil }));
      return { allowed: false, remainingMinutes: 15, attempts };
    }
    localStorage.setItem(storageKey, JSON.stringify({ attempts, lockedUntil: 0 }));
    return { allowed: true, remainingMinutes: 0, attempts };
  } catch (e) {
    return { allowed: true, remainingMinutes: 0, attempts: 1 };
  }
};

export const clearRateLimit = (key: 'person_code' | 'stall_code'): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${RATE_LIMIT_STORAGE_KEY}_${key}`);
  } catch (e) {}
};

// ==============================================================================
// CODE GENERATORS (CLEAN CHARACTERS: NO 0/O OR 1/I)
// ==============================================================================

/**
 * Generates a clean 6-character random access code without confusing characters (no 0, O, 1, I).
 */
export const generateCleanAccessCode = (existingCodes: Set<string> = new Set()): string => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  let attempts = 0;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;
  } while (existingCodes.has(code.toUpperCase()) && attempts < 1000);
  return code;
};

/**
 * Generates a clean stall code (e.g. STALL-01 or STALL-XXX).
 */
export const generateStallCode = (existingCodes: Set<string> = new Set()): string => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  let attempts = 0;
  do {
    code = 'STALL-';
    for (let i = 0; i < 3; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;
  } while (existingCodes.has(code.toUpperCase()) && attempts < 1000);
  return code;
};

// ==============================================================================
// SCAN ATTEMPTS AUDIT LOG
// ==============================================================================

export const logScanAttempt = async (
  attempt: Omit<ScanAttempt, 'id' | 'timestamp'>
): Promise<ScanAttempt> => {
  const newAttempt: ScanAttempt = {
    id: `scan-att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...attempt,
  };

  initLocalStore();
  const attempts = safeStorage.get<ScanAttempt[]>(STORAGE_KEYS.SCAN_ATTEMPTS, []);
  const updated = [newAttempt, ...attempts].slice(0, 500); // keep last 500
  safeStorage.set(STORAGE_KEYS.SCAN_ATTEMPTS, updated);
  storeEvents.emit('scan_attempt_logged', newAttempt);

  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('scan_attempts').insert(newAttempt);
    } catch (e) {
      // ignore
    }
  }

  return newAttempt;
};

export const getScanAttempts = async (): Promise<ScanAttempt[]> => {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.from('scan_attempts').select('*').order('timestamp', { ascending: false }).limit(200);
      if (!error && data) return data as ScanAttempt[];
    } catch (e) {}
  }
  initLocalStore();
  return safeStorage.get<ScanAttempt[]>(STORAGE_KEYS.SCAN_ATTEMPTS, []);
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

export const getPersonByCode = async (code: string): Promise<Person | null> => {
  if (!code || !code.trim()) return null;
  const clean = code.trim().toUpperCase();

  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .or(`access_code.ilike.${clean},short_code.ilike.${clean},token.eq.${code.trim()}`)
      .maybeSingle();
    if (!error && data) return data as Person;
  }

  initLocalStore();
  const people = safeStorage.get<Person[]>(STORAGE_KEYS.PEOPLE, INITIAL_PEOPLE);
  const found = people.find(
    (p) =>
      p.active !== false &&
      ((p.access_code && p.access_code.toUpperCase() === clean) ||
        (p.short_code && p.short_code.toUpperCase() === clean) ||
        p.token === code.trim())
  );
  return found || null;
};

export interface PersonPassData {
  person: Person;
  wallet_total: number;
  total_spent: number;
  remaining_wallet: number;
  today_spent: number;
  remaining_ceiling: number;
  slot_usage: Record<MealSlot, { used: number; max: number; completed: boolean }>;
  today_transactions: Transaction[];
}

export const getPersonPassData = async (code: string): Promise<PersonPassData | null> => {
  if (!code || !code.trim()) return null;
  const person = await getPersonByCode(code);
  if (!person) return null;

  const settings = await getSettings();
  const transactions = await getTransactions({ personId: person.id });
  const validTxs = transactions.filter((t) => !t.voided);

  const total_spent = validTxs.reduce((sum, t) => sum + t.amount, 0);
  const remaining_wallet = Math.max(0, person.wallet_total - total_spent);

  // Filter today's transactions in Asia/Kolkata date
  const todayIndiaStr = getIndiaDateString(new Date());
  const today_transactions = validTxs.filter((t) => getIndiaDateString(t.created_at) === todayIndiaStr);
  const today_spent = today_transactions.reduce((sum, t) => sum + t.amount, 0);
  const remaining_ceiling = Math.max(0, settings.daily_ceiling - today_spent);

  const allSlots: MealSlot[] = ['breakfast', 'snacks', 'beverages', 'lunch', 'dinner'];
  const slot_usage = allSlots.reduce((acc, slot) => {
    const used = today_transactions.filter((t) => t.slot === slot).length;
    const max = settings.slot_max_scans[slot] ?? (slot === 'snacks' || slot === 'beverages' ? 2 : 1);
    acc[slot] = {
      used,
      max,
      completed: used >= max,
    };
    return acc;
  }, {} as Record<MealSlot, { used: number; max: number; completed: boolean }>);

  return {
    person,
    wallet_total: person.wallet_total,
    total_spent,
    remaining_wallet,
    today_spent,
    remaining_ceiling,
    slot_usage,
    today_transactions,
  };
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
  initLocalStore();
  const localStalls = safeStorage.get<Stall[]>(STORAGE_KEYS.STALLS, INITIAL_STALLS);
  const localMap = new Map<string, Stall>();
  localStalls.forEach((s) => {
    if (s.id) localMap.set(s.id, s);
    if (s.name) localMap.set(s.name.trim().toLowerCase(), s);
  });

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase.from('stalls').select('*').order('created_at', { ascending: true });
      if (!error && Array.isArray(data)) {
        if (data.length > 0) {
          const merged: Stall[] = data.map((remote: any, idx: number) => {
            const match = localMap.get(remote.id) || localMap.get((remote.name || '').trim().toLowerCase());
            return {
              id: remote.id,
              name: remote.name,
              campus: remote.campus || 'Hyderabad',
              stall_code: remote.stall_code || match?.stall_code || `STALL0${idx + 1}`,
              code_active: remote.code_active !== undefined ? remote.code_active : (match?.code_active ?? true),
              vendor_name: remote.vendor_name || 'Blue Spring Catering',
              is_active: remote.is_active !== false,
              created_at: remote.created_at || new Date().toISOString(),
            };
          });
          safeStorage.set(STORAGE_KEYS.STALLS, merged);
          return merged;
        } else {
          // If Supabase table is empty, return local stalls
          return localStalls;
        }
      } else if (error) {
        console.warn('Supabase getStalls failed, using local storage fallback:', error);
      }
    } catch (e) {
      console.warn('Supabase getStalls error:', e);
    }
  }

  return localStalls;
};

export const getStallByCode = async (stallCode: string): Promise<Stall | null> => {
  if (!stallCode || !stallCode.trim()) return null;
  const clean = stallCode.trim().toUpperCase();
  const stalls = await getStalls();
  const found = stalls.find(
    (s) =>
      s.is_active !== false &&
      s.code_active !== false &&
      s.stall_code &&
      s.stall_code.trim().toUpperCase() === clean
  );
  return found || null;
};

export const createStall = async (stallData: {
  name: string;
  campus: string;
  stall_code?: string;
  vendor_name?: string;
}): Promise<Stall> => {
  initLocalStore();
  const stalls = safeStorage.get<Stall[]>(STORAGE_KEYS.STALLS, INITIAL_STALLS);
  const existingCodes = new Set(stalls.map((s) => (s.stall_code || '').toUpperCase()));
  const assignedCode = stallData.stall_code?.trim().toUpperCase() || generateStallCode(existingCodes);

  const newId = generateUUID();
  const newStall: Stall = {
    id: newId,
    name: stallData.name.trim(),
    campus: stallData.campus.trim(),
    stall_code: assignedCode,
    code_active: true,
    vendor_name: stallData.vendor_name || 'Blue Spring Catering',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      // 1. Attempt insert with full schema (including stall_code and code_active)
      const { data, error } = await supabase
        .from('stalls')
        .insert({
          id: newStall.id,
          name: newStall.name,
          campus: newStall.campus,
          stall_code: newStall.stall_code,
          code_active: newStall.code_active,
          vendor_name: newStall.vendor_name,
          is_active: newStall.is_active,
        })
        .select()
        .maybeSingle();

      if (error) {
        // If error is due to missing columns in Supabase schema cache (e.g. PGRST204)
        if (error.code === 'PGRST204' || error.message.toLowerCase().includes('column')) {
          console.warn('Supabase stalls table missing stall_code/code_active columns, inserting base columns:', error.message);
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('stalls')
            .insert({
              id: newStall.id,
              name: newStall.name,
              campus: newStall.campus,
              vendor_name: newStall.vendor_name,
              is_active: newStall.is_active,
            })
            .select()
            .maybeSingle();

          if (fallbackError) {
            console.error('Supabase stall fallback insert error:', fallbackError);
            throw new Error(fallbackError.message);
          }
          if (fallbackData?.id) {
            newStall.id = fallbackData.id;
            if (fallbackData.created_at) newStall.created_at = fallbackData.created_at;
          }
        } else {
          console.error('Supabase stall insert error:', error);
          throw new Error(error.message);
        }
      } else if (data?.id) {
        newStall.id = data.id;
        if (data.created_at) newStall.created_at = data.created_at;
      }
    } catch (e: any) {
      console.error('Error inserting stall into Supabase:', e);
      throw e;
    }
  }

  const updated = [
    ...stalls.filter((s) => s.id !== newStall.id && s.name.toLowerCase() !== newStall.name.toLowerCase()),
    newStall,
  ];
  safeStorage.set(STORAGE_KEYS.STALLS, updated);
  storeEvents.emit('stalls_updated', updated);
  return newStall;
};

export const regenerateStallCode = async (stallId: string): Promise<string> => {
  initLocalStore();
  const stalls = safeStorage.get<Stall[]>(STORAGE_KEYS.STALLS, INITIAL_STALLS);
  const existingCodes = new Set(stalls.map((s) => (s.stall_code || '').toUpperCase()));
  const newCode = generateStallCode(existingCodes);

  const updated = stalls.map((s) => {
    if (s.id === stallId) {
      return { ...s, stall_code: newCode, code_active: true };
    }
    return s;
  });

  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('stalls').update({ stall_code: newCode, code_active: true }).eq('id', stallId);
    } catch (e) {
      console.warn('Supabase regenerateStallCode warning:', e);
    }
  }

  safeStorage.set(STORAGE_KEYS.STALLS, updated);
  storeEvents.emit('stalls_updated', updated);
  return newCode;
};

export const toggleStallCodeActive = async (stallId: string, active: boolean): Promise<boolean> => {
  initLocalStore();
  const stalls = safeStorage.get<Stall[]>(STORAGE_KEYS.STALLS, INITIAL_STALLS);

  const updated = stalls.map((s) => {
    if (s.id === stallId) {
      return { ...s, code_active: active };
    }
    return s;
  });

  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('stalls').update({ code_active: active }).eq('id', stallId);
    } catch (e) {
      console.warn('Supabase toggleStallCodeActive warning:', e);
    }
  }

  safeStorage.set(STORAGE_KEYS.STALLS, updated);
  storeEvents.emit('stalls_updated', updated);
  return active;
};

export const deleteStall = async (id: string): Promise<boolean> => {
  initLocalStore();
  const stalls = safeStorage.get<Stall[]>(STORAGE_KEYS.STALLS, INITIAL_STALLS);
  const updated = stalls.filter((s) => s.id !== id);

  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.from('stalls').delete().eq('id', id);
      if (error) console.error('Supabase deleteStall error:', error);
    } catch (e) {
      console.warn('Supabase deleteStall warning:', e);
    }
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
    try {
      const { data, error } = await supabase.from('vendor_accounts').select('*').order('created_at', { ascending: true });
      if (!error && data) return data as VendorAccount[];
    } catch (e) {
      console.warn('Supabase getVendorAccounts warning:', e);
    }
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
    id: generateUUID(),
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('vendor_accounts')
        .insert({
          id: newAccount.id,
          username: newAccount.username,
          password: newAccount.password,
          name: newAccount.name,
          role: newAccount.role,
          stall_id: newAccount.stall_id || null,
          stall_name: newAccount.stall_name || null,
          campus: newAccount.campus || 'Hyderabad',
          is_active: newAccount.is_active !== false,
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Supabase createVendorAccount error:', error);
        throw new Error(error.message);
      }
      if (data?.id) {
        newAccount.id = data.id;
        if (data.created_at) newAccount.created_at = data.created_at;
      }
    } catch (e: any) {
      console.error('createVendorAccount error:', e);
      throw e;
    }
  }

  const updated = [
    ...accounts.filter((a) => a.id !== newAccount.id && a.username.toLowerCase() !== newAccount.username.toLowerCase()),
    newAccount,
  ];
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
    try {
      await supabase.from('vendor_accounts').update(updates).eq('id', id);
    } catch (e) {
      console.warn('Supabase updateVendorAccount warning:', e);
    }
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
    try {
      await supabase.from('vendor_accounts').delete().eq('id', id);
    } catch (e) {
      console.warn('Supabase deleteVendorAccount warning:', e);
    }
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

  // A. Check Event Window (India Standard Time)
  const todayStr = getIndiaDateString(new Date());
  if (todayStr < settings.start_date || todayStr > settings.end_date) {
    await logScanAttempt({
      status: 'rejected',
      person_code: identifier.trim().toUpperCase(),
      stall_name: stall_name || 'Counter',
      slot,
      amount,
      reason: `Placement event inactive (${settings.start_date} to ${settings.end_date})`,
    });
    return {
      success: false,
      error: `Placement event is inactive (Active: ${settings.start_date} to ${settings.end_date})`,
    };
  }

  // B. Locate Person by access_code, short_code, or token (Case-Insensitive)
  const cleanId = identifier.trim().toUpperCase();
  const person = people.find(
    (p) =>
      (p.access_code && p.access_code.toUpperCase() === cleanId) ||
      p.short_code.toUpperCase() === cleanId ||
      p.token === identifier.trim()
  );

  if (!person) {
    await logScanAttempt({
      status: 'rejected',
      person_code: cleanId,
      stall_name: stall_name || 'Counter',
      slot,
      amount,
      reason: 'Code not registered in roster',
    });
    return { success: false, error: 'Code not registered in roster' };
  }

  // B2. Check if person is active in roster
  if (person.active === false) {
    await logScanAttempt({
      status: 'rejected',
      person_code: cleanId,
      person_name: person.name,
      stall_name: stall_name || 'Counter',
      slot,
      amount,
      reason: 'Cardholder inactive in roster',
    });
    return {
      success: false,
      error: `"${person.name}" is marked inactive. Please contact CAS Admin.`,
    };
  }

  // B3. Check that person's roster_date is on or before today
  if (person.roster_date && person.roster_date > todayStr) {
    await logScanAttempt({
      status: 'rejected',
      person_code: cleanId,
      person_name: person.name,
      stall_name: stall_name || 'Counter',
      slot,
      amount,
      reason: `Roster active from ${person.roster_date}`,
    });
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
    await logScanAttempt({
      status: 'rejected',
      person_code: cleanId,
      person_name: person.name,
      stall_name: stall_name || 'Counter',
      slot,
      amount,
      reason: `Over ${slot.toUpperCase()} cap of ₹${slotCap}`,
    });
    return {
      success: false,
      error: `Amount ₹${amount.toLocaleString()} exceeds ${slot.toUpperCase()} cap of ₹${slotCap.toLocaleString()}`,
    };
  }

  // D. Validate Daily Ceiling and Slot Scan Counts (midnight to midnight India Time)
  const todayTxs = transactions.filter(
    (t) =>
      t.person_id === person.id &&
      !t.voided &&
      getIndiaDateString(t.created_at) === todayStr
  );

  const todaySpent = todayTxs.reduce((sum, t) => sum + t.amount, 0);
  const remainingCeiling = Math.max(0, settings.daily_ceiling - todaySpent);

  if (todaySpent + amount > settings.daily_ceiling) {
    await logScanAttempt({
      status: 'rejected',
      person_code: cleanId,
      person_name: person.name,
      stall_name: stall_name || 'Counter',
      slot,
      amount,
      reason: `Over daily ceiling of ₹${settings.daily_ceiling}`,
    });
    return {
      success: false,
      error: `Exceeds daily ceiling of ₹${settings.daily_ceiling}. Today spent: ₹${todaySpent}, Remaining today: ₹${remainingCeiling}`,
    };
  }

  const slotTxs = todayTxs.filter((t) => t.slot === slot);
  const maxSlotScans = settings.slot_max_scans[slot] ?? (slot === 'snacks' || slot === 'beverages' ? 2 : 1);
  if (slotTxs.length >= maxSlotScans) {
    await logScanAttempt({
      status: 'rejected',
      person_code: cleanId,
      person_name: person.name,
      stall_name: stall_name || 'Counter',
      slot,
      amount,
      reason: `Already used ${slot.toUpperCase()} today`,
    });
    return {
      success: false,
      error: `Already used ${slot.toUpperCase()} today (max ${maxSlotScans} scan${maxSlotScans > 1 ? 's' : ''})`,
    };
  }

  // E. Validate Total Event Wallet Balance
  const allValidTxs = transactions.filter((t) => t.person_id === person.id && !t.voided);
  const totalSpent = allValidTxs.reduce((sum, t) => sum + t.amount, 0);
  const remainingWallet = Math.max(0, person.wallet_total - totalSpent);

  if (totalSpent + amount > person.wallet_total) {
    await logScanAttempt({
      status: 'rejected',
      person_code: cleanId,
      person_name: person.name,
      stall_name: stall_name || 'Counter',
      slot,
      amount,
      reason: `Insufficient wallet balance (Remaining ₹${remainingWallet})`,
    });
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

  // Log scan attempt as accepted
  await logScanAttempt({
    status: 'accepted',
    person_code: cleanId,
    person_name: person.name,
    stall_name: stall_name || 'Main Dining Counter (Stall 1)',
    slot,
    amount,
  });

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
      getIndiaDateString(t.created_at) === todayStr
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
    access_code: string;
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
    access_code?: string;
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

  const existingCodes = new Set(
    existingPeople.map((p) => (p.access_code || p.short_code || '').toUpperCase())
  );

  for (const row of rows) {
    // Resolve Access Code (provided or clean auto-generated 6-char)
    let assignedCode = (row.access_code || '').trim().toUpperCase();
    if (!assignedCode) {
      assignedCode = generateCleanAccessCode(existingCodes);
    }
    existingCodes.add(assignedCode);

    // Find duplicate: same phone OR email + same campus OR matching access code
    const dupIdx = updatedPeople.findIndex((p) => {
      const campusMatch = !campus || !p.campus || p.campus === campus;
      if (assignedCode && (p.access_code?.toUpperCase() === assignedCode || p.short_code.toUpperCase() === assignedCode)) return true;
      if (!campusMatch) return false;
      if (row.phone && p.phone && row.phone === p.phone) return true;
      if (row.email && p.email && row.email.toLowerCase() === p.email?.toLowerCase()) return true;
      return false;
    });

    if (dupIdx !== -1) {
      const existing = updatedPeople[dupIdx];

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
        access_code: assignedCode || existing.access_code || existing.short_code,
        short_code: assignedCode || existing.short_code,
      };
      updated++;

      personLinks.push({
        name: updatedPeople[dupIdx].name,
        role: updatedPeople[dupIdx].role,
        short_code: updatedPeople[dupIdx].short_code,
        access_code: updatedPeople[dupIdx].access_code || updatedPeople[dupIdx].short_code,
        token: updatedPeople[dupIdx].token,
        wallet_total: updatedPeople[dupIdx].wallet_total,
        campus,
        phone: updatedPeople[dupIdx].phone,
        email: updatedPeople[dupIdx].email,
      });
    } else {
      // New person
      const token = generateSecureToken(row.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 10));
      const newPerson: Person = {
        id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: row.name,
        role: row.role,
        phone: row.phone,
        email: row.email,
        access_code: assignedCode,
        short_code: assignedCode,
        wallet_total: row.wallet_amount,
        token,
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
        access_code: assignedCode,
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
