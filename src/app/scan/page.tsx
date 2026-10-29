'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  getStallByCode, 
  processScan, 
  getPersonByCode, 
  getSettings,
  getTransactions,
  getIndiaDateString,
  checkRateLimit, 
  recordFailedAttempt, 
  clearRateLimit,
  PersonPassData
} from '@/lib/store';
import { MealSlot, Settings, ScanResult, Person, Stall } from '@/types';
import { 
  Camera, 
  CheckCircle2, 
  XCircle, 
  LogOut, 
  Delete, 
  AlertCircle, 
  ShieldAlert,
  ArrowLeft,
  Check
} from 'lucide-react';

export default function SimplifiedCashierPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentStall, setCurrentStall] = useState<Stall | null>(null);
  const [stallCodeInput, setStallCodeInput] = useState('');
  const [stallError, setStallError] = useState<string | null>(null);
  const [stallRateLimit, setStallRateLimit] = useState<{ allowed: boolean; remainingMinutes: number }>({
    allowed: true,
    remainingMinutes: 0,
  });

  // Flow step: 'login' | 'camera' | 'charge' | 'result'
  const [step, setStep] = useState<'login' | 'camera' | 'charge' | 'result'>('login');

  // Slot selector at top
  const [selectedSlot, setSelectedSlot] = useState<MealSlot>('lunch');

  // Manual code entry modal / input
  const [manualCodeOpen, setManualCodeOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Scanned Person and their slot usage today
  const [scannedPerson, setScannedPerson] = useState<Person | null>(null);
  const [scannedPersonCode, setScannedPersonCode] = useState<string>('');
  const [slotUsageText, setSlotUsageText] = useState<string>('');
  const [slotLimitReached, setSlotLimitReached] = useState<boolean>(false);

  // Amount Entry
  const [amountInput, setAmountInput] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Result state
  const [resultSuccess, setResultSuccess] = useState<boolean>(false);
  const [resultName, setResultName] = useState<string>('');
  const [resultAmount, setResultAmount] = useState<number>(0);
  const [resultBalance, setResultBalance] = useState<number>(0);
  const [resultErrorReason, setResultErrorReason] = useState<string>('');

  // Camera HTML5-QRCode
  const scannerContainerId = 'cashier-qr-scanner-view';
  const html5QrCodeRef = useRef<any>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // 1. Initial Load: Check remembered Stall Code and settings
  useEffect(() => {
    getSettings().then(setSettings);

    // Initial slot based on current time
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 11) setSelectedSlot('breakfast');
    else if (hour >= 11 && hour < 15) setSelectedSlot('lunch');
    else if (hour >= 15 && hour < 18) setSelectedSlot('snacks');
    else if (hour >= 18 && hour < 22) setSelectedSlot('dinner');
    else setSelectedSlot('beverages');

    // Check rate limit on stall code
    const rl = checkRateLimit('stall_code');
    setStallRateLimit(rl);

    // Check if device is already logged in to a stall
    if (typeof window !== 'undefined') {
      const savedCode = localStorage.getItem('cas_cashier_stall_code');
      if (savedCode) {
        getStallByCode(savedCode).then((stall) => {
          if (stall) {
            setCurrentStall(stall);
            setStep('camera');
          } else {
            localStorage.removeItem('cas_cashier_stall_code');
            setStep('login');
          }
        });
      }
    }
  }, []);

  // 2. Handle Stall Code Login
  const handleStallLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStallError(null);

    const clean = stallCodeInput.trim().toUpperCase();
    if (!clean) return;

    const rl = checkRateLimit('stall_code');
    if (!rl.allowed) {
      setStallRateLimit(rl);
      setStallError(`Device locked for ${rl.remainingMinutes} min due to 5 wrong attempts.`);
      return;
    }

    const stall = await getStallByCode(clean);
    if (stall) {
      clearRateLimit('stall_code');
      localStorage.setItem('cas_cashier_stall_code', clean);
      setCurrentStall(stall);
      setStep('camera');
    } else {
      const failed = recordFailedAttempt('stall_code');
      setStallRateLimit(failed);
      if (!failed.allowed) {
        setStallError(`Invalid Stall Code. 5 failed attempts reached. Device locked for 15 minutes.`);
      } else {
        setStallError('Stall Code not found or disabled.');
      }
    }
  };

  const handleStallLogout = () => {
    if (html5QrCodeRef.current) {
      try {
        html5QrCodeRef.current.stop().catch(() => {});
      } catch (e) {}
    }
    localStorage.removeItem('cas_cashier_stall_code');
    setCurrentStall(null);
    setStallCodeInput('');
    setStep('login');
  };

  // 3. Camera lifecycle
  useEffect(() => {
    if (step !== 'camera') {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(() => {});
          }
        } catch (e) {}
        setCameraActive(false);
      }
      return;
    }

    let isMounted = true;

    const startCamera = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!isMounted) return;

        const container = document.getElementById(scannerContainerId);
        if (!container) return;

        if (html5QrCodeRef.current) {
          try {
            if (html5QrCodeRef.current.isScanning) {
              await html5QrCodeRef.current.stop();
            }
          } catch (e) {}
        }

        const scanner = new Html5Qrcode(scannerContainerId);
        html5QrCodeRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText: string) => {
            handleCodeScanned(decodedText);
          },
          () => {}
        );

        if (isMounted) {
          setCameraActive(true);
          setCameraError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setCameraActive(false);
          setCameraError('Camera access unavailable. Use manual code entry below.');
        }
      }
    };

    const timer = setTimeout(startCamera, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(() => {});
          }
        } catch (e) {}
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // 4. When a code is scanned or entered manually
  const handleCodeScanned = async (code: string) => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } catch (e) {}
      setCameraActive(false);
    }

    const clean = code.trim().toUpperCase();
    setScannedPersonCode(clean);
    setManualCodeOpen(false);

    // Look up person & their slot usage today
    const person = await getPersonByCode(clean);
    if (!person) {
      // Show immediate Red screen for unregistered code
      setResultSuccess(false);
      setResultErrorReason(`Code "${clean}" is not registered in the roster`);
      setStep('result');
      setTimeout(() => {
        setStep('camera');
      }, 2000);
      return;
    }

    setScannedPerson(person);

    // Calculate usage for selected slot today (Asia/Kolkata date)
    const txs = await getTransactions({ personId: person.id });
    const todayStr = getIndiaDateString(new Date());
    const slotTxsToday = txs.filter(
      (t) => !t.voided && t.slot === selectedSlot && getIndiaDateString(t.created_at) === todayStr
    );

    const maxScans = settings?.slot_max_scans?.[selectedSlot] ?? (selectedSlot === 'snacks' || selectedSlot === 'beverages' ? 2 : 1);
    const usedCount = slotTxsToday.length;

    setSlotUsageText(`${selectedSlot.toUpperCase()}: ${usedCount}/${maxScans} used today`);
    setSlotLimitReached(usedCount >= maxScans);

    // Reset amount
    setAmountInput('');
    setStep('charge');
  };

  // 5. Numeric Keypad input handlers
  const handleKeypad = (val: string) => {
    if (val === 'BACKSPACE') {
      setAmountInput((prev) => prev.slice(0, -1));
    } else if (val === '00') {
      if (amountInput && amountInput !== '0' && amountInput.length < 5) {
        setAmountInput((prev) => prev + '00');
      }
    } else {
      if (amountInput.length >= 6) return;
      if (amountInput === '0') {
        setAmountInput(val);
      } else {
        setAmountInput((prev) => prev + val);
      }
    }
  };

  // 6. Confirm "Done" atomic transaction
  const handleDone = async () => {
    const num = parseFloat(amountInput);
    if (isNaN(num) || num <= 0 || !scannedPerson) return;

    setSubmitting(true);
    try {
      const res = await processScan({
        identifier: scannedPersonCode,
        amount: num,
        slot: selectedSlot,
        stall_name: currentStall?.name || 'Counter',
      });

      if (res.success) {
        setResultSuccess(true);
        setResultName(res.person_name || scannedPerson.name);
        setResultAmount(num);
        setResultBalance(res.remaining_wallet ?? 0);
        setStep('result');

        // Automatically return to camera after 2 seconds
        setTimeout(() => {
          setStep('camera');
        }, 2000);
      } else {
        setResultSuccess(false);
        setResultErrorReason(res.error || 'Transaction rejected');
        setStep('result');

        // Automatically return to camera after 2 seconds
        setTimeout(() => {
          setStep('camera');
        }, 2000);
      }
    } catch (e: any) {
      setResultSuccess(false);
      setResultErrorReason(e?.message || 'Transaction error');
      setStep('result');
      setTimeout(() => {
        setStep('camera');
      }, 2000);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // RENDER: 1. STALL CODE LOGIN
  // ============================================================================
  if (step === 'login') {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col justify-between p-6">
        <div className="flex-1 flex flex-col items-center justify-center max-w-sm w-full mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
              Cashier Terminal
            </h1>
            <p className="text-xs text-gray-500">Enter stall code assigned by CAS</p>
          </div>

          {!stallRateLimit.allowed && (
            <div className="w-full bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start space-x-3 text-red-700 text-xs">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <div>
                <span className="font-bold block">Terminal Locked</span>
                <span>5 failed attempts. Please wait {stallRateLimit.remainingMinutes} minutes before trying again.</span>
              </div>
            </div>
          )}

          <form onSubmit={handleStallLogin} className="w-full space-y-4">
            <div className="space-y-1.5">
              <input
                type="text"
                autoFocus
                disabled={!stallRateLimit.allowed}
                value={stallCodeInput}
                onChange={(e) => {
                  setStallCodeInput(e.target.value.toUpperCase());
                  if (stallError) setStallError(null);
                }}
                placeholder="Enter Stall Code (e.g. STALL01)"
                className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-2xl text-center text-lg font-mono font-bold tracking-wider text-gray-900 placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:border-[#2F6DB5] focus:ring-2 focus:ring-[#2F6DB5]/20 disabled:bg-gray-100 transition-all"
              />

              {stallError && (
                <div className="flex items-center justify-center space-x-1.5 text-xs font-bold text-red-600 pt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{stallError}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!stallCodeInput.trim() || !stallRateLimit.allowed}
              className="w-full py-3.5 bg-[#2F6DB5] hover:bg-[#255a96] text-white font-bold text-base rounded-2xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              Unlock Counter
            </button>
          </form>
        </div>

        <footer className="text-center pb-2">
          <Link href="/" className="text-xs font-semibold text-gray-400 hover:text-gray-600">
            Back to Home
          </Link>
        </footer>
      </div>
    );
  }

  // ============================================================================
  // RENDER: 2. CAMERA SCREEN
  // ============================================================================
  if (step === 'camera') {
    const slots: Array<{ id: MealSlot; label: string }> = [
      { id: 'breakfast', label: 'Breakfast' },
      { id: 'snacks', label: 'Snacks' },
      { id: 'beverages', label: 'Beverages' },
      { id: 'lunch', label: 'Lunch' },
      { id: 'dinner', label: 'Dinner' },
    ];

    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col justify-between p-4 max-w-md w-full mx-auto">
        
        {/* Header: Stall Name & Logout */}
        <div className="flex items-center justify-between py-2 border-b border-gray-100 mb-3">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
              Active Counter
            </span>
            <span className="text-sm font-black text-gray-900 truncate max-w-[240px] block">
              {currentStall?.name}
            </span>
          </div>

          <button
            onClick={handleStallLogout}
            className="flex items-center space-x-1 text-xs font-bold text-gray-500 hover:text-red-600 px-2.5 py-1.5 rounded-xl border border-gray-200 hover:border-red-200 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>

        {/* Slot Selector at the top */}
        <div className="space-y-1.5 mb-4">
          <div className="grid grid-cols-5 gap-1.5 bg-gray-100 p-1 rounded-2xl">
            {slots.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedSlot(id)}
                className={`py-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                  selectedSlot === id
                    ? 'bg-[#2F6DB5] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Camera View */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="relative w-full aspect-square max-w-[300px] bg-black rounded-3xl overflow-hidden shadow-sm flex items-center justify-center">
            <div id={scannerContainerId} className="w-full h-full" />
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-xs p-4 text-center">
                <Camera className="w-8 h-8 mb-2 opacity-60 animate-pulse" />
                <span>{cameraError || 'Starting camera...'}</span>
              </div>
            )}
          </div>

          {/* Small link to enter code manually */}
          <button
            type="button"
            onClick={() => setManualCodeOpen(true)}
            className="text-xs text-[#2F6DB5] font-bold hover:underline cursor-pointer"
          >
            Enter person code manually
          </button>
        </div>

        {/* Manual Code Modal */}
        {manualCodeOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 rounded-3xl p-6 max-w-xs w-full shadow-xl space-y-4">
              <h3 className="text-base font-bold text-gray-900 text-center">
                Enter Person Code
              </h3>
              <input
                type="text"
                autoFocus
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="e.g. CAS01"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center font-mono font-bold text-lg uppercase focus:outline-none focus:border-[#2F6DB5]"
              />
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setManualCodeOpen(false);
                    setManualCode('');
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!manualCode.trim()}
                  onClick={() => handleCodeScanned(manualCode)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#2F6DB5] text-white hover:bg-[#255a96] disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // RENDER: 3. AMOUNT ENTRY & KEYPAD ("Done")
  // ============================================================================
  if (step === 'charge') {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col justify-between p-4 max-w-sm w-full mx-auto">
        
        {/* Top Person Info & Slot Usage */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('camera')}
              className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to camera</span>
            </button>
            <span className="text-[10px] font-mono font-bold text-[#2F6DB5] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              {scannedPersonCode}
            </span>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center space-y-1">
            <h2 className="text-xl font-black text-gray-900">
              {scannedPerson?.name}
            </h2>
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold">
              <span className={slotLimitReached ? 'text-red-600' : 'text-[#2F6DB5]'}>
                {slotUsageText}
              </span>
            </div>
          </div>
        </div>

        {/* Amount Display */}
        <div className="my-auto py-4 text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
            Charge Amount (₹)
          </span>
          <div className="text-5xl font-black text-gray-900 font-mono tracking-tight">
            ₹{amountInput || '0'}
          </div>
        </div>

        {/* Numeric Keypad */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'BACKSPACE'].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleKeypad(val)}
                className="h-13 bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-200 rounded-2xl text-xl font-bold font-mono text-gray-900 shadow-2xs flex items-center justify-center transition-all cursor-pointer"
              >
                {val === 'BACKSPACE' ? <Delete className="w-5 h-5 text-gray-500" /> : val}
              </button>
            ))}
          </div>

          {/* Big "Done" Button */}
          <button
            type="button"
            disabled={!amountInput || parseFloat(amountInput) <= 0 || submitting}
            onClick={handleDone}
            className="w-full py-4 bg-[#2F6DB5] hover:bg-[#255a96] text-white font-black text-lg rounded-2xl shadow-md transition-all active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? 'Saving...' : 'Done'}
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: 4. RESULT (BIG GREEN OR BIG RED -> AUTO-RETURNS IN 2 SECONDS)
  // ============================================================================
  if (step === 'result') {
    if (resultSuccess) {
      return (
        <div className="min-h-screen bg-emerald-600 text-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-200">
          <div className="max-w-sm w-full space-y-6">
            <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white flex items-center justify-center mx-auto shadow-lg">
              <Check className="w-14 h-14 stroke-[3.5] text-white" />
            </div>

            <div className="space-y-1">
              <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-100">
                Charge Accepted
              </span>
              <h1 className="text-3xl font-black">{resultName}</h1>
            </div>

            <div className="bg-white/10 rounded-2xl p-4 border border-white/20 space-y-2">
              <div className="text-4xl font-black font-mono">
                ₹{resultAmount.toFixed(2)}
              </div>
              <div className="text-xs font-semibold text-emerald-100 border-t border-white/20 pt-2">
                Remaining Balance: ₹{resultBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <span className="text-xs text-emerald-100 font-medium block">
              Returning to camera...
            </span>
          </div>
        </div>
      );
    } else {
      return (
        <div className="min-h-screen bg-red-600 text-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-200">
          <div className="max-w-sm w-full space-y-6">
            <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white flex items-center justify-center mx-auto shadow-lg">
              <XCircle className="w-14 h-14 text-white" />
            </div>

            <div className="space-y-1">
              <span className="text-xs uppercase font-extrabold tracking-widest text-red-200">
                Charge Rejected
              </span>
              <h1 className="text-2xl font-black leading-tight">
                {resultErrorReason}
              </h1>
            </div>

            <span className="text-xs text-red-200 font-medium block">
              Returning to camera...
            </span>
          </div>
        </div>
      );
    }
  }

  return null;
}
