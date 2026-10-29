'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  MapPin,
  Users,
  ExternalLink,
} from 'lucide-react';
import { importRosterRows, RosterImportResult } from '@/lib/store';
import { RosterRow, Settings } from '@/types';

interface RosterUploadModalProps {
  open: boolean;
  onClose: () => void;
  settings: Settings | null;
  onSuccess?: (result: RosterImportResult) => void;
}

const VALID_ROLES = ['Interview Coordinator', 'Driver', 'CAS Staff'];

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/** Parse an xlsx ArrayBuffer into RosterRow[] using SheetJS */
async function parseRosterXlsx(buffer: ArrayBuffer, fileName: string): Promise<RosterRow[]> {
  // Dynamically import xlsx so it never runs on the server
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array' });

  // Find "Roster" sheet (case-insensitive)
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'roster') ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('No worksheet found in the uploaded file.');

  // Convert to array-of-arrays (raw)
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (raw.length < 2) throw new Error('The file appears to be empty (no data rows found).');

  // Header row (row 0) — we accept flexible header names
  const headers: string[] = raw[0].map((h: any) => String(h).trim().toLowerCase());
  const col = (names: string[]) => headers.findIndex((h) => names.some((n) => h.includes(n)));

  const idxName   = col(['name']);
  const idxRole   = col(['role']);
  const idxPhone  = col(['phone', 'mobile', 'contact']);
  const idxEmail  = col(['email']);
  const idxWallet = col(['wallet', 'amount', 'inr']);

  const rows: RosterRow[] = [];

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];

    // Skip blank rows
    const allEmpty = r.every((c: any) => String(c).trim() === '');
    if (allEmpty) continue;

    const name         = idxName   >= 0 ? String(r[idxName] ?? '').trim()   : '';
    const role         = idxRole   >= 0 ? String(r[idxRole] ?? '').trim()   : '';
    const phone        = idxPhone  >= 0 ? String(r[idxPhone] ?? '').trim()  : '';
    const email        = idxEmail  >= 0 ? String(r[idxEmail] ?? '').trim()  : '';
    const walletRaw    = idxWallet >= 0 ? r[idxWallet] : '';
    const walletNum    = typeof walletRaw === 'number' ? walletRaw : parseFloat(String(walletRaw).replace(/[^\d.]/g, ''));

    const errors: string[] = [];
    if (!name) errors.push('Name is required');
    if (!role) errors.push('Role is required');
    else if (!VALID_ROLES.includes(role)) errors.push(`Role must be one of: ${VALID_ROLES.join(', ')}`);
    if (!phone && !email) errors.push('At least one of Phone or Email is required');
    if (isNaN(walletNum) || walletNum <= 0) errors.push('Wallet Amount must be a positive whole number');
    else if (!Number.isInteger(walletNum)) errors.push('Wallet Amount must be a whole number (no decimals)');

    rows.push({
      rowIndex: i,
      name,
      role,
      phone: phone || undefined,
      email: email || undefined,
      wallet_amount: isNaN(walletNum) ? 0 : Math.round(walletNum),
      valid: errors.length === 0,
      errors,
    });
  }

  return rows;
}

