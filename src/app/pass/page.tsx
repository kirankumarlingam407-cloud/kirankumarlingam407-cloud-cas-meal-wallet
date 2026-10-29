'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { 
  getPersonPassData, 
  flagTransactionByUser, 
  storeEvents, 
  PersonPassData 
} from '@/lib/store';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { MealSlot, Transaction } from '@/types';
import { Check, CheckCircle2, AlertTriangle, X, Clock, Store } from 'lucide-react';

function PassContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [passData, setPassData] = useState<PersonPassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flag modal state
  const [flagTx, setFlagTx] = useState<Transaction | null>(null);
  const [flagReason, setFlagReason] = useState('Wrong amount charged');
  const [flagNote, setFlagNote] = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagSuccess, setFlagSuccess] = useState(false);

  // Determine active code: from query param or localStorage
  const queryCode = searchParams.get('code');

  const loadData = async (targetCode: string) => {
    try {
      const data = await getPersonPassData(targetCode);
      if (!data) {
        setError('Code not found. Please try again.');
        setPassData(null);
        return;
      }
      setPassData(data);
      setError(null);
      // Remember code on this device
      localStorage.setItem('cas_saved_person_code', targetCode.toUpperCase());
    } catch (e) {
      setError('Error loading pass data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let activeCode = queryCode;
    if (!activeCode && typeof window !== 'undefined') {
      activeCode = localStorage.getItem('cas_saved_person_code');
    }

    if (!activeCode) {
      router.replace('/');
      return;
    }

    loadData(activeCode);

    // Realtime listeners for instant charge reflections
    const handleUpdate = () => {
      if (activeCode) loadData(activeCode);
    };

    storeEvents.addEventListener('transaction_created', handleUpdate);
    storeEvents.addEventListener('transaction_voided', handleUpdate);

    let channel: any = null;
    if (isSupabaseConfigured() && supabase) {
      channel = supabase
        .channel(`pass-live-${activeCode}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
          if (activeCode) loadData(activeCode);
        })
        .subscribe();
    }

    return () => {
      storeEvents.removeEventListener('transaction_created', handleUpdate);
      storeEvents.removeEventListener('transaction_voided', handleUpdate);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryCode]);

  // Render QR Code onto Canvas whenever passData updates
  useEffect(() => {
    if (canvasRef.current && passData) {
      const codeToEncode = passData.person.access_code || passData.person.short_code;
      QRCode.toCanvas(
        canvasRef.current,
        codeToEncode,
        {
          width: 220,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'H',
        },
        (err) => {
          if (err) console.error('QR Render Error:', err);
        }
      );
    }
  }, [passData]);

  const handleSwitchCode = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cas_saved_person_code');
    }
    router.push('/');
  };

  const handleOpenFlagModal = (tx: Transaction) => {
    setFlagTx(tx);
    setFlagReason('Wrong amount charged');
    setFlagNote('');
    setFlagSuccess(false);
  };

  const handleSubmitFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagTx || !passData) return;
    setFlagSubmitting(true);
    try {
      const note = `${flagReason}: ${flagNote}`.trim();
      await flagTransactionByUser(flagTx.id, passData.person.id, note);
      setFlagSuccess(true);
      setTimeout(() => {
        setFlagTx(null);
        setFlagSuccess(false);
        const code = passData.person.access_code || passData.person.short_code;
        loadData(code);
      }, 1500);
    } catch (err: any) {
      alert(err?.message || 'Error submitting flag');
    } finally {
      setFlagSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-gray-500 font-medium text-sm">
        Loading meal pass...
      </div>
    );
  }

  if (error || !passData) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 space-y-4 text-center">
        <p className="text-sm font-bold text-red-600">{error || 'Pass not found'}</p>
        <button
          onClick={handleSwitchCode}
          className="text-xs text-[#2F6DB5] font-bold hover:underline"
        >
          Enter another code
        </button>
      </div>
    );
  }

  const { person, remaining_wallet, remaining_ceiling, slot_usage, today_transactions } = passData;
  const accessCode = person.access_code || person.short_code;

  const slotsList: Array<{ slot: MealSlot; label: string }> = [
    { slot: 'breakfast', label: 'Breakfast' },
    { slot: 'lunch', label: 'Lunch' },
    { slot: 'snacks', label: 'Snacks' },
    { slot: 'beverages', label: 'Beverages' },
    { slot: 'dinner', label: 'Dinner' },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col justify-between p-4 sm:p-6 max-w-md w-full mx-auto">
      
      <div className="space-y-6">
        {/* Person Name & Code Header */}
        <div className="text-center space-y-1 pt-2">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            {person.name}
          </h1>
          <div className="flex items-center justify-center space-x-2">
            <span className="text-xs font-mono font-bold text-[#2F6DB5] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              Code: {accessCode}
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500 font-medium">
              {person.role}
            </span>
          </div>
        </div>

        {/* QR Code Canvas */}
        <div className="flex flex-col items-center justify-center">
          <div className="p-3 bg-white rounded-3xl border border-gray-200 shadow-sm flex items-center justify-center">
            <canvas ref={canvasRef} className="rounded-xl block" />
          </div>
          <span className="text-[11px] font-semibold text-gray-400 mt-2">
            Show this QR code at food counters
          </span>
        </div>

        {/* Balances Card Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs text-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
              Event Balance
            </span>
            <span className="text-2xl font-black text-[#2F6DB5] font-mono tracking-tight">
              ₹{remaining_wallet.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">
              Total ₹{person.wallet_total.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs text-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
              Today's Ceiling
            </span>
            <span className="text-2xl font-black text-gray-900 font-mono tracking-tight">
              ₹{remaining_ceiling.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5">
              Remaining today
            </span>
          </div>
        </div>

        {/* Today's Usage Per Slot */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1">
            Today's Slot Usage
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {slotsList.map(({ slot, label }) => {
              const usage = slot_usage[slot] || { used: 0, max: 1, completed: false };
              const isUsed = usage.used > 0;
              const isComplete = usage.completed;

              return (
                <div
                  key={slot}
                  className={`border rounded-xl p-2.5 flex items-center justify-between text-xs transition-colors ${
                    isComplete
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                      : isUsed
                      ? 'bg-blue-50/50 border-blue-200 text-gray-900'
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  <div>
                    <span className="font-bold block text-[11px]">{label}</span>
                    <span className="text-[10px] font-mono font-semibold text-gray-500">
                      {usage.used}/{usage.max}
                    </span>
                  </div>

                  {isComplete ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-gray-300" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Live List of Today's Charges */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Today's Charges
            </span>
            <span className="text-[10px] font-bold text-gray-500 font-mono">
              {today_transactions.length} charge{today_transactions.length === 1 ? '' : 's'}
            </span>
          </div>

          {today_transactions.length === 0 ? (
            <div className="bg-gray-50/80 border border-gray-200 border-dashed rounded-2xl p-6 text-center text-xs text-gray-400 font-medium">
              No charges today yet.
            </div>
          ) : (
            <div className="space-y-2">
              {today_transactions.map((tx) => {
                const timeStr = new Date(tx.created_at).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                });

                return (
                  <div
                    key={tx.id}
                    className="bg-white border border-gray-200 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold text-gray-900 capitalize">
                          {tx.slot}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-[11px] text-gray-500 font-mono flex items-center gap-0.5">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span>{timeStr}</span>
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-500 flex items-center gap-1">
                        <Store className="w-3 h-3 text-gray-400" />
                        <span>{tx.stall_name}</span>
                      </span>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="text-sm font-black text-gray-900 font-mono">
                        ₹{tx.amount.toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleOpenFlagModal(tx)}
                        className="text-[10px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 transition-colors cursor-pointer"
                      >
                        Flag this charge
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Switch Code Footer Link */}
      <footer className="pt-8 pb-4 text-center">
        <button
          onClick={handleSwitchCode}
          className="text-xs font-semibold text-gray-400 hover:text-[#2F6DB5] transition-colors cursor-pointer"
        >
          Switch code
        </button>
      </footer>

      {/* Flag Transaction Modal */}
      {flagTx && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Flag This Charge</h3>
              </div>
              <button
                onClick={() => setFlagTx(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {flagSuccess ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="text-xs font-bold text-gray-900">Flag submitted to CAS Admin</p>
                <p className="text-[11px] text-gray-500">Audit ticket created for review.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitFlag} className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Stall:</span>
                    <span className="font-semibold text-gray-900">{flagTx.stall_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount:</span>
                    <span className="font-mono font-bold text-gray-900">₹{flagTx.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Slot:</span>
                    <span className="font-semibold text-gray-900 capitalize">{flagTx.slot}</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <span className="font-bold text-gray-700 block">Reason:</span>
                  {[
                    'Wrong amount charged',
                    'I was charged twice',
                    'I did not make this purchase',
                    'Other dispute',
                  ].map((r) => (
                    <label key={r} className="flex items-center space-x-2 text-gray-800 cursor-pointer">
                      <input
                        type="radio"
                        name="flagReason"
                        checked={flagReason === r}
                        onChange={() => setFlagReason(r)}
                        className="text-[#2F6DB5]"
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>

                <div className="space-y-1">
                  <label htmlFor="flag-comment" className="text-xs font-semibold text-gray-600 block">
                    Optional Comment
                  </label>
                  <input
                    id="flag-comment"
                    type="text"
                    value={flagNote}
                    onChange={(e) => setFlagNote(e.target.value)}
                    placeholder="e.g. Item was ₹40, charged ₹95"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-[#2F6DB5]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setFlagTx(null)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={flagSubmitting}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#2F6DB5] text-white hover:bg-[#255a96] disabled:opacity-50"
                  >
                    {flagSubmitting ? 'Submitting...' : 'Submit Flag'}
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

export default function PersonPassPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center text-sm font-medium text-gray-500">
          Loading pass...
        </div>
      }
    >
      <PassContent />
    </Suspense>
  );
}
