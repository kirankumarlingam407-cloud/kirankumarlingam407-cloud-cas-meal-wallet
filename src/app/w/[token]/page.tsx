'use client';

import React, { useEffect, useState, use } from 'react';
import { 
  getPersonByToken, 
  getTransactions, 
  getSettings, 
  flagTransactionByUser,
  storeEvents 
} from '@/lib/store';
import { Person, Transaction, Settings } from '@/types';
import { QRDisplay } from '@/components/QRDisplay';
import { Navbar } from '@/components/Navbar';
import { 
  AlertCircle, 
  Clock, 
  Flag, 
  RefreshCw, 
  ShieldAlert, 
  Utensils, 
  CheckCircle2, 
  Smartphone
} from 'lucide-react';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function PersonWalletPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [person, setPerson] = useState<Person | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [todayTransactions, setTodayTransactions] = useState<Transaction[]>([]);
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [todaySpent, setTodaySpent] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Flag Modal state
  const [flagModalTx, setFlagModalTx] = useState<Transaction | null>(null);
  const [flagReason, setFlagReason] = useState<string>('Wrong amount charged');
  const [flagNote, setFlagNote] = useState<string>('');
  const [flagSubmitting, setFlagSubmitting] = useState<boolean>(false);
  const [flagSuccessMsg, setFlagSuccessMsg] = useState<string | null>(null);

  // Home screen prompt state
  const [showPwaTip, setShowPwaTip] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const [p, s] = await Promise.all([
        getPersonByToken(token),
        getSettings()
      ]);

      if (p) {
        setPerson(p);
        setSettings(s);

        const allTxs = await getTransactions({ personId: p.id });
        const validTxs = allTxs.filter((t) => !t.voided);

        const total = validTxs.reduce((sum, t) => sum + t.amount, 0);
        setTotalSpent(total);

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const todayTxs = allTxs.filter(
          (t) => new Date(t.created_at).getTime() >= startOfToday.getTime()
        );
        setTodayTransactions(todayTxs);

        const todayValidTotal = todayTxs
          .filter((t) => !t.voided)
          .reduce((sum, t) => sum + t.amount, 0);
        setTodaySpent(todayValidTotal);
      }
    } catch (e) {
      console.error('Error loading wallet data:', e);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => {
    loadData();

    // Listen to real-time events from scanner or admin
    const handleTxUpdate = () => loadData();
    storeEvents.addEventListener('transaction_created', handleTxUpdate);
    storeEvents.addEventListener('transaction_voided', handleTxUpdate);
    storeEvents.addEventListener('settings_updated', handleTxUpdate);

    // Fast polling fallback every 4 seconds for instant live balance updates
    const interval = setInterval(loadData, 4000);

    return () => {
      storeEvents.removeEventListener('transaction_created', handleTxUpdate);
      storeEvents.removeEventListener('transaction_voided', handleTxUpdate);
      storeEvents.removeEventListener('settings_updated', handleTxUpdate);
      clearInterval(interval);
    };
  }, [token]);

  const handleOpenFlagModal = (tx: Transaction) => {
    setFlagModalTx(tx);
    setFlagReason('Wrong amount charged');
    setFlagNote('');
    setFlagSuccessMsg(null);
  };

  const handleSubmitFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagModalTx || !person) return;

    setFlagSubmitting(true);
    try {
      const fullNote = `${flagReason}: ${flagNote}`.trim();
      await flagTransactionByUser(flagModalTx.id, person.id, fullNote);
      setFlagSuccessMsg('Charge flagged successfully. CAS admin has been alerted for audit.');
      setTimeout(() => {
        setFlagModalTx(null);
        setFlagSuccessMsg(null);
        loadData();
      }, 2000);
    } catch (err: any) {
      alert(err?.message || 'Failed to submit flag');
    } finally {
      setFlagSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-[#2F6DB5] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-600 text-sm font-medium">Opening CAS Meal Wallet...</p>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500 mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold mb-2 text-gray-900">Wallet Pass Not Found</h1>
        <p className="text-gray-600 text-sm max-w-sm mb-6">
          This meal wallet link is invalid or expired. Please contact the ISB CAS placement coordinator team to get your personal QR pass.
        </p>
        <a
          href="/"
          className="px-5 py-2.5 rounded-xl bg-[#2F6DB5] hover:bg-[#255a96] text-white text-sm font-semibold transition-colors"
        >
          Return to Portal Home
        </a>
      </div>
    );
  }

  const remainingWallet = Math.max(0, person.wallet_total - totalSpent);
  const dailyCeiling = settings?.daily_ceiling || 800;
  const remainingTodayCeiling = Math.max(0, dailyCeiling - todaySpent);
  const walletPct = Math.min(100, Math.round((remainingWallet / person.wallet_total) * 100));

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <Navbar />

      {/* Main Content Container (Mobile-first, max-w-md) */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-5 flex flex-col space-y-4">
        
        {/* Person Card */}
        <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#2F6DB5] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  {person.role}
                </span>
                <span className="text-[10px] text-gray-500 flex items-center font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">{person.name}</h1>
              {person.email && <p className="text-xs text-gray-500 mt-0.5">{person.email}</p>}
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Short Code</span>
              <span className="font-mono text-base font-extrabold text-[#2F6DB5] bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 inline-block">
                {person.short_code}
              </span>
            </div>
          </div>
        </div>

        {/* QR Code Pass */}
        <QRDisplay 
          token={person.token} 
          name={person.name} 
          role={person.role} 
          shortCode={person.short_code} 
        />

        {/* Real-time Balances Dashboard */}
        <div className="grid grid-cols-2 gap-3">
          {/* Event Total Wallet */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Event Wallet
              </span>
              <div className="text-2xl font-black text-gray-900 tracking-tight">
                ₹{remainingWallet.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                of ₹{person.wallet_total.toLocaleString('en-IN')} total
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    walletPct < 20 ? 'bg-rose-500' : walletPct < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${walletPct}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-gray-500 mt-1">
                <span>{walletPct}% left</span>
                <span>Carry-forward</span>
              </div>
            </div>
          </div>

          {/* Today's Remaining Ceiling */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Today's Ceiling
              </span>
              <div className={`text-2xl font-black tracking-tight ${
                remainingTodayCeiling === 0 ? 'text-rose-600' : 'text-[#2F6DB5]'
              }`}>
                ₹{remainingTodayCeiling.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                ₹{todaySpent.toLocaleString('en-IN')} spent today
              </div>
            </div>

            <div className="mt-3 bg-gray-50 rounded-xl p-2 border border-gray-200 text-[10px] text-gray-700">
              <span className="text-[#2F6DB5] font-bold">Daily Max:</span> ₹{dailyCeiling} / day
            </div>
          </div>
        </div>

        {/* PWA "Add to Home Screen" Helper Banner */}
        <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#2F6DB5] flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">Add to Phone Home Screen</h4>
              <p className="text-[11px] text-gray-500">1-tap instant access at food stalls without logging in</p>
            </div>
          </div>
          <button
            onClick={() => setShowPwaTip(!showPwaTip)}
            className="text-xs text-[#2F6DB5] font-bold hover:underline px-2 py-1 flex-shrink-0"
          >
            {showPwaTip ? 'Hide' : 'How?'}
          </button>
        </div>

        {showPwaTip && (
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs text-gray-700 space-y-2 animate-in fade-in duration-200">
            <p className="font-semibold text-gray-900">To install on your phone:</p>
            <ul className="list-disc pl-4 space-y-1 text-gray-600 text-[11px]">
              <li><strong>iOS Safari:</strong> Tap the Share button (square with arrow) at the bottom, then select <em>"Add to Home Screen"</em>.</li>
              <li><strong>Android Chrome:</strong> Tap the 3 dots menu at the top right, then select <em>"Install App"</em> or <em>"Add to Home Screen"</em>.</li>
            </ul>
          </div>
        )}

        {/* Today's Transactions Feed */}
        <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm flex-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Utensils className="w-4 h-4 text-[#2F6DB5]" />
              <h3 className="font-bold text-sm text-gray-900">Today's Transactions</h3>
            </div>
            <span className="text-[10px] text-gray-500">
              {todayTransactions.length} charge{todayTransactions.length === 1 ? '' : 's'}
            </span>
          </div>

          {todayTransactions.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mx-auto text-gray-500 mb-2">
                <Clock className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-gray-700">No scans recorded today yet</p>
              <p className="text-[11px] text-gray-500 mt-1">
                Show your QR code to Blue Spring staff when collecting your meal.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {todayTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    tx.voided
                      ? 'bg-gray-50 border-gray-200 opacity-60'
                      : 'bg-white hover:bg-gray-50/80 border-gray-200 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-blue-50 text-[#2F6DB5] border border-blue-200">
                          {tx.slot}
                        </span>
                        {tx.bill_no && (
                          <span className="text-[10px] font-mono text-gray-500">
                            #{tx.bill_no}
                          </span>
                        )}
                        {tx.voided && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            VOIDED
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-800 font-semibold mt-1">
                        {tx.stall_name}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-base font-black ${tx.voided ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        ₹{tx.amount.toFixed(2)}
                      </div>

                      {!tx.voided && (
                        <button
                          onClick={() => handleOpenFlagModal(tx)}
                          className="mt-1 flex items-center space-x-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md transition-colors"
                        >
                          <Flag className="w-3 h-3" />
                          <span>Flag charge</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {tx.void_reason && (
                    <div className="mt-2 text-[10px] text-rose-700 bg-rose-50 p-1.5 rounded border border-rose-200">
                      <strong>Void Reason:</strong> {tx.void_reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-gray-500 pb-4">
          <p>Indian School of Business • Placement Operations</p>
          <p className="text-[10px] mt-0.5 text-gray-400">Payment settlement authorized by ISB CAS exclusively from digital logs.</p>
        </div>
      </main>

      {/* Flag Charge Modal */}
      {flagModalTx && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Flag Charge for Review</h3>
                <p className="text-xs text-gray-500">Alert CAS Operations of an incorrect bill</p>
              </div>
            </div>

            {flagSuccessMsg ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="text-sm font-semibold text-gray-900">{flagSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitFlag} className="space-y-4">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Transaction:</span>
                    <span className="font-bold text-gray-900">₹{flagModalTx.amount} • {flagModalTx.slot.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-500">Stall:</span>
                    <span className="text-gray-700 font-medium">{flagModalTx.stall_name}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Reason
                  </label>
                  <select
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]"
                  >
                    <option value="Wrong amount charged">Wrong amount charged (Inflated bill)</option>
                    <option value="I did not order this">I did not order this item</option>
                    <option value="Charged twice / Duplicate scan">Charged twice / Duplicate scan</option>
                    <option value="Poor food quality / returned">Poor food quality / returned</option>
                    <option value="Other discrepancy">Other discrepancy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Optional Note / Details
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Stall charged ₹150 for a ₹70 sandwich..."
                    value={flagNote}
                    onChange={(e) => setFlagNote(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setFlagModalTx(null)}
                    disabled={flagSubmitting}
                    className="py-2.5 px-3 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs border border-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={flagSubmitting}
                    className="py-2.5 px-3 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center space-x-1"
                  >
                    {flagSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
                    <span>Submit Flag</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
