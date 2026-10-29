'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { getPeople, getSettings } from '@/lib/store';
import { Person, Settings } from '@/types';
import { 
  Wallet, 
  QrCode, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Smartphone,
  Store
} from 'lucide-react';

export default function HomePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    getPeople().then((p) => setPeople(p));
    getSettings().then((s) => setSettings(s));
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-[#2F6DB5] text-xs font-extrabold tracking-wider uppercase">
            <Sparkles className="w-4 h-4" />
            <span>Digital Food Spending For ISB PGP Placements</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-gray-900 tracking-tight leading-tight">
            CAS Meal Wallet
          </h1>

          <p className="text-sm sm:text-base text-gray-600 leading-relaxed max-w-2xl mx-auto">
            Replacing paper meal tokens with an auditable, mobile-first rupee wallet. 
            Food vendor <strong className="text-[#2F6DB5]">Blue Spring</strong> scans personal QR codes, logs actual bill amounts, and ISB CAS pays exclusively from verified logs.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/scan"
              className="flex items-center space-x-2 px-5 py-3.5 rounded-2xl bg-[#2F6DB5] hover:bg-[#255a96] text-white font-black text-sm shadow-md transition-all hover:scale-102 active:scale-98"
            >
              <QrCode className="w-5 h-5 stroke-[2.5]" />
              <span>Cashier Scanner</span>
            </Link>

            <Link
              href="/vendor"
              className="flex items-center space-x-2 px-5 py-3.5 rounded-2xl bg-white hover:bg-gray-50 text-gray-800 font-bold text-sm border border-gray-300 shadow-sm transition-all hover:scale-102 active:scale-98"
            >
              <Store className="w-5 h-5 text-[#2F6DB5]" />
              <span>Blue Spring Portal</span>
            </Link>

            <Link
              href="/admin"
              className="flex items-center space-x-2 px-5 py-3.5 rounded-2xl bg-white hover:bg-gray-50 text-gray-800 font-bold text-sm border border-gray-300 shadow-sm transition-all hover:scale-102 active:scale-98"
            >
              <ShieldCheck className="w-5 h-5 text-[#2F6DB5]" />
              <span>CAS Admin</span>
            </Link>
          </div>
        </div>

        {/* 3 Core Roles Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Person Wallet */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Role 1: Person (No Login)
              </span>
              <h3 className="text-xl font-bold text-gray-900 mt-2 mb-1">
                Personal Meal Pass
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Opens via private secret link. Shows dynamic QR code, event balance, today's remaining ceiling, live scan activity, and a one-tap <em>"Flag this charge"</em> button.
              </p>

              <div className="mt-4 pt-3 border-t border-gray-100 space-y-1 text-xs">
                {people.length > 0 ? (
                  <>
                    <div className="text-[11px] text-gray-500 font-semibold mb-1">
                      Enrolled Personnel Passes:
                    </div>
                    {people.slice(0, 3).map((p) => (
                      <Link
                        key={p.id}
                        href={`/w/${p.token}`}
                        className="flex items-center justify-between p-1.5 rounded-lg text-gray-700 hover:text-[#2F6DB5] hover:bg-blue-50 transition-colors text-xs font-medium"
                      >
                        <span>{p.name} ({p.role})</span>
                        <span className="font-mono text-[10px] text-gray-400">#{p.short_code} →</span>
                      </Link>
                    ))}
                  </>
                ) : (
                  <div className="space-y-1.5 text-gray-500">
                    <p className="leading-relaxed">
                      Each coordinator, driver, or staff member accesses their private pass via a unique secret URL.
                    </p>
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[11px] text-gray-600">
                      Upload an Excel roster in CAS Admin to enroll personnel and generate their private passes.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              {people.length > 0 ? (
                <Link
                  href={`/w/${people[0].token}`}
                  className="w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-[#2F6DB5] font-bold text-xs border border-gray-200 transition-colors"
                >
                  <span>Open {people[0].name.split(' ')[0]}&apos;s Wallet Pass</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <Link
                  href="/admin"
                  className="w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-[#2F6DB5] font-bold text-xs border border-gray-200 transition-colors"
                >
                  <span>Upload Roster in Admin</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>

          {/* Card 2: Vendor Scanner */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2F6DB5] border border-blue-200 flex items-center justify-center mb-4">
                <QrCode className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#2F6DB5] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Role 2: Vendor (Blue Spring)
              </span>
              <h3 className="text-xl font-bold text-gray-900 mt-2 mb-1">
                Cashier Scanner Terminal
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Slot selector, high-speed camera scanner with targeting brackets, manual short code fallback, touch keypad, and immediate Big GREEN confirmation or Big RED rejection overlay.
              </p>

              <ul className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-600">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2F6DB5] flex-shrink-0" />
                  <span>Enforces daily ceiling & slot caps</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2F6DB5] flex-shrink-0" />
                  <span>Max 2 scans for snacks/beverages</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2F6DB5] flex-shrink-0" />
                  <span>Immutable audit log (cannot void)</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col gap-2">
              <Link
                href="/vendor"
                className="w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-[#2F6DB5] hover:bg-[#255a96] text-white font-bold text-xs shadow-sm transition-all"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Blue Spring Live Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/scan"
                className="w-full flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-xs border border-gray-200 transition-colors"
              >
                <QrCode className="w-3.5 h-3.5 text-[#2F6DB5]" />
                <span>Cashier Scanner Terminal</span>
              </Link>
            </div>
          </div>

          {/* Card 3: Admin Command */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                Role 3: Admin (ISB CAS)
              </span>
              <h3 className="text-xl font-bold text-gray-900 mt-2 mb-1">
                CAS Placement Operations
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Live metrics, transaction audit with mandatory void reasons, anomaly detection, one-click official billing CSV export, and Excel roster onboarding.
              </p>

              <ul className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-600">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span>Exact cap & rapid scan flags</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span>Official Blue Spring billing export</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span>Excel roster onboarding with secret passes</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <Link
                href="/admin"
                className="w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-xs border border-gray-200 transition-colors"
              >
                <span>Open Admin Operations</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

        </div>

        {/* Feature Highlights Grid */}
        <div className="bg-gray-50 border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-xl font-extrabold text-gray-900">Configurable Wallet Policy Rules</h2>
            <p className="text-xs text-gray-500 mt-1">All parameters adjustable in real-time from the Admin Settings tab</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold text-[#2F6DB5] uppercase tracking-wider block mb-1">
                Event-Total Wallet
              </span>
              <p className="text-gray-900 font-bold">₹3,000 - ₹6,000 / person</p>
              <p className="text-[11px] text-gray-500 mt-1">
                Configurable by role (Coordinator, Driver, CAS staff). Carries forward daily, expires when event ends.
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold text-[#2F6DB5] uppercase tracking-wider block mb-1">
                Daily Ceiling
              </span>
              <p className="text-gray-900 font-bold">₹800 / day default</p>
              <p className="text-[11px] text-gray-500 mt-1">
                Hard ceiling per day. Rejects any scan attempt exceeding remaining ceiling with a clear red alert.
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold text-[#2F6DB5] uppercase tracking-wider block mb-1">
                Per-Slot Caps
              </span>
              <p className="text-gray-900 font-bold">Breakfast ₹150 • Lunch ₹250</p>
              <p className="text-[11px] text-gray-500 mt-1">
                Snacks ₹100, Beverages ₹50, Dinner ₹250. Max 2 scans for snacks and beverages.
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold text-[#2F6DB5] uppercase tracking-wider block mb-1">
                Automated Audit Flags
              </span>
              <p className="text-gray-900 font-bold">Anomaly & Abuse Alerts</p>
              <p className="text-[11px] text-gray-500 mt-1">
                Flags exact cap scans, &gt;30% above slot average, &gt;2 scans in 10 mins, or student complaints.
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-bold text-gray-800">ISB Career Advancement Services (CAS)</span> • Indian School of Business
          </div>
          <div className="text-[11px] text-gray-400">
            Deployed with Next.js App Router, TypeScript, Tailwind & Supabase
          </div>
        </div>
      </footer>
    </div>
  );
}
