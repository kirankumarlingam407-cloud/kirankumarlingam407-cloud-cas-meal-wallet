'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { login, getSession } from '@/lib/auth';
import { 
  ShieldCheck, 
  Store, 
  Lock, 
  User, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'admin' ? 'admin' : 'vendor';

  const [activeTab, setActiveTab] = useState<'admin' | 'vendor'>(defaultTab);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [shake, setShake] = useState<boolean>(false);

  useEffect(() => {
    // If already logged in, redirect to appropriate portal
    const session = getSession();
    if (session?.user) {
      if (session.user.role === 'admin') router.replace('/admin');
      else if (session.user.role === 'cashier') router.replace('/scan');
      else router.replace('/vendor');
    }
  }, [router]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'admin' || tabParam === 'vendor') {
      setActiveTab(tabParam);
      setError('');
    }
  }, [searchParams]);

  const handleTabSwitch = (tab: 'admin' | 'vendor') => {
    setActiveTab(tab);
    setError('');
    setUsername('');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password, activeTab);

      if (result.success && result.redirectUrl) {
        router.push(result.redirectUrl);
      } else {
        setError(result.error || 'Authentication failed. Please try again.');
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please verify credentials.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Login Card */}
      <div 
        className={`bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm transition-transform ${
          shake ? 'animate-[shake_0.5s_ease-in-out]' : ''
        }`}
      >
        {/* Top Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#2F6DB5] text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Portal Authentication</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Sign In
          </h1>
          <p className="text-xs text-gray-500">
            ISB PGP Placements 2026 • Career Advancement Services
          </p>
        </div>

        {/* Two Tabs Side by Side */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-50 border border-gray-200 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => handleTabSwitch('admin')}
            className={`flex items-center justify-center space-x-2 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'admin'
                ? 'bg-[#2F6DB5] text-white shadow-xs scale-101'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>CAS Admin</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('vendor')}
            className={`flex items-center justify-center space-x-2 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'vendor'
                ? 'bg-[#2F6DB5] text-white shadow-xs scale-101'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Blue Spring</span>
          </button>
        </div>

        {/* Tab Context Notice */}
        <div className="mb-5 p-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-600 flex items-start space-x-2.5">
          {activeTab === 'admin' ? (
            <>
              <ShieldCheck className="w-4 h-4 text-[#2F6DB5] flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-gray-800">CAS Admin Portal: </span>
                <span>Full placement food budget control, roster onboarding, and official vendor billing.</span>
              </div>
            </>
          ) : (
            <>
              <Store className="w-4 h-4 text-[#2F6DB5] flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-gray-800">Blue Spring Catering: </span>
                <span>Vendor manager live stall monitoring &amp; stall cashier terminals.</span>
              </div>
            </>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={activeTab === 'admin' ? 'admin' : 'e.g. bluespring or cashier1'}
                className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2F6DB5] focus:ring-2 focus:ring-[#2F6DB5]/20 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#2F6DB5] focus:ring-2 focus:ring-[#2F6DB5]/20 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-[#2F6DB5] hover:bg-[#255a96] text-white font-bold text-sm shadow-sm transition-all hover:scale-101 active:scale-99 disabled:opacity-50 flex items-center justify-center space-x-2 mt-2 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In as {activeTab === 'admin' ? 'CAS Admin' : 'Blue Spring'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Helper Note for testing */}
        <div className="mt-6 pt-4 border-t border-gray-100 text-center text-[11px] text-gray-500 space-y-1">
          {activeTab === 'admin' ? (
            <p>Admin default password: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-mono font-bold">CAS@960387</code></p>
          ) : (
            <div className="space-y-0.5">
              <p>Manager: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700 font-mono">bluespring</code> / <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700 font-mono">BlueSpring@2026</code></p>
              <p>Cashier: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700 font-mono">cashier1</code> / <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700 font-mono">Cashier@123</code></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-16 flex items-center justify-center">
        <Suspense fallback={
          <div className="w-full max-w-md mx-auto text-center py-12">
            <div className="w-8 h-8 border-3 border-[#2F6DB5] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-gray-500 font-medium">Loading portal authentication...</p>
          </div>
        }>
          <LoginForm />
        </Suspense>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-bold text-gray-800">ISB Career Advancement Services (CAS)</span> • Indian School of Business
          </div>
          <div className="text-[11px] text-gray-400">
            Secure Role-Based Portal Access
          </div>
        </div>
      </footer>
    </div>
  );
}
