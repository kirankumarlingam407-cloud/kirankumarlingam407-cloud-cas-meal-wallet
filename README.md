# CAS Meal Wallet 🍱💳
### ISB Career Advancement Services (CAS) • PGP Placements Food Spending Portal

A mobile-first, high-contrast digital wallet portal designed for **ISB Career Advancement Services (CAS)** to manage meal spending for interview coordinators, company drivers, student volunteers, and CAS staff during PGP Placements.

Replaces paper meal tokens with auditable digital rupee wallets. Food vendor **Blue Spring** scans candidate/staff QR codes at food counters, logs actual bills, and CAS reconciles payments exclusively against verified digital logs.

---

## 🚀 Key Features

### 1. Person Wallet Pass (`/w/[token]`)
- **Zero Login Friction**: Instant access via unique, cryptographically random private link.
- **High-Contrast Big QR Code**: Encodes **only** the secret token (never personal data or database IDs).
- **Live Balances**:
  - Event Total Wallet remaining (with carry-forward tracking from prior days).
  - Today's remaining daily ceiling (resets daily at midnight).
- **Real-Time Activity Feed**: Scans appear on the person's phone in real-time.
- **"Flag This Charge"**: Allows cardholders to report inflated bills or incorrect stall entries with a note.
- **PWA Ready**: Works with "Add to Home Screen" on iOS Safari and Android Chrome for instant 1-tap stall access.

### 2. Vendor Scanner Terminal (`/scan`)
- **Cashier-Optimized**: Designed for bright outdoor counters with large touch targets.
- **Meal Slot Selection Bar**: Quick slot selection with live cap display:
  - Breakfast (Cap ₹150)
  - Lunch (Cap ₹250)
  - Snacks (Cap ₹100, max 2 scans/day)
  - Beverages (Cap ₹50, max 2 scans/day)
  - Dinner (Cap ₹250)
- **High-Speed Scanner Viewport**: Camera QR scanner with targeting brackets and animated laser beam.
- **Manual Short Code Fallback**: Direct 1-tap lookup using 5-character short codes (e.g. `CAS01`, `CAS02`) if camera is unavailable or QR is damaged.
- **Quick Touch Numeric Keypad**: Rapid bill entry (1-9, 0, 00, Clear, Backspace) + quick amount chips (`+₹50`, `+₹100`, `Max Cap`).
- **High-Contrast Result Overlays**:
  - **Big GREEN**: Confetti celebration, name, charged amount, new wallet balance, and today's remaining ceiling.
  - **Big RED**: High-visibility rejection reason (e.g. *"Exceeds daily ceiling of ₹800"*, *"Amount ₹180 exceeds Snacks cap of ₹100"*, *"Slot scan limit reached (Max 2 scans)"*).
- **Audit Lock**: Vendor cannot edit or void a transaction after confirmation.

### 3. CAS Admin Dashboard (`/admin`)
- **Live Spend Metrics**: Today's spend, spend to date, total scan count, active audit flags, and slot-by-slot volume.
- **Transaction Audit & Void**: Full filterable feed with an admin-only **Void Transaction** modal requiring a mandatory reason and preserving full audit logs.
- **Automated Anomaly & Abuse Detection**:
  - Scans with amount exactly equal to slot cap.
  - Scans &gt; 30% above slot's daily average.
  - Rapid scans (&gt; 2 scans for the same person within 10 minutes).
  - Person-flagged complaints with cardholder notes.
- **Blue Spring Billing Reconciliation & CSV Export**: Downloadable official settlement statement grouped by day and slot. CAS pays Blue Spring exclusively from this number.
- **Bulk Personnel Onboarding via CSV**: Upload name, role, phone, email, and wallet allocation to automatically generate encrypted tokens and short codes.
- **Policy Rules Configurator**: Edit event dates, daily ceilings, slot caps, scan count limits, and anomaly thresholds in real-time.

---

## 🏗️ Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (Executive Navy, Gold & High-Contrast Green/Red States)
- **Icons**: Lucide React
- **Animations**: Canvas Confetti
- **QR Engine**: `qrcode` (SVG / Canvas generation) & `html5-qrcode` (camera scanning)
- **Database**: Supabase (PostgreSQL with Row Level Security & Realtime) + Built-in High-Fidelity Local Engine Fallback

---

## 🛠️ Setup & Running Locally

### 1. Prerequisites
- Node.js 18+ or 20+
- npm or pnpm

### 2. Clone & Install
```bash
cd cas-meal-wallet
npm install
```