/** Generate a downloadable sample .xlsx template */
async function downloadSampleTemplate() {
  const XLSX = await import('xlsx');
  const data = [
    ['Name', 'Role', 'Phone', 'Email', 'Wallet Amount (INR)'],
    ['Ramesh Kumar',  'Interview Coordinator', '9876543210', 'ramesh@example.com',  5000],
    ['Priya Singh',   'Driver',                '9123456789', 'priya@example.com',   3000],
    ['Anita Sharma',  'CAS Staff',             '9988776655', 'anita@example.com',   4000],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Column widths
  ws['!cols'] = [{ wch: 24 }, { wch: 26 }, { wch: 16 }, { wch: 28 }, { wch: 22 }];

  // Style header row bold (xlsx-style not available in community edition — add a note)
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Roster');

  // Instructions sheet
  const instr = XLSX.utils.aoa_to_sheet([
    ['CAS Meal Wallet — Roster Template Instructions'],
    [''],
    ['Sheet name must be "Roster"'],
    ['Required columns: Name, Role, Phone, Email, Wallet Amount (INR)'],
    ['Valid Roles: Interview Coordinator | Driver | CAS Staff'],
    ['At least one of Phone or Email must be filled per row'],
    ['Wallet Amount must be a positive whole number (INR)'],
    ['Blank rows are automatically skipped'],
  ]);
  XLSX.utils.book_append_sheet(wb, instr, 'Instructions');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'CAS_Meal_Wallet_Roster_Template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

/** Generate the links sheet after a successful import */
async function downloadLinksSheet(
  links: RosterImportResult['personLinks'],
  campus: string,
  baseUrl: string
) {
  const XLSX = await import('xlsx');
  const header = ['Name', 'Role', 'Campus', 'Short Code', 'Phone', 'Email', 'Wallet (INR)', 'Wallet Link'];
  const rows = links.map((l) => [
    l.name,
    l.role,
    l.campus,
    l.short_code,
    l.phone || '',
    l.email || '',
    l.wallet_total,
    `${baseUrl}/w/${l.token}`,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = [
    { wch: 24 }, { wch: 26 }, { wch: 14 }, { wch: 10 },
    { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 60 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Wallet Links');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CAS_Wallet_Links_${campus}_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function RosterUploadModal({ open, onClose, settings, onSuccess }: RosterUploadModalProps) {
  const [date, setDate]       = useState<string>(todayStr());
  const [campus, setCampus]   = useState<string>('Hyderabad');
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<RosterRow[] | null>(null);
  const [parseError, setParseError] = useState<string>('');
  const [parsing, setParsing] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [result, setResult]   = useState<RosterImportResult | null>(null);
  const [successBanner, setSuccessBanner] = useState<string>('');

  const fileRef = useRef<HTMLInputElement>(null);
  const fileBufferRef = useRef<ArrayBuffer | null>(null);

  const campuses = settings?.campuses?.length ? settings.campuses : ['Hyderabad', 'Mohali'];

  // Reset when opened
  useEffect(() => {
    if (open) {
      setDate(todayStr());
      setCampus(campuses[0] ?? 'Hyderabad');
      setFileName('');
      setParsedRows(null);
      setParseError('');
      setResult(null);
      setSuccessBanner('');
      fileBufferRef.current = null;
      if (fileRef.current) fileRef.current.value = '';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      setParseError('Please upload a .xlsx file.');
      setParsedRows(null);
      return;
    }

    setFileName(file.name);
    setParsing(true);
    setParseError('');
    setParsedRows(null);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      fileBufferRef.current = buffer;
      const rows = await parseRosterXlsx(buffer, file.name);
      setParsedRows(rows);
    } catch (err: any) {
      setParseError(err?.message || 'Failed to parse file.');
    } finally {
      setParsing(false);
    }
  }, []);

  const validRows  = parsedRows?.filter((r) => r.valid) ?? [];
  const errorRows  = parsedRows?.filter((r) => !r.valid) ?? [];

  const handleUpload = async () => {
    if (!validRows.length) return;
    setUploading(true);
    try {
      const importResult = await importRosterRows(
        validRows.map((r) => ({
          name: r.name,
          role: r.role,
          phone: r.phone,
          email: r.email,
          wallet_amount: r.wallet_amount,
        })),
        date,
        campus,
        fileName
      );
      setResult(importResult);
      setSuccessBanner(
        `${importResult.added} people added, ${importResult.updated} updated, ${importResult.skipped} skipped.`
      );
      onSuccess?.(importResult);
    } catch (err: any) {
      setParseError(err?.message || 'Import failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadLinks = () => {
    if (!result) return;
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    downloadLinksSheet(result.personLinks, campus, base);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#2F6DB5] text-center flex-1">Upload Wallet Roster</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition ml-2 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Success result view */}
          {result ? (
            <div className="space-y-4">
              {/* Banner */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-800 text-sm">Import Successful!</p>
                  <p className="text-green-700 text-sm mt-0.5">{successBanner}</p>
                </div>
              </div>

              {/* Summary chips */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Added',   value: result.added,   color: 'bg-blue-50 text-blue-700 border-blue-100' },
                  { label: 'Updated', value: result.updated, color: 'bg-amber-50 text-amber-700 border-amber-100' },
                  { label: 'Skipped', value: result.skipped, color: 'bg-gray-50 text-gray-600 border-gray-100' },
                ].map((c) => (
                  <div key={c.label} className={`${c.color} border rounded-xl py-3 text-center`}>
                    <div className="text-2xl font-black">{c.value}</div>
                    <div className="text-xs font-medium mt-0.5">{c.label}</div>
                  </div>
                ))}
              </div>

              <p className="text-sm text-gray-500 text-center">
                Wallet links have been generated for all {result.personLinks.length} people. Download the sheet below.
              </p>

              <button
                onClick={handleDownloadLinks}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition"
              >
                <Download className="w-4 h-4" />
                Download Wallet Links Sheet (.xlsx)
              </button>
            </div>
          ) : (
            <>
              {/* Date field */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                />
                <p className="text-xs text-gray-400">People in the file become active from this date until the event end date.</p>
              </div>

              {/* Campus field */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  Campus <span className="text-red-500">*</span>
                </label>
                <select
                  value={campus}
                  onChange={(e) => setCampus(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition bg-white"
                >
                  {campuses.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* File upload */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                  Upload Wallet Roster
                </label>
                <div
                  className="border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-xl p-5 text-center cursor-pointer transition"
                  onClick={() => fileRef.current?.click()}
                >
                  {fileName ? (
                    <div className="flex items-center justify-center gap-2 text-blue-700 font-medium text-sm">
                      <FileSpreadsheet className="w-5 h-5" />
                      {fileName}
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-500">Click to choose a .xlsx file</p>
                      <p className="text-xs text-gray-400 mt-0.5">Accepts .xlsx only · Sheet must be named "Roster"</p>
                    </>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {/* Parsing spinner */}
              {parsing && (
                <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reading file…
                </div>
              )}

              {/* Parse error */}
              {parseError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {parseError}
                </div>
              )}

              {/* Preview after parse */}
              {parsedRows && parsedRows.length > 0 && (
                <div className="space-y-3">
                  {/* Summary chips */}
                  <div className="flex gap-2">
                    <span className="flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-100 rounded-full px-3 py-1 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {validRows.length} valid
                    </span>
                    {errorRows.length > 0 && (
                      <span className="flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-100 rounded-full px-3 py-1 text-xs font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {errorRows.length} with errors (will be skipped)
                      </span>
                    )}
                  </div>

                  {/* Error rows detail */}
                  {errorRows.length > 0 && (
                    <div className="border border-red-100 rounded-xl overflow-hidden">
                      <div className="bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                        Rows with errors (skipped on import)
                      </div>
                      <div className="divide-y divide-red-50 max-h-40 overflow-y-auto">
                        {errorRows.map((r) => (
                          <div key={r.rowIndex} className="px-3 py-2 text-xs">
                            <span className="font-medium text-gray-700">Row {r.rowIndex + 1}</span>
                            {r.name && <span className="text-gray-400"> · {r.name}</span>}
                            <span className="text-red-600"> — {r.errors.join('; ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Valid rows preview table */}
                  {validRows.length > 0 && (
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        Preview — {validRows.length} people to import
                      </div>
                      <div className="divide-y divide-gray-50 max-h-44 overflow-y-auto">
                        {validRows.map((r) => (
                          <div key={r.rowIndex} className="px-3 py-2 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-medium text-gray-800">{r.name}</span>
                              <span className="text-gray-400 ml-1.5">· {r.role}</span>
                            </div>
                            <span className="text-blue-700 font-semibold">₹{r.wallet_amount.toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
          {/* Download template link */}
          <button
            type="button"
            onClick={downloadSampleTemplate}
            className="flex items-center gap-1.5 text-xs text-[#2F6DB5] hover:text-[#255a96] font-semibold transition underline underline-offset-2"
          >
            <Download className="w-3.5 h-3.5" />
            Download Sample Template for Wallet Roster
          </button>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition"
            >
              Close
            </button>
            {!result && (
              <button
                onClick={handleUpload}
                disabled={!validRows.length || uploading}
                className="px-5 py-2 rounded-lg bg-[#2F6DB5] hover:bg-[#255a96] disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold transition flex items-center gap-1.5 shadow-xs"
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                ) : (
                  <><Upload className="w-4 h-4" /> Upload</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
