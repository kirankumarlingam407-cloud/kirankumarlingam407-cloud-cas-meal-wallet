'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { getSession, logout } from '@/lib/auth';
import { getTransactions, storeEvents } from '@/lib/store';
import { Transaction, MealSlot, AuthSession } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Store, 
  Layers, 
  Calendar, 
  LogOut, 
  Coffee, 
  Sun, 
  Moon, 
  Apple, 
  UtensilsCrossed, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Filter,
  Radio
} from 'lucide-react';

interface PageProps {
  params: Promise<{ stall: string }>;
}

export default function StallLivePurchasesPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();

  const stallParam = decodeURIComponent(resolvedParams.stall);
  const isAllStalls = stallParam.toLowerCase() === 'all';
  const stallTitle = isAllStalls ? 'All Stalls (Consolidated)' : stallParam;

  const [session, setSession] = useState<AuthSession | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [highlightedTxIds, setHighlightedTxIds] = useState<Set<string>>(new Set());

  // 1. Auth Guard
  useEffect(() => {
    const s = getSession();
    if (!s?.user) {
      router.replace('/login?tab=vendor');
      return;
    }
    if (s.user.role === 'cashier') {
      router.replace('/scan');
      return;
    }
    setSession(s);
  }, [router]);

  // 2. Fetch Transactions for Stall & Date
  const loadTransactions = async () => {
    try {
      const txs = await getTransactions({
        stall_name: isAllStalls ? undefined : stallParam,
        date: selectedDate,
      });
      setTransactions(txs);
    } catch (e) {
      console.error('Error loading stall transactions:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();

    // Listen to local store events
    const handleNewTx = (e: any) => {
      const newTx: Transaction = e.detail;
      if (newTx && newTx.id) {
        const matchesStall = isAllStalls || newTx.stall_name?.toLowerCase() === stallParam.toLowerCase();
        const matchesDate = !selectedDate || newTx.created_at?.startsWith(selectedDate);

        if (matchesStall && matchesDate) {
          setTransactions((prev) => {
            if (prev.some((t) => t.id === newTx.id)) return prev;
            return [newTx, ...prev];
          });

          // Highlight briefly for 3 seconds
          setHighlightedTxIds((prev) => new Set(prev).add(newTx.id));
          setTimeout(() => {
            setHighlightedTxIds((prev) => {
              const next = new Set(prev);
              next.delete(newTx.id);
              return next;
            });
          }, 3000);
        }
      } else {
        loadTransactions();
      }
    };

    const handleVoidTx = () => loadTransactions();

    storeEvents.addEventListener('transaction_created', handleNewTx);
    storeEvents.addEventListener('transaction_voided', handleVoidTx);

    // Supabase Realtime Subscription
    let channel: any = null;
    if (isSupabaseConfigured() && supabase) {
      channel = supabase
        .channel(`stall-realtime-${stallParam}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'transactions' },
          (payload) => {
            const newTx = payload.new as Transaction;
            const matchesStall = isAllStalls || newTx.stall_name?.toLowerCase() === stallParam.toLowerCase();
            const matchesDate = !selectedDate || newTx.created_at?.startsWith(selectedDate);

            if (matchesStall && matchesDate) {
              setTransactions((prev) => {
                if (prev.some((t) => t.id === newTx.id)) return prev;
                return [newTx, ...prev];
              });

              setHighlightedTxIds((prev) => new Set(prev).add(newTx.id));
              setTimeout(() => {
                setHighlightedTxIds((prev) => {
                  const next = new Set(prev);
                  next.delete(newTx.id);
                  return next;
                });
              }, 3000);
            }
          }
        )
        .subscribe();
    }

    return () => {
      storeEvents.removeEventListener('transaction_created', handleNewTx);
      storeEvents.removeEventListener('transaction_voided', handleVoidTx);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stallParam, isAllStalls, selectedDate]);

  const handleLogout = () => {
    logout();
    router.push('/login?tab=vendor');
  };

  // Filter transactions by slot
  const filteredTxs = transactions.filter((t) => {
    if (selectedSlot !== 'all' && t.slot !== selectedSlot) return false;
    return true;
  });

  // Compute Overall and Slot Totals (valid non-voided)
  const validTxs = transactions.filter((t) => !t.voided);
  const totalAmountToday = validTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalCountToday = validTxs.length;

  const slotStats = (['breakfast', 'lunch', 'snacks', 'beverages', 'dinner'] as MealSlot[]).map((slot) => {
    const slotTxs = validTxs.filter((t) => t.slot === slot);
    const sum = slotTxs.reduce((s, t) => s + t.amount, 0);
    return {
      slot,
      amount: sum,
      count: slotTxs.length,
    };
  });

  const slotIcons: Record<MealSlot, any> = {
    breakfast: Sun,
    lunch: UtensilsCrossed,
    snacks: Apple,
    beverages: Coffee,
    dinner: Moon,
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Link
                href="/vendor"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold border border-gray-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to stalls</span>
              </Link>

              <span className="flex items-center space-x-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-300 shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="tracking-wide uppercase text-[11px] font-black">REAL TIME CONNECTED</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              {isAllStalls ? <Layers className="w-6 h-6 text-[#2F6DB5]" /> : <Store className="w-6 h-6 text-[#2F6DB5]" />}
              <span>{stallTitle}</span>
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Blue Spring Catering • Realtime Placement Purchases
            </p>
          </div>

          {/* Right Header Stats & Logout */}
          <div className="flex items-center flex-wrap gap-4">
            <div className="text-left sm:text-right bg-blue-50/60 border border-blue-200 rounded-2xl px-4 py-2.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Total Spend ({selectedDate})
              </span>
              <div className="text-2xl font-black text-[#2F6DB5] font-mono tracking-tight">
                ₹{totalAmountToday.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-gray-600 font-semibold block">
                {totalCountToday} valid purchase{totalCountToday === 1 ? '' : 's'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs border border-gray-300 shadow-2xs transition-colors cursor-pointer"
              title="Sign out of Blue Spring Portal"
            >
              <LogOut className="w-4 h-4 text-gray-500" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Totals by Slot Cards Bar */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 px-1">
            Slot Spend Breakdown
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {slotStats.map((item) => {
              const Icon = slotIcons[item.slot];
              return (
                <div
                  key={item.slot}
                  className="bg-white border border-gray-200 rounded-2xl p-3.5 shadow-2xs flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      {item.slot}
                    </span>
                    <Icon className="w-4 h-4 text-[#2F6DB5]" />
                  </div>
                  <div>
                    <div className="text-lg font-black text-gray-900 font-mono">
                      ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium">
                      {item.count} scan{item.count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter Controls: Slot Tabs & Date Filter */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white border border-gray-200 rounded-2xl p-3 shadow-2xs">
          {/* Slot Tabs */}
          <div className="flex items-center flex-wrap gap-1">
            {['all', 'breakfast', 'lunch', 'snacks', 'beverages', 'dinner'].map((slot) => {
              const isSelected = selectedSlot === slot;
              return (
                <button
                  key={slot}
                  onClick={() => setSelectedSlot(slot)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#2F6DB5] text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {slot.toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* Date Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span>Date:</span>
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]"
            />
          </div>
        </div>

        {/* Live Purchases Table (Read-Only, Privacy Preserved) */}
        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span>Recent Purchases</span>
                <span className="text-xs font-mono text-gray-500 font-normal">
                  ({filteredTxs.length} items)
                </span>
              </h2>
              <p className="text-[11px] text-gray-500">
                Official catering audit trail • Read-only view
              </p>
            </div>

            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Live streaming</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Person Name</th>
                  {isAllStalls && <th className="py-3 px-4">Stall</th>}
                  <th className="py-3 px-4">Slot</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Bill Number</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-medium">
                {filteredTxs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAllStalls ? 7 : 6}
                      className="py-12 text-center text-gray-400"
                    >
                      <Store className="w-8 h-8 mx-auto mb-2 text-gray-300 stroke-[1.5]" />
                      <p className="font-semibold text-gray-600">No purchases recorded</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        New orders scanned at the stall counter will appear here immediately.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredTxs.map((t, idx) => {
                    const isNew = highlightedTxIds.has(t.id);

                    return (
                      <tr
                        key={t.id}
                        className={`transition-colors duration-700 ${
                          isNew
                            ? 'bg-emerald-50 ring-2 ring-emerald-300'
                            : t.voided
                            ? 'bg-gray-50/70 opacity-60'
                            : idx % 2 === 1
                            ? 'bg-gray-50/40 hover:bg-blue-50/30'
                            : 'bg-white hover:bg-blue-50/30'
                        }`}
                      >
                        {/* Time */}
                        <td className="py-3 px-4 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                          {new Date(t.created_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>

                        {/* Person Name (Privacy strictly protected: no token, no phone, no email, no balance) */}
                        <td className="py-3 px-4 font-bold text-gray-900 whitespace-nowrap">
                          {t.person?.name || 'Cardholder'}
                        </td>

                        {/* Stall name if all stalls view */}
                        {isAllStalls && (
                          <td className="py-3 px-4 text-gray-600 text-[11px] whitespace-nowrap">
                            {t.stall_name}
                          </td>
                        )}

                        {/* Slot badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-blue-50 text-[#2F6DB5] border border-blue-200">
                            {t.slot}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-4 font-black font-mono text-sm whitespace-nowrap">
                          <span className={t.voided ? 'line-through text-gray-400' : 'text-gray-900'}>
                            ₹{t.amount.toFixed(2)}
                          </span>
                        </td>

                        {/* Bill Number */}
                        <td className="py-3 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                          {t.bill_no || '—'}
                        </td>

                        {/* Status (Valid or Voided with reason) */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {t.voided ? (
                            <span 
                              className="inline-flex items-center space-x-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200"
                              title={t.void_reason || 'Voided by admin'}
                            >
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Voided{t.void_reason ? `: ${t.void_reason}` : ''}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Valid</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      <footer className="border-t border-gray-200 bg-white py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-bold text-gray-800">{stallTitle}</span> • Blue Spring Catering
          </div>
          <div className="text-[11px] text-gray-400">
            Read-Only Stall Audit View • Zero Edits Allowed
          </div>
        </div>
      </footer>
    </div>
  );
}
