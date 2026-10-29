'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { getSession, logout } from '@/lib/auth';
import { getStalls, getTransactions, storeEvents } from '@/lib/store';
import { Stall, Transaction, AuthSession } from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { 
  Store, 
  Layers, 
  MapPin, 
  Calendar, 
  TrendingUp, 
  ShoppingBag, 
  LogOut, 
  ArrowRight, 
  Sparkles, 
  RefreshCw,
  Radio
} from 'lucide-react';

interface StallStat {
  totalAmount: number;
  count: number;
}

export default function VendorStallSelectionPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [stallStats, setStallStats] = useState<Record<string, StallStat>>({});
  const [allStallsStat, setAllStallsStat] = useState<StallStat>({ totalAmount: 0, count: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // 1. Auth Guard
  useEffect(() => {
    const s = getSession();
    if (!s?.user) {
      router.replace('/login?tab=vendor');
      return;
    }
    // Block cashier from vendor stall overview; cashiers go to /scan only
    if (s.user.role === 'cashier') {
      router.replace('/scan');
      return;
    }
    setSession(s);
  }, [router]);

  // 2. Fetch Stalls & Compute Live Today Stats
  const loadData = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [stallsList, txs] = await Promise.all([
        getStalls(),
        getTransactions({ voided: false, date: todayStr }),
      ]);

      setStalls(stallsList);

      // Compute stats per stall
      const statsMap: Record<string, StallStat> = {};
      let totalAmount = 0;
      let totalCount = 0;

      stallsList.forEach((st) => {
        const stallTxs = txs.filter(
          (t) => t.stall_name?.toLowerCase() === st.name.toLowerCase()
        );
        const amt = stallTxs.reduce((sum, t) => sum + t.amount, 0);
        statsMap[st.name] = {
          totalAmount: amt,
          count: stallTxs.length,
        };
      });

      totalAmount = txs.reduce((sum, t) => sum + t.amount, 0);
      totalCount = txs.length;

      setStallStats(statsMap);
      setAllStallsStat({ totalAmount, count: totalCount });
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Error fetching vendor stall stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Local Realtime events
    const handleUpdate = () => loadData();
    storeEvents.addEventListener('transaction_created', handleUpdate);
    storeEvents.addEventListener('transaction_voided', handleUpdate);
    storeEvents.addEventListener('stalls_updated', handleUpdate);

    // Supabase Realtime channel
    let channel: any = null;
    if (isSupabaseConfigured() && supabase) {
      channel = supabase
        .channel('vendor-stalls-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
          loadData();
        })
        .subscribe();
    }

    return () => {
      storeEvents.removeEventListener('transaction_created', handleUpdate);
      storeEvents.removeEventListener('transaction_voided', handleUpdate);
      storeEvents.removeEventListener('stalls_updated', handleUpdate);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login?tab=vendor');
  };

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const vendorName = session?.user?.name || 'Blue Spring Catering';
  const campusName = session?.user?.campus || 'Hyderabad';

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        
        {/* Step 1 Title & Info Banner */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-blue-50 text-[#2F6DB5] border border-blue-200">
                <Store className="w-5 h-5 font-bold" />
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-[#2F6DB5] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  Step 1 • Live Portal
                </span>
                <span className="flex items-center space-x-2 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="tracking-wide uppercase font-black">REAL TIME CONNECTED</span>
                </span>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
              Select Stall
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 pt-1">
              <span className="font-bold text-gray-900">{vendorName}</span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center space-x-1 text-gray-700 font-medium">
                <MapPin className="w-3.5 h-3.5 text-[#2F6DB5]" />
                <span>{campusName} Campus</span>
              </span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center space-x-1 text-gray-700 font-medium">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>{todayFormatted}</span>
              </span>
            </div>
          </div>

          {/* Right Action: Logout */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs border border-gray-300 shadow-2xs transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-gray-500" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Stalls Cards Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Active Catering Counters ({stalls.length + 1} Views)
            </h2>
            <span className="text-[11px] text-gray-400">
              Auto-syncs live without page refresh
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Card 1: ALL STALLS */}
            <Link
              href="/vendor/all"
              className="group bg-gradient-to-br from-blue-50/50 to-white border-2 border-[#2F6DB5] rounded-3xl p-6 shadow-sm hover:shadow-md transition-all hover:scale-101 flex flex-col justify-between relative overflow-hidden"
            >
              <div className="absolute top-4 right-4">
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#2F6DB5] text-white px-2.5 py-1 rounded-full shadow-2xs">
                  Consolidated
                </span>
              </div>

              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#2F6DB5] text-white flex items-center justify-center mb-4 shadow-xs group-hover:scale-105 transition-transform">
                  <Layers className="w-6 h-6 stroke-[2.5]" />
                </div>

                <h3 className="text-xl font-black text-gray-900 group-hover:text-[#2F6DB5] transition-colors">
                  All Stalls
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Combined live transaction feed across every counter
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-500 block">
                    Today&apos;s Total Spend
                  </span>
                  <div className="text-2xl font-black text-[#2F6DB5] font-mono tracking-tight">
                    ₹{allStallsStat.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-gray-500 block">
                    Today&apos;s Purchases
                  </span>
                  <div className="text-lg font-black text-gray-800 font-mono">
                    {allStallsStat.count} {allStallsStat.count === 1 ? 'order' : 'orders'}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end text-xs font-bold text-[#2F6DB5] group-hover:translate-x-1 transition-transform">
                <span>Open Live Feed</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </Link>

            {/* Individual Stall Cards */}
            {stalls.map((stall) => {
              const stat = stallStats[stall.name] || { totalAmount: 0, count: 0 };
              const stallUrl = `/vendor/${encodeURIComponent(stall.name)}`;

              return (
                <Link
                  key={stall.id}
                  href={stallUrl}
                  className="group bg-white border border-gray-200 rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-[#2F6DB5] transition-all hover:scale-101 flex flex-col justify-between relative"
                >
                  <div className="absolute top-4 right-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                      {stall.campus || 'Hyderabad'}
                    </span>
                  </div>

                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2F6DB5] border border-blue-200 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                      <Store className="w-6 h-6 stroke-[2.2]" />
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#2F6DB5] transition-colors">
                      {stall.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {stall.vendor_name || 'Blue Spring Catering'}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-gray-500 block">
                        Today&apos;s Total Spend
                      </span>
                      <div className="text-2xl font-black text-gray-900 font-mono tracking-tight group-hover:text-[#2F6DB5] transition-colors">
                        ₹{stat.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-gray-500 block">
                        Today&apos;s Purchases
                      </span>
                      <div className="text-lg font-black text-gray-700 font-mono">
                        {stat.count} {stat.count === 1 ? 'purchase' : 'purchases'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end text-xs font-bold text-gray-600 group-hover:text-[#2F6DB5] group-hover:translate-x-1 transition-all">
                    <span>Open Stall View</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

      </main>

      <footer className="border-t border-gray-200 bg-white py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-bold text-gray-800">Blue Spring Catering Service</span> • ISB Placement Dining
          </div>
          <div className="text-[11px] text-gray-400">
            Realtime Meal Wallet Live Monitoring
          </div>
        </div>
      </footer>
    </div>
  );
}