### 3. Environment Variables (`.env.local`)
Create a `.env.local` file in the root directory:
```env
# Optional: Supabase configuration (Dual-Engine automatically falls back to high-fidelity local demo mode if not provided)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Database Setup (Supabase)
If using Supabase:
1. Open your Supabase SQL Editor.
2. Run `supabase/schema.sql` to create tables, indexes, RLS policies, and the atomic concurrency-safe stored procedure `process_scan`.
3. Run `supabase/seed.sql` to populate sample people, vendors, and transactions.

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 👥 Demo Accounts & Pre-Seeded Personnel

| Role | Name | Short Code | Demo Pass URL | Wallet Allocation |
|---|---|---|---|---|
| Interview Coordinator | Aarav Sharma | `CAS01` | `/w/tok_aarav_sharma_98f21e847c2` | ₹5,000 |
| Interview Coordinator | Rhea Sen | `CAS02` | `/w/tok_rhea_sen_76b42a912d8` | ₹5,000 |
| CAS Staff | Vikramaditya Rao | `CAS03` | `/w/tok_vikram_rao_43c89d023f1` | ₹6,000 |
| CAS Staff | Pooja Hegde | `CAS04` | `/w/tok_pooja_hegde_12d45a678e9` | ₹6,000 |
| Driver | Ramesh Yadav | `CAS05` | `/w/tok_ramesh_yadav_55e67b890f2` | ₹3,000 |
| Driver | Suresh Kumar | `CAS06` | `/w/tok_suresh_kumar_88f90c123a4` | ₹3,000 |
| Student Volunteer | Tanvi Deshmukh | `CAS07` | `/w/tok_tanvi_deshmukh_33a12b456c7` | ₹4,000 |
| Interview Coordinator | Karan Malhotra | `CAS08` | `/w/tok_karan_malhotra_66b34c567d8` | ₹5,000 |
| Student Volunteer | Ananya Roy | `CAS09` | `/w/tok_ananya_roy_99c56d789e0` | ₹4,000 |
| Driver | Mohammed Farooq | `CAS10` | `/w/tok_farooq_driver_22d78e901f3` | ₹3,000 |

#### Vendor & Admin Stalls:
- **Blue Spring Stall 1**: Executive Dining Hall (Breakfast, Lunch, Dinner)
- **Blue Spring Stall 2**: Atrium Beverage & Snack Bar (Beverages, Snacks)
- **Admin**: CAS Operations Command Center (`/admin`)

---

## 🧪 Short Test Checklist

1. **Scan Success (Big GREEN)**:
   - Navigate to `/scan`.
   - Select `lunch` slot.
   - Enter `CAS02` in manual code entry (or scan Rhea Sen's QR).
   - Enter amount `₹180`, bill `#BS-301`, click **CHARGE ₹180**.
   - **Expected**: Big GREEN screen with confetti, cardholder name, amount charged, and remaining balance.
2. **Overspend Slot Cap Rejected (Big RED)**:
   - On `/scan`, select `snacks` slot (Cap: ₹100).
   - Enter `CAS01`.
   - Enter amount `₹150`, click Charge.
   - **Expected**: Big RED rejection screen stating *"Amount ₹150 exceeds SNACKS cap of ₹100"*.
3. **Daily Ceiling Rejected**:
   - On `/scan`, select `lunch` (Cap: ₹250).
   - Attempt a charge that pushes today's total past ₹800.
   - **Expected**: Big RED rejection screen showing daily ceiling exceeded with remaining balance.
4. **Carry-Forward Balance Validation**:
   - Open `/w/tok_aarav_sharma_98f21e847c2`.
   - Verify unspent balance from prior days carries forward and matches total wallet limit minus total event spend.
5. **Void Transaction (Admin Audit Trail)**:
   - Navigate to `/admin` -> **Transactions** tab.
   - Click **Void** on any valid transaction.
   - Enter mandatory reason: *"Duplicate scan reported by student"*.
   - Confirm void.
   - **Expected**: Transaction marked VOIDED, reason logged, cardholder wallet & daily ceiling refunded immediately.
6. **CSV Billing Export**:
   - On `/admin`, click **Export Billing CSV**.
   - **Expected**: CSV file downloaded with daily and slot-wise breakdown + itemized non-voided transaction list.
7. **Flag Charge (Person View)**:
   - On `/w/tok_vikram_rao_43c89d023f1`, click **Flag charge**.
   - Select reason *"Wrong amount charged"* and add a note.
   - **Expected**: Charge flagged; appears immediately in `/admin` under **Flags & Anomalies** tab.

---

## 🚀 Deploying to Vercel

1. Push your repository to GitHub.
2. Import the repository into [Vercel](https://vercel.com).
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` (optional)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional)
4. Click **Deploy**. Vercel will automatically build and deploy with zero configuration needed.
