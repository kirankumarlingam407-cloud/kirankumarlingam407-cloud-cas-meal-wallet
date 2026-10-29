import { VendorAccount, VendorAccountRole, AuthSession } from '@/types';
import { getVendorAccounts, storeEvents } from './store';

const AUTH_STORAGE_KEY = 'cas_auth_session_v2';

export const getSession = (): AuthSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch (e) {
    return null;
  }
};

export const setSession = (user: VendorAccount, remember = true): AuthSession => {
  const session: AuthSession = {
    user,
    token: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    login_at: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    const serialized = JSON.stringify(session);
    if (remember) {
      localStorage.setItem(AUTH_STORAGE_KEY, serialized);
    }
    sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);

    // Also sync admin unlock token for backward compatibility
    if (user.role === 'admin') {
      sessionStorage.setItem('cas_admin_unlocked', '1');
    }
    storeEvents.emit('auth_changed', session);
  }

  return session;
};

export const logout = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem('cas_admin_unlocked');
    storeEvents.emit('auth_changed', null);
  }
};

export const login = async (
  usernameInput: string,
  passwordInput: string,
  tab: 'admin' | 'vendor'
): Promise<{ success: boolean; error?: string; user?: VendorAccount; redirectUrl?: string }> => {
  const username = usernameInput.trim();
  const password = passwordInput.trim();

  if (!username) {
    return { success: false, error: 'Please enter your username.' };
  }
  if (!password) {
    return { success: false, error: 'Please enter your password.' };
  }

  const accounts = await getVendorAccounts();

  // 1. CAS ADMIN TAB
  if (tab === 'admin') {
    // Check master admin password or stored admin account
    const adminAcc = accounts.find(
      (a) => a.role === 'admin' && (a.username.toLowerCase() === username.toLowerCase() || username.toLowerCase() === 'admin')
    );

    if ((adminAcc && adminAcc.password === password) || (username.toLowerCase() === 'admin' && password === 'CAS@960387')) {
      const user: VendorAccount = adminAcc || {
        id: 'acc-admin',
        username: 'admin',
        name: 'CAS Placement Operations',
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
      };
      setSession(user, true);
      return { success: true, user, redirectUrl: '/admin' };
    }

    return {
      success: false,
      error: 'Invalid CAS Admin credentials. Please check your username and password.',
    };
  }

  // 2. BLUE SPRING TAB (Manager or Cashier)
  const matchedAcc = accounts.find(
    (a) => a.username.toLowerCase() === username.toLowerCase() && a.password === password
  );

  if (!matchedAcc) {
    return {
      success: false,
      error: 'Invalid credentials. Please verify your Blue Spring account details.',
    };
  }

  if (!matchedAcc.is_active) {
    return {
      success: false,
      error: 'This account has been deactivated. Please contact CAS Admin.',
    };
  }

  if (matchedAcc.role === 'admin') {
    return {
      success: false,
      error: 'Admin account detected. Please use the "CAS Admin" login tab.',
    };
  }

  setSession(matchedAcc, true);

  if (matchedAcc.role === 'vendor') {
    return { success: true, user: matchedAcc, redirectUrl: '/vendor' };
  }

  if (matchedAcc.role === 'cashier') {
    return { success: true, user: matchedAcc, redirectUrl: '/scan' };
  }

  return { success: true, user: matchedAcc, redirectUrl: '/vendor' };
};
