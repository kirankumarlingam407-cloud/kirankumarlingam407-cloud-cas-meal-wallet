'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getPersonByCode, checkRateLimit, recordFailedAttempt, clearRateLimit } from '@/lib/store';
import { ArrowRight, AlertCircle, ShieldAlert } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rateLimit, setRateLimit] = useState<{ allowed: boolean; remainingMinutes: number }>({
    allowed: true,
    remainingMinutes: 0,
  });
  const [rememberedCode, setRememberedCode] = useState<string | null>(null);

  useEffect(() => {
    // Check rate limit on load
    const rl = checkRateLimit('person_code');
    setRateLimit(rl);

    // Check remembered code on phone
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cas_saved_person_code');
      if (saved) {
        setRememberedCode(saved);
        setCode(saved);
      }
    }
  }, []);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clean = code.trim().toUpperCase();
    if (!clean) return;

    // 1. Rate-limit check (5 wrong attempts -> 15 min lock)
    const rl = checkRateLimit('person_code');
    if (!rl.allowed) {
      setRateLimit(rl);
      setError(`Too many failed attempts. Device locked for ${rl.remainingMinutes} min.`);
      return;
    }

    setLoading(true);
    try {
      const person = await getPersonByCode(clean);
      if (person) {
        // Clear rate-limit attempts on success
        clearRateLimit('person_code');
        // Remember on device
        localStorage.setItem('cas_saved_person_code', clean);
        // Open meal pass
        router.push(`/pass?code=${encodeURIComponent(clean)}`);
      } else {
        const failed = recordFailedAttempt('person_code');
        setRateLimit(failed);
        if (!failed.allowed) {
          setError(`Code not found. Too many failed attempts. Device locked for 15 minutes.`);
        } else {
          setError('Code not found');
        }
      }
    } catch (err: any) {
      setError('Error verifying code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col justify-between p-6">
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm w-full mx-auto space-y-8">
        
        {/* Title */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
            CAS Meal Wallet
          </h1>
          <p className="text-xs text-gray-400 font-medium">ISB PGP Placements</p>
        </div>

        {/* Lockout Notice */}
        {!rateLimit.allowed && (
          <div className="w-full bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start space-x-3 text-red-700 text-xs">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
            <div>
              <span className="font-bold block">Device Locked</span>
              <span>5 consecutive wrong attempts. Please wait {rateLimit.remainingMinutes} minutes before trying again.</span>
            </div>
          </div>
        )}

        {/* Single Input + Continue Button */}
        <form onSubmit={handleContinue} className="w-full space-y-4">
          <div className="space-y-1.5">
            <input
              type="text"
              autoFocus
              disabled={!rateLimit.allowed || loading}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (error) setError(null);
              }}
              placeholder="Enter your code"
              className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-2xl text-center text-lg sm:text-xl font-mono font-bold tracking-wider text-gray-900 placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:border-[#2F6DB5] focus:ring-2 focus:ring-[#2F6DB5]/20 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
            />

            {error && (
              <div className="flex items-center justify-center space-x-1.5 text-xs font-bold text-red-600 pt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!code.trim() || !rateLimit.allowed || loading}
            className="w-full py-3.5 bg-[#2F6DB5] hover:bg-[#255a96] text-white font-bold text-base rounded-2xl shadow-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-98 cursor-pointer"
          >
            <span>{loading ? 'Checking...' : 'Continue'}</span>
            {!loading && <ArrowRight className="w-4 h-4 stroke-[2.5]" />}
          </button>
        </form>

        {/* Quick shortcut if device has saved code */}
        {rememberedCode && !error && rateLimit.allowed && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push(`/pass?code=${encodeURIComponent(rememberedCode)}`)}
              className="text-xs text-[#2F6DB5] hover:underline font-semibold"
            >
              Open saved meal pass ({rememberedCode})
            </button>
          </div>
        )}
      </div>

      {/* 3 Small Text Links at the Bottom */}
      <footer className="pt-8 pb-4 text-center">
        <div className="flex items-center justify-center flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-gray-500">
          <Link href="/scan" className="hover:text-[#2F6DB5] transition-colors">
            Cashier
          </Link>
          <span className="text-gray-300">•</span>
          <Link href="/login?tab=vendor" className="hover:text-[#2F6DB5] transition-colors">
            Blue Spring Login
          </Link>
          <span className="text-gray-300">•</span>
          <Link href="/login?tab=admin" className="hover:text-[#2F6DB5] transition-colors">
            CAS Admin Login
          </Link>
        </div>
      </footer>
    </div>
  );
}
