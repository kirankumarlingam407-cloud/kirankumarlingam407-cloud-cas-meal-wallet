'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { 
  getSettings, 
  processScan, 
  getPersonByShortCode, 
  getPersonByToken,
  getStalls
} from '@/lib/store';
import { getSession } from '@/lib/auth';
import { MealSlot, Settings, ScanResult, Person, Stall, AuthSession } from '@/types';
import confetti from 'canvas-confetti';
import { 
  Camera, 
  CheckCircle, 
  XCircle, 
  QrCode, 
  Keyboard, 
  Store, 
  Coffee, 
  Sun, 
  Moon, 
  Apple, 
  UtensilsCrossed,
  Delete,
  RotateCcw,
  RefreshCw,
  ArrowRight,
  Check,
  SwitchCamera,
  AlertCircle,
  Lock
} from 'lucide-react';

interface CameraDevice {
  id: string;
  label: string;
}

export default function VendorScannerPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<MealSlot>('lunch');
  const [vendorStall, setVendorStall] = useState<string>('Main Dining Counter (Stall 1)');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [isCashierLocked, setIsCashierLocked] = useState<boolean>(false);
  
  // Scanner state
  const [scanStep, setScanStep] = useState<'idle' | 'scanned' | 'result'>('idle');
  const [scannedIdentifier, setScannedIdentifier] = useState<string>('');
  const [identifiedPerson, setIdentifiedPerson] = useState<Person | null>(null);
  const [personLookupLoading, setPersonLookupLoading] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');
  const [manualMode, setManualMode] = useState<boolean>(false);

  // Amount & Bill Entry
  const [amountInput, setAmountInput] = useState<string>('');
  const [billNo, setBillNo] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Result display
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [autoResetTimer, setAutoResetTimer] = useState<number>(4);

  // Camera HTML5-QRCode ref and Back/Front Camera Switching
  const scannerContainerId = 'qr-reader-container';
  const html5QrCodeRef = useRef<any>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [availableCameras, setAvailableCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState<boolean>(false);

  // 1. Suggest slot based on local time and check cashier session
  useEffect(() => {
    const s = getSession();
    if (s?.user) {
      setSession(s);
      if (s.user.role === 'cashier' && s.user.stall_name) {
        setVendorStall(s.user.stall_name);
        setIsCashierLocked(true);
      }
    }

    getStalls().then((stallList) => {
      setStalls(stallList);
      if (!s?.user?.stall_name && stallList.length > 0) {
        setVendorStall(stallList[0].name);
      }
    });

    const hour = new Date().getHours();
    if (hour >= 6 && hour < 11) setSelectedSlot('breakfast');
    else if (hour >= 11 && hour < 15) setSelectedSlot('lunch');
    else if (hour >= 15 && hour < 18) setSelectedSlot('snacks');
    else if (hour >= 18 && hour < 22) setSelectedSlot('dinner');
    else setSelectedSlot('beverages');

    getSettings().then((set) => setSettings(set));
  }, []);

  // 2. Start or switch camera (Defaults strictly to Back / Environment Camera)
  const startCamera = async (targetFacing: 'environment' | 'user', specificId?: string) => {
    let isMounted = true;
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      if (!isMounted) return;

      // Stop running scanner if any
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
        } catch (e) {
          // ignore stop errors
        }
      }

      // Enumerate connected cameras
      let cameras: CameraDevice[] = [];
      try {
        cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          setAvailableCameras(cameras);
        }
      } catch (err) {
        console.warn('Could not enumerate cameras:', err);
      }

      // Configure support for BOTH QR codes and 1D Barcodes
      const formatsToSupport = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
      ];

      const qrScanner = html5QrCodeRef.current || new Html5Qrcode(scannerContainerId, {
        formatsToSupport,
        verbose: false,
      });
      html5QrCodeRef.current = qrScanner;

      // Determine camera config:
      // Priority 1: User-selected specific camera ID
      // Priority 2: In environment mode, search for physical "back" or "rear" camera label
      let cameraConfig: any = { facingMode: targetFacing };

      if (specificId) {
        cameraConfig = specificId;
      } else if (cameras.length > 0) {
        if (targetFacing === 'environment') {
          const backCam = cameras.find((c) =>
            /back|rear|environment|facing\s*back|camera2\s*0/i.test(c.label)
          );
          if (backCam) {
            cameraConfig = backCam.id;
            setSelectedCameraId(backCam.id);
          } else {
            cameraConfig = { facingMode: 'environment' };
          }
        } else {
          const frontCam = cameras.find((c) =>
            /front|user|facing\s*front|selfie|camera2\s*1/i.test(c.label)
          );
          if (frontCam) {
            cameraConfig = frontCam.id;
            setSelectedCameraId(frontCam.id);
          } else {
            cameraConfig = { facingMode: 'user' };
          }
        }
      }

      const scanConfig = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await qrScanner.start(
        cameraConfig,
        scanConfig,
        (decodedText: string) => {
          handleScannedCode(decodedText);
        },
        () => {
          // ignore frame parse failures
        }
      );

      setCameraActive(true);
      setCameraError(null);
      setFacingMode(targetFacing);
    } catch (err: any) {
      console.warn('Camera start error:', err);
      // Fallback: try basic environment constraint
      try {
        if (html5QrCodeRef.current) {
          await html5QrCodeRef.current.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
            (decodedText: string) => handleScannedCode(decodedText),
            () => {}
          );
          setCameraActive(true);
          setCameraError(null);
          setFacingMode('environment');
          return;
        }
      } catch (fallbackErr) {
        setCameraActive(false);
        setCameraError('Camera access unavailable. Please grant camera permission or use manual short code entry below.');
      }
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  // Toggle between Back (environment) and Front (user) camera
  const handleToggleCamera = async () => {
    setIsSwitchingCamera(true);
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setSelectedCameraId(null);
    await startCamera(newFacing);
  };

  // Switch to specific camera ID from dropdown
  const handleSelectSpecificCamera = async (camId: string) => {
    setIsSwitchingCamera(true);
    setSelectedCameraId(camId);
    const chosen = availableCameras.find((c) => c.id === camId);
    const isFront = chosen && /front|user|selfie/i.test(chosen.label);
    const newFacing = isFront ? 'user' : 'environment';
    await startCamera(newFacing, camId);
  };

  // 3. Initialize Camera Scanner when in idle and not in manual mode
  useEffect(() => {
    if (scanStep === 'idle' && !manualMode) {
      startCamera(facingMode, selectedCameraId || undefined);
    } else {
      // Stop scanner when leaving idle
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().then(() => {
              setCameraActive(false);
            }).catch(() => {});
          }
        } catch (e) {}
      }
    }

    return () => {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(() => {});
          }
        } catch (e) {}
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanStep, manualMode]);

  // 4. Audio feedback on success or rejection
  const playBeep = (isSuccess: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isSuccess) {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.1); // E6
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime); // Low buzz
        osc.frequency.setValueAtTime(180, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      // Audio autoplay policy might restrict
    }
  };

  // Handle scanned token or short code
  const handleScannedCode = async (code: string) => {
    // Vibrate haptic
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 30, 40]);
    }

    setScannedIdentifier(code.trim());
    setScanStep('scanned');
    setPersonLookupLoading(true);

    // Look up person details for reassurance
    try {
      let p: Person | null = null;
      if (code.startsWith('tok_')) {
        p = await getPersonByToken(code.trim());
      } else {
        p = await getPersonByShortCode(code.trim());
      }
      setIdentifiedPerson(p);
    } catch (e) {
      console.error('Lookup error:', e);
    } finally {
      setPersonLookupLoading(false);
    }
  };

  // Keypad press handler
  const handleKeypadPress = (val: string) => {
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

  const handleQuickAmount = (val: number) => {
    setAmountInput(String(val));
  };

  // Confirm Charge
  const handleConfirmCharge = async () => {
    const num = parseFloat(amountInput);
    if (isNaN(num) || num <= 0) return;

    setSubmitting(true);
    try {
      const res = await processScan({
        identifier: scannedIdentifier,
        amount: num,
        slot: selectedSlot,
        bill_no: billNo.trim() || undefined,
        stall_name: vendorStall,
        vendor_id: 'vendor_blue_spring_cashier',
        vendor_name: 'Blue Spring',
      });

      setScanResult(res);
      setScanStep('result');

      if (res.success) {
        playBeep(true);
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#16A34A', '#22C55E', '#86EFAC'],
        });

        // 4-second auto-reset countdown
        let count = 4;
        setAutoResetTimer(count);
        const timer = setInterval(() => {
          count -= 1;
          setAutoResetTimer(count);
          if (count <= 0) {
            clearInterval(timer);
            handleResetToScan();
          }
        }, 1000);
      } else {
        playBeep(false);
      }
    } catch (err: any) {
      setScanResult({
        success: false,
        error: err?.message || 'Server scan error',
      });
      setScanStep('result');
      playBeep(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetToScan = () => {
    setScanStep('idle');
    setScannedIdentifier('');
    setIdentifiedPerson(null);
    setAmountInput('');
    setBillNo('');
    setScanResult(null);
    setManualCode('');
  };

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleScannedCode(manualCode.trim());
    }
  };

  const slotIcons = {
    breakfast: Sun,
    lunch: UtensilsCrossed,
    snacks: Apple,
    beverages: Coffee,
    dinner: Moon,
  };

  const slotCap = settings?.slot_caps[selectedSlot] || 0;
  const slotMaxScans = selectedSlot === 'snacks' || selectedSlot === 'beverages' ? 2 : 1;

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-md w-full mx-auto px-4 py-4 sm:py-6 flex flex-col space-y-4">
        
        {/* Stall & Mode Status Header */}
        <div className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2F6DB5] border border-blue-200 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1">
                {isCashierLocked && <Lock className="w-3 h-3 text-[#2F6DB5]" />}
                <span>{isCashierLocked ? `Assigned Counter (${session?.user?.name})` : 'Blue Spring Vendor Stall'}</span>
              </span>
              {isCashierLocked ? (
                <span className="text-xs text-gray-900 font-bold block">{vendorStall}</span>
              ) : (
                <select
                  value={vendorStall}
                  onChange={(e) => setVendorStall(e.target.value)}
                  className="bg-transparent text-xs text-gray-800 font-semibold border-0 p-0 focus:outline-none focus:ring-0 cursor-pointer"
                >
                  {stalls.length === 0 ? (
                    <option value={vendorStall}>{vendorStall}</option>
                  ) : (
                    stalls.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-gray-500 block">Placement Mode</span>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center justify-end gap-1.5 shadow-2xs mt-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="tracking-wide uppercase font-black text-[10px]">REAL TIME CONNECTED</span>
            </span>
          </div>
        </div>

        {/* Meal Slot Selection Bar */}
        {scanStep !== 'result' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">
                Select Meal Slot
              </span>
              <span className="text-[#2F6DB5] font-semibold text-[11px]">
                Cap: ₹{slotCap} • Max {slotMaxScans} scan{slotMaxScans === 1 ? '' : 's'}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {(['breakfast', 'lunch', 'snacks', 'beverages', 'dinner'] as MealSlot[]).map((slot) => {
                const Icon = slotIcons[slot];
                const isSelected = selectedSlot === slot;
                const cap = settings?.slot_caps[slot] || 0;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center text-center transition-all ${
                      isSelected
                        ? 'bg-[#2F6DB5] text-white font-black shadow-sm scale-102'
                        : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-0.5" />
                    <span className="text-[10px] uppercase font-bold tracking-tight truncate w-full">
                      {slot}
                    </span>
                    <span className={`text-[9px] ${isSelected ? 'text-white/90 font-bold' : 'text-gray-500'}`}>
                      ₹{cap}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 1: SCANNER VIEWPORT */}
        {scanStep === 'idle' && (
          <div className="space-y-3">
            {!manualMode ? (
              <div className="relative bg-white rounded-3xl p-5 border border-gray-200 shadow-sm flex flex-col items-center overflow-hidden">
                
                {/* ── Camera Control Bar (Back Camera Indicator & Switch Button) ── */}
                <div className="w-full flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center space-x-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${cameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1">
                      {facingMode === 'environment' ? (
                        <>
                          <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Back Camera ON
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-amber-700 font-extrabold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Front Camera ON
                          </span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Switch to Back / Flip Camera Button */}
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    disabled={isSwitchingCamera}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                      facingMode === 'user'
                        ? 'bg-[#2F6DB5] text-white hover:bg-[#255a96] animate-pulse ring-2 ring-blue-300'
                        : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
                    }`}
                    title="Change camera to front or back"
                  >
                    <SwitchCamera className={`w-4 h-4 text-current ${isSwitchingCamera ? 'animate-spin' : ''}`} />
                    <span>{facingMode === 'environment' ? 'Switch Camera' : 'Switch to Back Camera'}</span>
                  </button>
                </div>

                {/* Warning banner if front camera is accidentally in use */}
                {facingMode === 'user' && (
                  <div 
                    onClick={handleToggleCamera}
                    className="w-full mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between cursor-pointer hover:bg-amber-100 transition"
                  >
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span className="font-semibold text-[11px]">Front camera active. Tap here to switch to Back Camera.</span>
                    </div>
                    <span className="text-[11px] font-black text-[#2F6DB5] underline">Switch</span>
                  </div>
                )}

                {/* Multiple Camera Devices Dropdown (if phone has ultra-wide / multi back lenses) */}
                {availableCameras.length > 1 && (
                  <div className="w-full mb-3 flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs">
                    <span className="text-[11px] font-semibold text-gray-500">Lens Selector:</span>
                    <select
                      value={selectedCameraId || ''}
                      onChange={(e) => handleSelectSpecificCamera(e.target.value)}
                      className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#2F6DB5] cursor-pointer max-w-[200px] truncate"
                    >
                      {availableCameras.map((cam, idx) => (
                        <option key={cam.id} value={cam.id}>
                          {cam.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Viewfinder frame */}
                <div className="relative w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden bg-gray-950 flex items-center justify-center border-2 border-gray-300">
                  <div id={scannerContainerId} className="w-full h-full" />

                  {/* Quick Floating Camera Flip Button on Video Canvas */}
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    disabled={isSwitchingCamera}
                    className="absolute top-3 right-3 z-20 p-2.5 rounded-full bg-white/90 hover:bg-white text-gray-800 shadow-md border border-gray-200 transition-all active:scale-90 flex items-center justify-center"
                    title="Flip between Back and Front Camera"
                  >
                    <SwitchCamera className={`w-4 h-4 text-[#2F6DB5] ${isSwitchingCamera ? 'animate-spin' : ''}`} />
                  </button>

                  {/* Viewfinder frame overlay */}
                  <div className="absolute inset-4 pointer-events-none border-2 border-dashed border-[#2F6DB5]/60 rounded-xl" />
                  
                  {/* Blue corner brackets */}
                  <div className="absolute top-2 left-2 w-7 h-7 border-t-4 border-l-4 border-[#2F6DB5] rounded-tl-lg pointer-events-none" />
                  <div className="absolute top-2 right-2 w-7 h-7 border-t-4 border-r-4 border-[#2F6DB5] rounded-tr-lg pointer-events-none" />
                  <div className="absolute bottom-2 left-2 w-7 h-7 border-b-4 border-l-4 border-[#2F6DB5] rounded-bl-lg pointer-events-none" />
                  <div className="absolute bottom-2 right-2 w-7 h-7 border-b-4 border-r-4 border-[#2F6DB5] rounded-br-lg pointer-events-none" />

                  {/* Scan beam */}
                  <div className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-[#2F6DB5] to-transparent shadow-md shadow-[#2F6DB5]/80 animate-pulse pointer-events-none top-1/2 -translate-y-1/2" />
                </div>

                {cameraError && (
                  <div className="mt-3 text-center p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs w-full">
                    <p className="font-semibold">{cameraError}</p>
                    <p className="text-[11px] text-gray-500 mt-1">Make sure camera permission is allowed in browser settings, or enter code manually below.</p>
                  </div>
                )}

                <p className="text-xs text-gray-500 font-medium mt-3 text-center">
                  Point back camera at QR code or barcode on the pass
                </p>

                {/* Manual Fallback Toggle */}
                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className="mt-3 flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold border border-gray-300 transition-colors shadow-2xs"
                >
                  <Keyboard className="w-3.5 h-3.5 text-[#2F6DB5]" />
                  <span>Enter Short Code Manually</span>
                </button>
              </div>
            ) : (
              /* Manual Entry Card */
              <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Keyboard className="w-5 h-5 text-[#2F6DB5]" />
                    <h3 className="font-bold text-sm text-gray-900">Manual Code Entry</h3>
                  </div>
                  <button
                    onClick={() => setManualMode(false)}
                    className="text-xs text-[#2F6DB5] font-bold hover:underline"
                  >
                    Switch to Camera
                  </button>
                </div>

                <form onSubmit={handleManualLookup} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Enter Person Short Code (e.g. CAS01, CAS02) or Token
                    </label>
                    <input
                      type="text"
                      placeholder="CAS01"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 font-mono text-xl font-black text-[#2F6DB5] placeholder-gray-400 tracking-wider text-center focus:outline-none focus:ring-2 focus:ring-[#2F6DB5] focus:border-transparent"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!manualCode.trim()}
                    className="w-full py-3 rounded-xl bg-[#2F6DB5] hover:bg-[#255a96] text-white font-bold text-sm shadow-sm disabled:opacity-40 transition-all flex items-center justify-center space-x-2"
                  >
                    <span>Look Up Person</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: SCANNED - ENTER BILL AMOUNT */}
        {scanStep === 'scanned' && (
          <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Person Banner */}
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2F6DB5] block">
                  Scanned Cardholder
                </span>
                <div className="text-lg font-black text-gray-900">
                  {personLookupLoading ? 'Checking credentials...' : identifiedPerson?.name || 'Card Verified'}
                </div>
                <div className="text-xs text-gray-600 font-medium">
                  {identifiedPerson ? `${identifiedPerson.role} • #${identifiedPerson.short_code}` : scannedIdentifier}
                </div>
              </div>

              <button
                onClick={handleResetToScan}
                className="p-2 rounded-xl bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors"
                title="Cancel scan"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Bill Amount Display */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 text-center relative">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Enter Stall Bill Amount ({selectedSlot.toUpperCase()})
              </span>
              <div className="flex items-center justify-center space-x-1">
                <span className="text-2xl font-bold text-[#2F6DB5]">₹</span>
                <span className="text-4xl font-black text-gray-900 font-mono tracking-tight">
                  {amountInput || '0'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Max slot cap: ₹{slotCap}
              </p>
            </div>

            {/* Quick Amount Chips */}
            <div className="grid grid-cols-4 gap-1.5">
              {[50, 100, 150, slotCap].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className="py-1.5 rounded-xl bg-white hover:bg-blue-50 text-[#2F6DB5] font-bold text-xs border border-blue-200 shadow-2xs transition-colors"
                >
                  ₹{val}
                </button>
              ))}
            </div>

            {/* Touch Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '00', 'BACKSPACE'].map((key) => {
                const isBackspace = key === 'BACKSPACE';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypadPress(key)}
                    className={`py-3.5 rounded-2xl font-mono text-xl font-bold transition-all active:scale-95 border ${
                      isBackspace
                        ? 'bg-gray-100 hover:bg-gray-200 text-rose-600 border-gray-200 flex items-center justify-center'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border-gray-200'
                    }`}
                  >
                    {isBackspace ? <Delete className="w-6 h-6" /> : key}
                  </button>
                );
              })}
            </div>

            {/* Optional Bill # */}
            <div>
              <input
                type="text"
                placeholder="Optional Bill / Receipt # (e.g. BS-2041)"
                value={billNo}
                onChange={(e) => setBillNo(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F6DB5]"
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleResetToScan}
                disabled={submitting}
                className="py-3 px-4 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs border border-gray-300 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmCharge}
                disabled={submitting || !amountInput || parseFloat(amountInput) <= 0}
                className="py-3 px-4 rounded-xl bg-[#2F6DB5] hover:bg-[#255a96] text-white font-black text-sm shadow-md disabled:opacity-40 transition-all flex items-center justify-center space-x-1"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 stroke-[3]" />
                )}
                <span>CHARGE ₹{amountInput || 0}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RESULT OVERLAY (HIGH CONTRAST GREEN #16A34A / RED #DC2626 STATES) */}
        {scanStep === 'result' && scanResult && (
          <div className="animate-in zoom-in-95 duration-200">
            {scanResult.success ? (
              /* SUCCESS STATE (BIG HIGH CONTRAST GREEN #16A34A FULL SCREEN) */
              <div className="bg-[#16A34A] text-white rounded-3xl p-6 shadow-2xl text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle className="w-10 h-10 text-white stroke-[2.5]" />
                </div>

                <div>
                  <span className="text-xs uppercase font-extrabold tracking-widest bg-white/20 px-3 py-0.5 rounded-full inline-block mb-1">
                    CHARGE CONFIRMED
                  </span>
                  <div className="text-4xl font-black font-mono tracking-tight text-white">
                    ₹{scanResult.amount?.toFixed(2)}
                  </div>
                  <h2 className="text-xl font-bold mt-1 text-white">
                    {scanResult.person_name}
                  </h2>
                  <p className="text-xs text-emerald-100 font-semibold">
                    {scanResult.person_role} • {scanResult.slot?.toUpperCase()}
                  </p>
                </div>

                {/* Balances summary */}
                <div className="bg-black/15 backdrop-blur-sm rounded-2xl p-4 grid grid-cols-2 gap-2 text-left border border-white/20">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-100 block">
                      Wallet Remaining
                    </span>
                    <span className="text-lg font-black text-white font-mono">
                      ₹{scanResult.remaining_wallet?.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-100 block">
                      Today's Ceiling Left
                    </span>
                    <span className="text-lg font-black text-white font-mono">
                      ₹{scanResult.remaining_daily_ceiling?.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-emerald-50 font-medium">
                  Logged to CAS Placement Audit. Vendor cannot modify.
                </div>

                <button
                  type="button"
                  onClick={handleResetToScan}
                  className="w-full py-3.5 rounded-2xl bg-white hover:bg-gray-100 text-[#16A34A] font-black text-sm shadow-xl transition-all active:scale-98 flex items-center justify-center space-x-2"
                >
                  <span>Scan Next Card ({autoResetTimer}s)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* REJECTED STATE (BIG HIGH CONTRAST RED #DC2626 FULL SCREEN) */
              <div className="bg-[#DC2626] text-white rounded-3xl p-6 shadow-2xl text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto shadow-inner">
                  <XCircle className="w-10 h-10 text-white stroke-[2.5]" />
                </div>

                <div>
                  <span className="text-xs uppercase font-extrabold tracking-widest bg-white/20 px-3 py-0.5 rounded-full inline-block mb-1">
                    TRANSACTION REJECTED
                  </span>
                  <h2 className="text-lg font-black text-white mt-2">
                    Charge Blocked by Policy
                  </h2>
                </div>

                {/* Explicit rejection reason card */}
                <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 text-center border border-white/20">
                  <span className="text-[10px] uppercase font-bold text-rose-100 block mb-1">
                    Reason for Rejection
                  </span>
                  <p className="text-sm font-bold text-white leading-relaxed">
                    {scanResult.error || 'Transaction would violate placement wallet limits.'}
                  </p>
                </div>

                <div className="text-xs text-rose-100 leading-tight">
                  Please ask the cardholder to verify their remaining ceiling or contact CAS Helpdesk.
                </div>

                <button
                  type="button"
                  onClick={handleResetToScan}
                  className="w-full py-3.5 rounded-2xl bg-white hover:bg-gray-100 text-[#DC2626] font-black text-sm shadow-xl transition-all active:scale-98 flex items-center justify-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Try Again / Next Scan</span>
                </button>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
