'use client';

import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Download, ShieldCheck } from 'lucide-react';

interface QRDisplayProps {
  token: string;
  name: string;
  role: string;
  shortCode: string;
}

export const QRDisplay: React.FC<QRDisplayProps> = ({ token, name, role, shortCode }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    if (canvasRef.current && token) {
      // Encode ONLY the raw token string
      QRCode.toCanvas(
        canvasRef.current,
        token,
        {
          width: 260,
          margin: 3, // clear white margin so it scans well in bright sunlight
          color: {
            dark: '#000000', // Pure black for crisp scanning
            light: '#ffffff', // Pure white
          },
          errorCorrectionLevel: 'H',
        },
        (error) => {
          if (error) console.error('Error generating QR code:', error);
          else if (canvasRef.current) {
            setQrUrl(canvasRef.current.toDataURL('image/png'));
          }
        }
      );
    }
  }, [token]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadQR = () => {
    if (qrUrl) {
      const a = document.createElement('a');
      a.href = qrUrl;
      a.download = `CAS-Meal-Wallet-${shortCode}-${name.replace(/\s+/g, '_')}.png`;
      a.click();
    }
  };

  return (
    <div className="relative bg-white rounded-3xl p-6 shadow-md border border-gray-200 flex flex-col items-center">
      {/* Top Tag */}
      <div className="w-full flex items-center justify-between mb-4">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-[#2F6DB5] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
          <ShieldCheck className="w-3.5 h-3.5 text-[#2F6DB5]" />
          <span>OFFICIAL MEAL PASS</span>
        </div>
        <div className="font-mono text-xs font-black tracking-widest text-gray-900 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
          #{shortCode}
        </div>
      </div>

      {/* QR Code Container with subtle frame matching reference mockup */}
      <div className="relative p-3 bg-white rounded-2xl border-2 border-gray-200 shadow-xs flex items-center justify-center">
        {/* Subtle corner target brackets */}
        <div className="absolute top-2 left-2 w-5 h-5 border-t-3 border-l-3 border-[#2F6DB5] rounded-tl-md pointer-events-none" />
        <div className="absolute top-2 right-2 w-5 h-5 border-t-3 border-r-3 border-[#2F6DB5] rounded-tr-md pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-5 h-5 border-b-3 border-l-3 border-[#2F6DB5] rounded-bl-md pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-5 h-5 border-b-3 border-r-3 border-[#2F6DB5] rounded-br-md pointer-events-none" />

        {/* QR Canvas */}
        <canvas ref={canvasRef} className="rounded-lg max-w-full block" />
      </div>

      {/* Security notice */}
      <p className="mt-3 text-xs text-center text-gray-500 font-medium max-w-[260px]">
        Scan at Blue Spring food stalls. Token is private & encrypted.
      </p>

      {/* Action Buttons */}
      <div className="mt-5 w-full grid grid-cols-2 gap-2.5">
        <button
          onClick={handleCopyLink}
          className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-[#2F6DB5] hover:bg-[#255a96] text-white text-xs font-bold shadow-xs transition-all active:scale-98"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-white" />}
          <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
        </button>

        <button
          onClick={handleDownloadQR}
          className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold border border-gray-300 shadow-2xs transition-all active:scale-98"
        >
          <Download className="w-3.5 h-3.5 text-gray-500" />
          <span>Save QR</span>
        </button>
      </div>
    </div>
  );
};
