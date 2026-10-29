'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { RosterUploadModal } from '@/components/RosterUploadModal';
import { 
  getSettings, 
  updateSettings, 
  getPeople, 
  getTransactions, 
  getFlags, 
  voidTransaction, 
  resolveFlag, 
  importPeopleFromCSV, 
  exportBillingCSV, 
  generateBillingSummary,
  getRosterHistory,
  getStalls,
  createStall,
  deleteStall,
  getVendorAccounts,
  createVendorAccount,
  deleteVendorAccount,
  storeEvents 
} from '@/lib/store';
import { Settings, Person, Transaction, Flag, MealSlot, DailyBillingRow, RosterUploadHistory, Stall, VendorAccount, VendorAccountRole } from '@/types';
import { 
  ShieldCheck, 
  BarChart3, 
  Users, 
  ListFilter, 
  AlertTriangle, 
  Download, 
  Upload, 
  Settings as SettingsIcon, 
  Store, 
  Ban, 
  Search, 
  CheckCircle2, 
  ExternalLink, 
  FileSpreadsheet, 
  Plus, 
  RefreshCw,
  X,
  Trash2,
  Key,
  UserPlus
} from 'lucide-react';
import Link from 'next/link';

const ADMIN_PASSWORD = 'CAS@960387';

export default function AdminDashboardPage() {
  // ── Password Gate ────────────────────────────────────────────────────────
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [gatePassword, setGatePassword] = useState<string>('');
  const [gateError, setGateError] = useState<string>('');
  const [gateShake, setGateShake] = useState<boolean>(false);
  const pwInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Persist unlock within the browser session
    if (typeof window !== 'undefined' && sessionStorage.getItem('cas_admin_unlocked') === '1') {
      setUnlocked(true);
    }
  }, []);

  function handleGateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (gatePassword === ADMIN_PASSWORD) {
      sessionStorage.setItem('cas_admin_unlocked', '1');
      setUnlocked(true);
      setGateError('');
    } else {
      setGateError('Incorrect password. Please try again.');
      setGateShake(true);
      setTimeout(() => setGateShake(false), 600);
      setGatePassword('');
      setTimeout(() => pwInputRef.current?.focus(), 50);
    }
  }

  // ── Main Page State ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'people' | 'vendor-accounts' | 'billing' | 'upload-history' | 'settings'>('overview');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [vendorAccounts, setVendorAccounts] = useState<VendorAccount[]>([]);
  const [billingSummary, setBillingSummary] = useState<{
    rows: DailyBillingRow[];
    totalAmount: number;
    totalTransactions: number;
  }>({ rows: [], totalAmount: 0, totalTransactions: 0 });
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [txSearch, setTxSearch] = useState<string>('');
  const [txSlotFilter, setTxSlotFilter] = useState<string>('all');
  const [peopleSearch, setPeopleSearch] = useState<string>('');
  const [peopleRoleFilter, setPeopleRoleFilter] = useState<string>('all');

  // Void modal state
  const [voidingTx, setVoidingTx] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');
  const [voidSubmitting, setVoidSubmitting] = useState<boolean>(false);

  // CSV Import modal state (legacy)
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [csvInput, setCsvInput] = useState<string>(
    'Name,Role,Phone,Email,Wallet Amount\n'
  );
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Roster Upload Modal
  const [showRosterModal, setShowRosterModal] = useState<boolean>(false);
  const [rosterHistory, setRosterHistory] = useState<RosterUploadHistory[]>([]);
  const [rosterSuccessBanner, setRosterSuccessBanner] = useState<string>('');

  // Vendor Accounts & Stalls Modals State
  const [showCreateStallModal, setShowCreateStallModal] = useState<boolean>(false);
  const [newStallName, setNewStallName] = useState<string>('');
  const [newStallCampus, setNewStallCampus] = useState<string>('Hyderabad');
  const [stallSubmitting, setStallSubmitting] = useState<boolean>(false);

  const [showCreateAccountModal, setShowCreateAccountModal] = useState<boolean>(false);
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccUsername, setNewAccUsername] = useState<string>('');
  const [newAccPassword, setNewAccPassword] = useState<string>('');
  const [newAccRole, setNewAccRole] = useState<VendorAccountRole>('vendor');
  const [newAccStall, setNewAccStall] = useState<string>('');
  const [newAccCampus, setNewAccCampus] = useState<string>('Hyderabad');
  const [accountSubmitting, setAccountSubmitting] = useState<boolean>(false);
  const [accountRoleFilter, setAccountRoleFilter] = useState<string>('all');

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<Settings | null>(null);
  const [settingsSaved, setSettingsSaved] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const [s, p, txs, f, b, st, acc] = await Promise.all([
        getSettings(),
        getPeople(),
        getTransactions(),
        getFlags(),
        generateBillingSummary(),
        getStalls(),
        getVendorAccounts(),
      ]);
      setSettings(s);
      setSettingsForm(s);
      setPeople(p);
      setTransactions(txs);
      setFlags(f);
      setBillingSummary(b);
      setStalls(st);
      setVendorAccounts(acc);
      setRosterHistory(getRosterHistory());
      if (st.length > 0 && !newAccStall) {
        setNewAccStall(st[0].name);
      }
    } catch (e) {
      console.error('Error fetching admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    storeEvents.addEventListener('transaction_created', handleUpdate);
    storeEvents.addEventListener('transaction_voided', handleUpdate);
    storeEvents.addEventListener('flags_updated', handleUpdate);
    storeEvents.addEventListener('people_updated', handleUpdate);
    storeEvents.addEventListener('settings_updated', handleUpdate);
    storeEvents.addEventListener('roster_uploaded', handleUpdate);
    storeEvents.addEventListener('stalls_updated', handleUpdate);
    storeEvents.addEventListener('vendor_accounts_updated', handleUpdate);

    return () => {
      storeEvents.removeEventListener('transaction_created', handleUpdate);
      storeEvents.removeEventListener('transaction_voided', handleUpdate);
      storeEvents.removeEventListener('flags_updated', handleUpdate);
      storeEvents.removeEventListener('people_updated', handleUpdate);
      storeEvents.removeEventListener('settings_updated', handleUpdate);
      storeEvents.removeEventListener('roster_uploaded', handleUpdate);
      storeEvents.removeEventListener('stalls_updated', handleUpdate);
      storeEvents.removeEventListener('vendor_accounts_updated', handleUpdate);
    };
  }, []);

  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Compute live overview metrics safely after mount
  const startOfTodayMs = isMounted ? new Date().setHours(0, 0, 0, 0) : 0;

  const validTxs = transactions.filter((t) => !t.voided);
  const todayTxs = validTxs.filter(
    (t) => isMounted && new Date(t.created_at).getTime() >= startOfTodayMs
  );

  const spendToday = todayTxs.reduce((sum, t) => sum + t.amount, 0);
  const spendTotal = validTxs.reduce((sum, t) => sum + t.amount, 0);
  const activeFlagsCount = flags.filter((f) => !f.resolved).length;

  // By slot breakdown today
  const slotSpendToday = (['breakfast', 'lunch', 'snacks', 'beverages', 'dinner'] as MealSlot[]).map((slot) => {
    const list = todayTxs.filter((t) => t.slot === slot);
    const total = list.reduce((sum, t) => sum + t.amount, 0);
    return { slot, total, count: list.length };
  });

  // Handle Void
  const handleConfirmVoid = async () => {
    if (!voidingTx || !voidReason.trim()) {
      alert('Please provide a mandatory reason for voiding this transaction.');
      return;
    }
    setVoidSubmitting(true);
    try {
      await voidTransaction(voidingTx.id, voidReason.trim(), 'CAS Admin');
      setVoidingTx(null);
      setVoidReason('');
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to void transaction');
    } finally {
      setVoidSubmitting(false);
    }
  };

  // Handle Resolve Flag
  const handleResolveFlag = async (flagId: string) => {
    await resolveFlag(flagId);
    await loadData();
  };

  // Handle CSV Import
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvInput.trim()) return;
    try {
      const count = await importPeopleFromCSV(csvInput);
      setImportStatus(`Successfully onboarded ${count} new persons with secure tokens & short codes!`);
      setTimeout(() => {
        setShowImportModal(false);
        setImportStatus(null);
        loadData();
      }, 2000);
    } catch (err: any) {
      alert(err?.message || 'Error parsing CSV');
    }
  };

  // Handle Download CSV
  const handleDownloadBillingCSV = async () => {
    const csv = await exportBillingCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CAS-BlueSpring-Billing-Placements-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle Settings Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm) return;
    await updateSettings(settingsForm);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
    loadData();
  };

  // Handle Create Stall
  const handleCreateStall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStallName.trim()) return;
    setStallSubmitting(true);
    try {
      await createStall({
        name: newStallName.trim(),
        campus: newStallCampus,
        vendor_name: 'Blue Spring Catering',
      });
      setShowCreateStallModal(false);
      setNewStallName('');
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Error creating stall');
    } finally {
      setStallSubmitting(false);
    }
  };

  const handleDeleteStall = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete stall "${name}"?`)) {
      await deleteStall(id);
      await loadData();
    }
  };

  // Handle Create Vendor / Cashier Account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccUsername.trim() || !newAccPassword.trim() || !newAccName.trim()) {
      alert('Please fill in username, password, and full name.');
      return;
    }
    setAccountSubmitting(true);
    try {
      await createVendorAccount({
        username: newAccUsername.trim().toLowerCase(),
        password: newAccPassword.trim(),
        name: newAccName.trim(),
        role: newAccRole,
        stall_name: newAccRole === 'cashier' ? newAccStall : undefined,
        campus: newAccCampus,
        is_active: true,
      });
      setShowCreateAccountModal(false);
      setNewAccName('');
      setNewAccUsername('');
      setNewAccPassword('');
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Error creating account');
    } finally {
      setAccountSubmitting(false);
    }
  };

  const handleDeleteAccount = async (id: string, username: string) => {
    if (confirm(`Are you sure you want to delete account "${username}"?`)) {
      await deleteVendorAccount(id);
      await loadData();
    }
  };

  // Filtered lists
  const filteredTxs = transactions.filter((t) => {
    const matchesSearch = 
      t.person?.name.toLowerCase().includes(txSearch.toLowerCase()) ||
      t.person?.short_code.toLowerCase().includes(txSearch.toLowerCase()) ||
      t.bill_no?.toLowerCase().includes(txSearch.toLowerCase()) ||
      t.stall_name.toLowerCase().includes(txSearch.toLowerCase());
    const matchesSlot = txSlotFilter === 'all' || t.slot === txSlotFilter;
    return matchesSearch && matchesSlot;
  });

  const filteredPeople = people.filter((p) => {
    const matchesSearch = 
      p.name.toLowerCase().includes(peopleSearch.toLowerCase()) ||
      p.short_code.toLowerCase().includes(peopleSearch.toLowerCase()) ||
      p.email?.toLowerCase().includes(peopleSearch.toLowerCase());
    const matchesRole = peopleRoleFilter === 'all' || p.role === peopleRoleFilter;
    return matchesSearch && matchesRole;
  });

  // ── Password Gate UI ─────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <form
          onSubmit={handleGateSubmit}
          className={`relative z-10 w-full max-w-sm bg-white border border-gray-200 rounded-3xl p-8 shadow-xl space-y-6 ${gateShake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
          style={gateShake ? { animation: 'shake 0.5s ease-in-out' } : {}}
        >
          {/* Brand */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-[#2F6DB5]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">CAS Admin Portal</h1>
              <p className="text-xs text-gray-500 mt-0.5">ISB PGP Placements · Meal Wallet System</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Password field */}
          <div className="space-y-2">
            <label htmlFor="admin-password" className="text-xs font-bold text-gray-600 uppercase tracking-wider">
              Admin Password
            </label>
            <input
              id="admin-password"
              ref={pwInputRef}
              type="password"
              autoFocus
              autoComplete="current-password"
              value={gatePassword}
              onChange={(e) => { setGatePassword(e.target.value); setGateError(''); }}
              placeholder="Enter password to continue"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-[#2F6DB5] focus:ring-2 focus:ring-[#2F6DB5]/20 transition"
            />
            {gateError && (
              <p className="text-red-600 text-xs flex items-center gap-1.5 font-medium">
                <Ban className="w-3.5 h-3.5 flex-shrink-0" />
                {gateError}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!gatePassword}
            className="w-full py-3 rounded-xl font-bold text-sm bg-[#2F6DB5] hover:bg-[#255a96] disabled:bg-gray-200 disabled:text-gray-400 text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]/50 shadow-sm"
          >
            Enter Dashboard
          </button>

          <p className="text-center text-xs text-gray-400">
            Restricted access · CAS authorised personnel only
          </p>
        </form>

        {/* Shake keyframes injected inline */}
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            15%        { transform: translateX(-8px); }
            30%        { transform: translateX(8px); }
            45%        { transform: translateX(-6px); }
            60%        { transform: translateX(6px); }
            75%        { transform: translateX(-3px); }
            90%        { transform: translateX(3px); }
          }
        `}</style>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-[#2F6DB5] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-600 text-sm font-medium">Loading CAS Operations Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Header Title & Quick Export */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-blue-50 text-[#2F6DB5] border border-blue-200">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  CAS Placement Operations Center
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <p className="text-xs text-gray-500">
                    ISB PGP Placements 2026 • Food Spend Reconciliation & Blue Spring Audit
                  </p>
                  <span className="inline-flex items-center space-x-1.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span className="tracking-wide uppercase font-black text-[9px]">REAL TIME CONNECTED</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => setShowRosterModal(true)}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#2F6DB5] hover:bg-[#255a96] text-white font-bold text-xs shadow-sm transition-all active:scale-98"
            >
              <Upload className="w-4 h-4 stroke-[2.5]" />
              <span>Upload Wallet Roster</span>
            </button>

            <button
              onClick={handleDownloadBillingCSV}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs border border-gray-300 shadow-2xs transition-all active:scale-98"
            >
              <Download className="w-4 h-4 stroke-[2.5] text-gray-500" />
              <span>Export Billing CSV</span>
            </button>
          </div>
        </div>

        {/* Top Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Spend Today
            </span>
            <div className="text-2xl sm:text-3xl font-black text-[#2F6DB5] font-mono tracking-tight">
              ₹{spendToday.toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-gray-500 mt-1 block">
              {todayTxs.length} valid scans today
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Spend to Date
            </span>
            <div className="text-2xl sm:text-3xl font-black text-gray-900 font-mono tracking-tight">
              ₹{spendTotal.toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-gray-500 mt-1 block">
              {validTxs.length} total event scans
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Enrolled Personnel
            </span>
            <div className="text-2xl sm:text-3xl font-black text-gray-900 font-mono tracking-tight">
              {people.length}
            </div>
            <span className="text-[11px] text-gray-500 mt-1 block">
              Coordinators, Drivers & CAS Staff
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Total Scans
            </span>
            <div className="text-2xl sm:text-3xl font-black text-gray-900 font-mono tracking-tight">
              {validTxs.length}
            </div>
            <span className="text-[11px] text-gray-500 mt-1 block">
              {todayTxs.length} scans recorded today
            </span>
          </div>
        </div>

        {/* Roster Success Banner */}
        {rosterSuccessBanner && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3 text-sm text-[#2F6DB5] font-semibold animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle2 className="w-5 h-5 text-[#2F6DB5] flex-shrink-0" />
            {rosterSuccessBanner}
            <button onClick={() => setRosterSuccessBanner('')} className="ml-auto text-gray-400 hover:text-gray-700 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 flex items-center space-x-2 overflow-x-auto pb-1">
          {[
            { id: 'overview', label: 'Overview & Slot Spend', icon: BarChart3 },
            { id: 'transactions', label: `Transactions (${transactions.length})`, icon: ListFilter },
            { id: 'people', label: `People & Wallets (${people.length})`, icon: Users },
            { id: 'vendor-accounts', label: `Vendor Accounts (${stalls.length})`, icon: Store },
            { id: 'billing', label: 'Billing Reconciliation', icon: FileSpreadsheet },
            { id: 'upload-history', label: `Upload History (${rosterHistory.length})`, icon: Upload },
            { id: 'settings', label: 'Rules & Caps Settings', icon: SettingsIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#2F6DB5] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ============================================================================== */}
        {/* TAB 1: OVERVIEW & SLOT SPEND */}
        {/* ============================================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* By Slot Spend Cards */}
            <div>
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                Today's Meal Slot Breakdown
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {slotSpendToday.map((item) => (
                  <div key={item.slot} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                      {item.slot}
                    </span>
                    <div className="text-xl font-black text-gray-900 font-mono">
                      ₹{item.total.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      {item.count} scan{item.count === 1 ? '' : 's'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Vendor Stalls Breakdown */}
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center space-x-2">
                <Store className="w-4 h-4 text-[#2F6DB5]" />
                <span>Vendor Stalls & Settlement Log</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Main Dining Counter (Stall 1)</h4>
                      <p className="text-xs text-gray-500">Blue Spring Catering • Executive Dining Hall</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Active</span>
                  </div>
                  <div className="mt-3 text-xs text-gray-600">
                    Primary counter for Breakfast, Lunch & Dinner service.
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Atrium Beverage & Snack Bar (Stall 2)</h4>
                      <p className="text-xs text-gray-500">Blue Spring Express • Recruiter Lounge</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Active</span>
                  </div>
                  <div className="mt-3 text-xs text-gray-600">
                    Express counter for tea, coffee, cookies & light snacks (max 2 scans per slot rule).
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB 2: TRANSACTIONS FEED (WITH VOID CAPABILITY) */}
        {/* ============================================================================== */}
        {activeTab === 'transactions' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by person name, short code, bill number, stall..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2F6DB5] focus:ring-2 focus:ring-[#2F6DB5]/20"
                />
              </div>

              <select
                value={txSlotFilter}
                onChange={(e) => setTxSlotFilter(e.target.value)}
                className="bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-[#2F6DB5] focus:ring-2 focus:ring-[#2F6DB5]/20"
              >
                <option value="all">All Meal Slots</option>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="snacks">Snacks</option>
                <option value="beverages">Beverages</option>
                <option value="dinner">Dinner</option>
              </select>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4">Time & Date</th>
                      <th className="py-3 px-4">Person</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Slot</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Bill #</th>
                      <th className="py-3 px-4">Stall</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 font-medium">
                    {filteredTxs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-gray-400">
                          No transactions found matching filters.
                        </td>
                      </tr>
                    ) : (
                      filteredTxs.map((t, idx) => (
                        <tr key={t.id} className={t.voided ? 'bg-gray-50 opacity-60' : idx % 2 === 1 ? 'bg-gray-50/50 hover:bg-blue-50/40' : 'bg-white hover:bg-blue-50/40'}>
                          <td className="py-3 px-4 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                            {new Date(t.created_at).toLocaleString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4 font-bold text-gray-900 whitespace-nowrap">
                            {t.person?.name || 'Cardholder'}
                            <span className="text-[10px] font-mono text-[#2F6DB5] ml-1.5 font-bold">
                              #{t.person?.short_code}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                            {t.person?.role || 'Coordinator'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-blue-50 text-[#2F6DB5] border border-blue-200">
                              {t.slot}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-black font-mono text-sm whitespace-nowrap">
                            <span className={t.voided ? 'line-through text-gray-400' : 'text-gray-900'}>
                              ₹{t.amount.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                            {t.bill_no || '—'}
                          </td>
                          <td className="py-3 px-4 text-gray-600 text-[11px] truncate max-w-[160px]">
                            {t.stall_name}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {t.voided ? (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200" title={t.void_reason}>
                                VOIDED
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                VALID
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {!t.voided ? (
                              <button
                                onClick={() => setVoidingTx(t)}
                                className="inline-flex items-center space-x-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition-colors"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>Void</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-400 italic">Audit Logged</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB 3: PEOPLE & WALLETS (IMPORT CSV & QR PRINT SHEET) */}
        {/* ============================================================================== */}
        {activeTab === 'people' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name, short code, email..."
                  value={peopleSearch}
                  onChange={(e) => setPeopleSearch(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2F6DB5] focus:ring-2 focus:ring-[#2F6DB5]/20"
                />
              </div>

              <select
                value={peopleRoleFilter}
                onChange={(e) => setPeopleRoleFilter(e.target.value)}
                className="bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-[#2F6DB5] focus:ring-2 focus:ring-[#2F6DB5]/20"
              >
                <option value="all">All Roles</option>
                <option value="Interview Coordinator">Interview Coordinator</option>
                <option value="Driver">Driver</option>
                <option value="CAS Staff">CAS Staff</option>
                <option value="Student Volunteer">Student Volunteer</option>
              </select>

              <button
                onClick={() => setShowRosterModal(true)}
                className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#2F6DB5] hover:bg-[#255a96] text-white font-bold text-xs shadow-sm transition-colors whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Wallet Roster</span>
              </button>
            </div>

            {/* People Table */}
            <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4">Short Code</th>
                      <th className="py-3 px-4">Name & Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Wallet Total</th>
                      <th className="py-3 px-4">Total Spent</th>
                      <th className="py-3 px-4">Remaining Balance</th>
                      <th className="py-3 px-4 text-right">Personal Pass Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 font-medium">
                    {filteredPeople.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-400">
                          No personnel enrolled yet. Click &quot;Upload Wallet Roster&quot; above to import your placement roster.
                        </td>
                      </tr>
                    ) : (
                      filteredPeople.map((p, idx) => {
                      const personValidTxs = transactions.filter(
                        (t) => t.person_id === p.id && !t.voided
                      );
                      const spent = personValidTxs.reduce((sum, t) => sum + t.amount, 0);
                      const balance = Math.max(0, p.wallet_total - spent);

                      return (
                        <tr key={p.id} className={idx % 2 === 1 ? 'bg-gray-50/50 hover:bg-blue-50/40' : 'bg-white hover:bg-blue-50/40'}>
                          <td className="py-3 px-4 font-mono font-bold text-[#2F6DB5]">
                            #{p.short_code}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-gray-900">{p.name}</div>
                            {p.email && <div className="text-[10px] text-gray-400">{p.email}</div>}
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#2F6DB5] font-semibold">
                              {p.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-gray-800">
                            ₹{p.wallet_total.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-500">
                            ₹{spent.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 font-mono font-black text-sm text-emerald-600">
                            ₹{balance.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              href={`/w/${p.token}`}
                              target="_blank"
                              className="inline-flex items-center space-x-1 text-xs text-[#2F6DB5] hover:underline font-bold"
                            >
                              <span>Open Wallet</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB 4: VENDOR ACCOUNTS & STALLS */}
        {/* ============================================================================== */}
        {activeTab === 'vendor-accounts' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Top Information Card */}
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <Store className="w-5 h-5 text-[#2F6DB5]" />
                  <span>Vendor Accounts &amp; Stall Allocation</span>
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Configure Blue Spring catering counters, manager accounts, and cashier accounts locked to specific stalls.
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateStallModal(true)}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 text-gray-800 font-bold text-xs border border-gray-300 shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#2F6DB5]" />
                  <span>Create Stall</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCreateAccountModal(true)}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#2F6DB5] hover:bg-[#255a96] text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                </button>
              </div>
            </div>

            {/* SECTION 1: STALLS MANAGEMENT */}
            <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Configured Catering Stalls ({stalls.length})</h4>
                  <p className="text-[11px] text-gray-500">Physical dining counters &amp; cafes where staff and coordinators can scan passes.</p>
                </div>
                <button
                  onClick={() => setShowCreateStallModal(true)}
                  className="text-xs font-bold text-[#2F6DB5] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Stall</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4">Stall Name</th>
                      <th className="py-3 px-4">Campus</th>
                      <th className="py-3 px-4">Vendor Partner</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 font-medium">
                    {stalls.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400">
                          No stalls created yet. Click &quot;Create Stall&quot; to configure your first catering stall.
                        </td>
                      </tr>
                    ) : (
                      stalls.map((s, idx) => (
                        <tr key={s.id} className={idx % 2 === 1 ? 'bg-gray-50/50 hover:bg-blue-50/40' : 'bg-white hover:bg-blue-50/40'}>
                          <td className="py-3.5 px-4 font-bold text-gray-900">
                            {s.name}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#2F6DB5] font-semibold text-[11px]">
                              {s.campus}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-gray-600">
                            {s.vendor_name || 'Blue Spring Catering'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-[10px]">
                              Active
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleDeleteStall(s.id, s.name)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Delete stall"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 2: VENDOR & CASHIER ACCOUNTS */}
            <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Authentication Accounts ({vendorAccounts.length})</h4>
                  <p className="text-[11px] text-gray-500">
                    Managers log in to <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">/vendor</code> for live views. Cashiers log in to <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">/scan</code> only.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    value={accountRoleFilter}
                    onChange={(e) => setAccountRoleFilter(e.target.value)}
                    className="bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]"
                  >
                    <option value="all">All Roles</option>
                    <option value="vendor">Blue Spring Managers</option>
                    <option value="cashier">Stall Cashiers</option>
                    <option value="admin">CAS Admins</option>
                  </select>

                  <button
                    onClick={() => setShowCreateAccountModal(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#2F6DB5] text-white text-xs font-bold hover:bg-[#255a96] transition cursor-pointer shadow-xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>New Account</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4">Account Name &amp; Username</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Assigned Stall / Scope</th>
                      <th className="py-3 px-4">Campus</th>
                      <th className="py-3 px-4">Target Login Portal</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 font-medium">
                    {vendorAccounts
                      .filter((acc) => accountRoleFilter === 'all' || acc.role === accountRoleFilter)
                      .map((acc, idx) => (
                        <tr key={acc.id} className={idx % 2 === 1 ? 'bg-gray-50/50 hover:bg-blue-50/40' : 'bg-white hover:bg-blue-50/40'}>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-900">{acc.name}</div>
                            <div className="text-[11px] font-mono text-gray-400">@{acc.username}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            {acc.role === 'admin' ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 font-bold text-[10px]">
                                CAS Admin
                              </span>
                            ) : acc.role === 'vendor' ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#2F6DB5] font-bold text-[10px]">
                                Blue Spring Manager
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px]">
                                Stall Cashier
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-gray-700">
                            {acc.role === 'cashier' ? (
                              <span className="font-semibold text-gray-900 flex items-center gap-1">
                                <Store className="w-3.5 h-3.5 text-[#2F6DB5]" />
                                <span>{acc.stall_name || 'All Stalls'}</span>
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">All Stalls Access</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-gray-600">
                            {acc.campus || 'Hyderabad'}
                          </td>
                          <td className="py-3.5 px-4">
                            {acc.role === 'cashier' ? (
                              <span className="text-emerald-700 font-mono text-[11px] font-semibold">/scan only</span>
                            ) : acc.role === 'vendor' ? (
                              <span className="text-[#2F6DB5] font-mono text-[11px] font-semibold">/vendor</span>
                            ) : (
                              <span className="text-purple-700 font-mono text-[11px] font-semibold">/admin</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {acc.username !== 'admin' && (
                              <button
                                onClick={() => handleDeleteAccount(acc.id, acc.username)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                title="Delete account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB 3b: UPLOAD HISTORY */}
        {/* ============================================================================== */}
        {activeTab === 'upload-history' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                <div>
                  <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#2F6DB5]" />
                    Roster Upload History
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">All .xlsx wallet roster uploads by CAS admins</p>
                </div>
                <button
                  onClick={() => setShowRosterModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2F6DB5] hover:bg-[#255a96] text-white text-xs font-bold transition shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  New Upload
                </button>
              </div>
              {rosterHistory.length === 0 ? (
                <div className="py-14 text-center text-gray-400">
                  <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="font-semibold text-gray-700">No uploads yet</p>
                  <p className="text-xs mt-1">Click "Upload Wallet Roster" to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-700">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <tr>
                        <th className="py-3 px-4">Active From Date</th>
                        <th className="py-3 px-4">Campus</th>
                        <th className="py-3 px-4">File Name</th>
                        <th className="py-3 px-4">Added</th>
                        <th className="py-3 px-4">Updated</th>
                        <th className="py-3 px-4">Skipped</th>
                        <th className="py-3 px-4">Uploaded By</th>
                        <th className="py-3 px-4">Uploaded At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {rosterHistory.map((h, idx) => (
                        <tr key={h.id} className={idx % 2 === 1 ? 'bg-gray-50/50 hover:bg-blue-50/40' : 'bg-white hover:bg-blue-50/40'}>
                          <td className="py-3 px-4 font-mono font-bold text-gray-900">{h.upload_date}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#2F6DB5] text-[10px] font-semibold">
                              {h.campus}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-700 max-w-[180px] truncate" title={h.file_name}>{h.file_name}</td>
                          <td className="py-3 px-4 font-bold text-emerald-600">{h.added}</td>
                          <td className="py-3 px-4 font-bold text-amber-600">{h.updated}</td>
                          <td className="py-3 px-4 text-gray-400">{h.skipped}</td>
                          <td className="py-3 px-4 text-gray-600">{h.uploaded_by}</td>
                          <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                            {new Date(h.uploaded_at).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}



        {/* ============================================================================== */}
        {/* TAB 5: BILLING RECONCILIATION (OFFICIAL CSV EXPORT) */}
        {/* ============================================================================== */}
        {activeTab === 'billing' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-gray-900">
                    Official Vendor Settlement Statement
                  </h3>
                  <p className="text-xs text-gray-500">
                    Payable to Blue Spring exclusively based on digital, non-voided placement transactions.
                  </p>
                </div>

                <button
                  onClick={handleDownloadBillingCSV}
                  className="flex items-center space-x-2 px-5 py-3 rounded-2xl bg-[#2F6DB5] hover:bg-[#255a96] text-white font-bold text-xs shadow-sm transition-all active:scale-98"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Download Billing CSV</span>
                </button>
              </div>

              {/* Total Payable Summary Box */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Net Authorized CAS Payout
                  </span>
                  <div className="text-3xl font-black text-emerald-600 font-mono tracking-tight mt-0.5">
                    ₹{billingSummary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 font-medium">Valid Transactions</span>
                  <div className="text-xl font-bold text-gray-900 font-mono">
                    {billingSummary.totalTransactions} scans
                  </div>
                </div>
              </div>

              {/* Day & Slot Grouped Table */}
              <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Meal Slot</th>
                      <th className="py-3 px-4">Vendor & Stall</th>
                      <th className="py-3 px-4">Scan Count</th>
                      <th className="py-3 px-4 text-right">Payable Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 font-medium">
                    {billingSummary.rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-gray-400">
                          No billing records recorded yet.
                        </td>
                      </tr>
                    ) : (
                      billingSummary.rows.map((r, i) => (
                        <tr key={i} className={i % 2 === 1 ? 'bg-gray-50/50 hover:bg-blue-50/40' : 'bg-white hover:bg-blue-50/40'}>
                          <td className="py-3 px-4 font-mono text-gray-500">{r.date}</td>
                          <td className="py-3 px-4 font-bold text-[#2F6DB5]">{r.slot}</td>
                          <td className="py-3 px-4 text-gray-700">{r.stall_name}</td>
                          <td className="py-3 px-4 font-mono">{r.transaction_count}</td>
                          <td className="py-3 px-4 text-right font-black font-mono text-gray-900 text-sm">
                            ₹{r.total_amount.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB 6: SETTINGS (WALLET RULES CONFIGURATOR) */}
        {/* ============================================================================== */}
        {activeTab === 'settings' && settingsForm && (
          <div className="animate-in fade-in duration-150">
            <form onSubmit={handleSaveSettings} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                <div>
                  <h3 className="font-bold text-base text-gray-900">Placement Wallet Policy Settings</h3>
                  <p className="text-xs text-gray-500">Configure event duration, caps, and anomaly detection rules</p>
                </div>
                {settingsSaved && (
                  <span className="flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Saved Successfully!
                  </span>
                )}
              </div>

              {/* Event Dates & Daily Ceiling */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Event Start Date
                  </label>
                  <input
                    type="date"
                    value={settingsForm.start_date}
                    onChange={(e) => setSettingsForm({ ...settingsForm, start_date: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#2F6DB5] focus:ring-2 focus:ring-[#2F6DB5]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Event End Date
                  </label>
                  <input
                    type="date"
                    value={settingsForm.end_date}
                    onChange={(e) => setSettingsForm({ ...settingsForm, end_date: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#2F6DB5] focus:ring-2 focus:ring-[#2F6DB5]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Daily Ceiling (₹ per person)
                  </label>
                  <input
                    type="number"
                    value={settingsForm.daily_ceiling}
                    onChange={(e) => setSettingsForm({ ...settingsForm, daily_ceiling: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#2F6DB5] focus:ring-2 focus:ring-[#2F6DB5]/20"
                  />
                </div>
              </div>

              {/* Slot Caps & Scan Count Limits */}
              <div>
                <h4 className="text-xs font-extrabold text-[#2F6DB5] uppercase tracking-wider mb-2">
                  Per-Slot Caps (₹) & Max Allowed Scans / Day
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  {(['breakfast', 'lunch', 'snacks', 'beverages', 'dinner'] as MealSlot[]).map((slot) => (
                    <div key={slot} className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2">
                      <span className="text-[11px] font-black uppercase text-gray-800 block">
                        {slot}
                      </span>
                      <div>
                        <label className="block text-[10px] text-gray-500">Cap (₹)</label>
                        <input
                          type="number"
                          value={settingsForm.slot_caps[slot]}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              slot_caps: {
                                ...settingsForm.slot_caps,
                                [slot]: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-[#2F6DB5] font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-500">Max Scans / Day</label>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={settingsForm.slot_max_scans[slot]}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              slot_max_scans: {
                                ...settingsForm.slot_max_scans,
                                [slot]: parseInt(e.target.value) || 1,
                              },
                            })
                          }
                          className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-800 font-bold"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Anomaly Detection Rules */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Slot Anomaly Threshold (% above daily slot average)
                  </label>
                  <input
                    type="number"
                    value={settingsForm.flag_anomaly_pct}
                    onChange={(e) => setSettingsForm({ ...settingsForm, flag_anomaly_pct: parseFloat(e.target.value) || 30 })}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#2F6DB5] focus:ring-2 focus:ring-[#2F6DB5]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Rapid Scan Window (Minutes for &gt; 2 scans flag)
                  </label>
                  <input
                    type="number"
                    value={settingsForm.frequent_scan_window_mins}
                    onChange={(e) => setSettingsForm({ ...settingsForm, frequent_scan_window_mins: parseInt(e.target.value) || 10 })}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#2F6DB5] focus:ring-2 focus:ring-[#2F6DB5]/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="py-3 px-6 rounded-2xl bg-[#2F6DB5] hover:bg-[#255a96] text-white font-bold text-xs shadow-sm transition-all"
              >
                Save Settings
              </button>
            </form>
          </div>
        )}

      </main>

      {/* Void Modal */}
      {voidingTx && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-bold">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Void Transaction</h3>
                <p className="text-xs text-gray-500">Revert charge & restore wallet balance</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Cardholder:</span>
                <span className="font-bold text-gray-900">{voidingTx.person?.name} (#{voidingTx.person?.short_code})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount:</span>
                <span className="font-black text-[#2F6DB5]">₹{voidingTx.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Slot & Stall:</span>
                <span className="text-gray-700">{voidingTx.slot.toUpperCase()} • {voidingTx.stall_name}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Mandatory Void Reason (Audit Requirement)
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Blue Spring cashier inputted ₹250 instead of ₹120..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setVoidingTx(null);
                  setVoidReason('');
                }}
                disabled={voidSubmitting}
                className="py-2.5 px-3 rounded-xl bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={voidSubmitting || !voidReason.trim()}
                className="py-2.5 px-3 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs shadow-sm disabled:opacity-40 transition-colors flex items-center justify-center space-x-1"
              >
                {voidSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                <span>Confirm Void</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roster Upload Modal */}
      <RosterUploadModal
        open={showRosterModal}
        onClose={() => setShowRosterModal(false)}
        settings={settings}
        onSuccess={(result) => {
          setRosterSuccessBanner(
            `✅ ${result.added} people added, ${result.updated} updated, ${result.skipped} skipped — wallet links ready to download.`
          );
          setRosterHistory(getRosterHistory());
          setTimeout(() => setActiveTab('upload-history'), 300);
        }}
      />

      {/* Create Stall Modal */}
      {showCreateStallModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2F6DB5] border border-blue-200 flex items-center justify-center font-bold">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Create Catering Stall</h3>
                <p className="text-xs text-gray-500">Add physical counter for vendor scanning</p>
              </div>
            </div>

            <form onSubmit={handleCreateStall} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Stall Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Dining Counter (Stall 1)"
                  value={newStallName}
                  onChange={(e) => setNewStallName(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Campus *
                </label>
                <select
                  value={newStallCampus}
                  onChange={(e) => setNewStallCampus(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]"
                >
                  <option value="Hyderabad">Hyderabad</option>
                  <option value="Mohali">Mohali</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateStallModal(false)}
                  disabled={stallSubmitting}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={stallSubmitting || !newStallName.trim()}
                  className="py-2.5 px-3 rounded-xl bg-[#2F6DB5] hover:bg-[#255a96] text-white font-bold text-xs shadow-sm disabled:opacity-40 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {stallSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Save Stall</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Vendor / Cashier Account Modal */}
      {showCreateAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2F6DB5] border border-blue-200 flex items-center justify-center font-bold">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Create Vendor Account</h3>
                <p className="text-xs text-gray-500">Configure login credentials &amp; permissions</p>
              </div>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Account Role *
                  </label>
                  <select
                    value={newAccRole}
                    onChange={(e) => setNewAccRole(e.target.value as any)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]"
                  >
                    <option value="vendor">Blue Spring Manager (/vendor)</option>
                    <option value="cashier">Stall Cashier (/scan only)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. cashier_atrium"
                    value={newAccUsername}
                    onChange={(e) => setNewAccUsername(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Password *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Set password"
                    value={newAccPassword}
                    onChange={(e) => setNewAccPassword(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]"
                  />
                </div>
              </div>

              {newAccRole === 'cashier' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Assigned Stall (Locked in /scan) *
                  </label>
                  <select
                    value={newAccStall}
                    onChange={(e) => setNewAccStall(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]"
                  >
                    {stalls.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.campus})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Campus
                </label>
                <select
                  value={newAccCampus}
                  onChange={(e) => setNewAccCampus(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]"
                >
                  <option value="Hyderabad">Hyderabad</option>
                  <option value="Mohali">Mohali</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateAccountModal(false)}
                  disabled={accountSubmitting}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={accountSubmitting || !newAccUsername.trim() || !newAccPassword.trim()}
                  className="py-2.5 px-3 rounded-xl bg-[#2F6DB5] hover:bg-[#255a96] text-white font-bold text-xs shadow-sm disabled:opacity-40 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {accountSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>Save Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
