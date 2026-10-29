'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Wallet, 
  QrCode, 
  ShieldCheck, 
  Store, 
  LogIn, 
  LogOut, 
  User 
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getSession, logout } from '@/lib/auth';
import { storeEvents } from '@/lib/store';
import { AuthSession } from '@/types';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [supabaseActive, setSupabaseActive] = useState<boolean>(false);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    setSupabaseActive(isSupabaseConfigured());
    setSession(getSession());

    const handleAuthChange = () => {
      setSession(getSession());
    };
    storeEvents.addEventListener('auth_changed', handleAuthChange);

    return () => {
      storeEvents.removeEventListener('auth_changed', handleAuthChange);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setSession(null);
    router.push('/login');
  };

  // Determine nav links based on session role
  const role = session?.user?.role;
  const navLinks: Array<{ href: string; label: string; icon: any; badge?: string }> = [];

  if (role === 'admin') {
    navLinks.push({ href: '/admin', label: 'CAS Admin', icon: ShieldCheck, badge: 'Ops' });
    navLinks.push({ href: '/vendor', label: 'Blue Spring Portal', icon: Store, badge: 'Live' });
    navLinks.push({ href: '/scan', label: 'Scanner', icon: QrCode });
  } else if (role === 'vendor') {
    navLinks.push({ href: '/vendor', label: 'Blue Spring Portal', icon: Store, badge: 'Live' });
    navLinks.push({ href: '/scan', label: 'Vendor Scanner', icon: QrCode });
  } else if (role === 'cashier') {
    navLinks.push({ href: '/scan', label: 'Stall Scanner', icon: QrCode, badge: session?.user?.stall_name ? 'Assigned' : undefined });
  } else {
    navLinks.push({ href: '/scan', label: 'Vendor Scanner', icon: QrCode, badge: 'Stall' });
    navLinks.push({ href: '/admin', label: 'CAS Admin', icon: ShieldCheck, badge: 'Ops' });
    navLinks.push({ href: '/login', label: 'Sign In', icon: LogIn });
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b-2 border-[#2F6DB5] shadow-xs text-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-[#2F6DB5] hover:bg-[#255a96] flex items-center justify-center shadow-sm text-white group-hover:scale-105 transition-transform">
            <Wallet className="w-5 h-5 font-bold" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-gray-900">
                CAS Meal Wallet
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-[#2F6DB5] border border-blue-200">
                ISB PGP
              </span>
            </div>
            <p className="text-[11px] text-gray-500 hidden sm:block">Career Advancement Services • Placements 2026</p>
          </div>
        </Link>

        {/* Center Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1.5">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-[#2F6DB5] text-white shadow-xs'
                    : 'text-gray-700 hover:text-[#2F6DB5] hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Badges & Quick Action */}
        <div className="flex items-center space-x-2.5">
          {/* Status Pill */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-[11px]">
            <span className={`w-2 h-2 rounded-full ${supabaseActive ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-gray-700 font-medium">
              {supabaseActive ? 'Supabase Live' : 'System Active'}
            </span>
          </div>

          {/* User Session Pill or Sign In Button */}
          {session?.user ? (
            <div className="flex items-center space-x-2">
              <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                <User className="w-3.5 h-3.5 text-[#2F6DB5]" />
                <span className="font-bold text-gray-900 truncate max-w-[120px]">
                  {session.user.name.split(' ')[0]}
                </span>
                <span className="text-[10px] uppercase font-extrabold text-[#2F6DB5] bg-white px-1.5 py-0.5 rounded border border-blue-200">
                  {session.user.role}
                </span>
              </div>

              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-2 rounded-xl bg-white hover:bg-gray-100 text-gray-600 border border-gray-300 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#2F6DB5] hover:bg-[#255a96] text-white font-bold text-xs shadow-xs transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login</span>
            </Link>
          )}

          {/* Quick Scanner Mobile Button */}
          <Link
            href="/scan"
            className="md:hidden flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-800 font-bold text-xs border border-gray-300"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Scan</span>
          </Link>
        </div>
      </div>

      {/* Mobile Submenu Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-gray-200 bg-white px-2 py-2">
        {navLinks.slice(0, 3).map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${
                isActive ? 'bg-[#2F6DB5] text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
};
