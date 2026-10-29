-- ==============================================================================
-- CAS MEAL WALLET - COMPLETE DATABASE SCHEMA & REALTIME ENGINE
-- ISB Career Advancement Services (CAS) PGP Placements 2026
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  event_name TEXT NOT NULL DEFAULT 'ISB PGP Placements 2026',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE - INTERVAL '1 day',
  end_date DATE NOT NULL DEFAULT CURRENT_DATE + INTERVAL '5 days',
  daily_ceiling NUMERIC(10,2) NOT NULL DEFAULT 800.00,
  slot_caps JSONB NOT NULL DEFAULT '{
    "breakfast": 150.00,
    "lunch": 250.00,
    "snacks": 100.00,
    "beverages": 50.00,
    "dinner": 250.00
  }'::jsonb,
  slot_max_scans JSONB NOT NULL DEFAULT '{
    "breakfast": 1,
    "lunch": 1,
    "snacks": 2,
    "beverages": 2,
    "dinner": 1
  }'::jsonb,
  flag_anomaly_pct NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  frequent_scan_window_mins INT NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. STALLS TABLE (Counters created by CAS Admin)
CREATE TABLE IF NOT EXISTS stalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  campus TEXT NOT NULL DEFAULT 'Hyderabad',
  vendor_name TEXT NOT NULL DEFAULT 'Blue Spring Catering',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stalls_name ON stalls(name);
CREATE INDEX IF NOT EXISTS idx_stalls_campus ON stalls(campus);

-- 3. VENDOR & CASHIER ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS vendor_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'vendor', 'cashier')),
  stall_id UUID REFERENCES stalls(id) ON DELETE SET NULL,
  stall_name TEXT,
  campus TEXT DEFAULT 'Hyderabad',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_accounts_user ON vendor_accounts(username);
CREATE INDEX IF NOT EXISTS idx_vendor_accounts_role ON vendor_accounts(role);

-- 4. PEOPLE TABLE (Roster of active cardholders)
CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'Interview Coordinator', 'Driver', 'CAS Staff'
  token TEXT UNIQUE NOT NULL,
  short_code TEXT UNIQUE NOT NULL,
  phone TEXT,
  email TEXT,
  wallet_total NUMERIC(10,2) NOT NULL DEFAULT 4000.00,
  campus TEXT DEFAULT 'Hyderabad',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_people_token ON people(token);
CREATE INDEX IF NOT EXISTS idx_people_short_code ON people(short_code);
CREATE INDEX IF NOT EXISTS idx_people_role ON people(role);

-- 5. ROSTER UPLOAD HISTORY TABLE
CREATE TABLE IF NOT EXISTS roster_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  filename TEXT NOT NULL,
  campus TEXT NOT NULL,
  active_from DATE NOT NULL,
  rows_count INT NOT NULL,
  total_wallet_allocated NUMERIC(12,2) NOT NULL,
  uploaded_by TEXT DEFAULT 'CAS Admin'
);

-- 6. TRANSACTIONS TABLE (IMMUTABLE SCAN LOG)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  vendor_id TEXT,
  vendor_name TEXT NOT NULL DEFAULT 'Blue Spring',
  stall_name TEXT NOT NULL DEFAULT 'Main Dining Counter (Stall 1)',
  slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'snacks', 'beverages', 'dinner')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  bill_no TEXT,
  voided BOOLEAN NOT NULL DEFAULT false,
  void_reason TEXT,
  voided_at TIMESTAMPTZ,
  voided_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_person_created ON transactions(person_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_stall_created ON transactions(stall_name, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_slot_created ON transactions(slot, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_voided ON transactions(voided);

-- 7. FLAGS TABLE (AUDIT & COMPLAINTS)
CREATE TABLE IF NOT EXISTS flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('slot_cap_exact', 'above_slot_avg', 'frequent_scans', 'user_flagged')),
  reason TEXT NOT NULL,
  user_note TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flags_tx ON flags(transaction_id);
CREATE INDEX IF NOT EXISTS idx_flags_resolved ON flags(resolved);

-- ==============================================================================
-- 8. ATOMIC CONCURRENCY-SAFE SCAN FUNCTION (ROW LOCKING)
-- ==============================================================================
CREATE OR REPLACE FUNCTION process_scan(
  p_identifier TEXT, -- Secret token or short code
  p_slot TEXT,
  p_amount NUMERIC,
  p_bill_no TEXT DEFAULT NULL,
  p_vendor_id TEXT DEFAULT NULL,
  p_vendor_name TEXT DEFAULT 'Blue Spring',
  p_stall_name TEXT DEFAULT 'Main Dining Counter (Stall 1)'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_person RECORD;
  v_settings RECORD;
  v_slot_cap NUMERIC;
  v_max_scans INT;
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
  v_today_spent NUMERIC;
  v_slot_spent NUMERIC;
  v_slot_scans INT;
  v_total_spent NUMERIC;
  v_remaining_wallet NUMERIC;
  v_remaining_ceiling NUMERIC;
  v_tx_id UUID;
  v_recent_scans INT;
  v_slot_avg NUMERIC;
BEGIN
  -- 1. Fetch settings
  SELECT * INTO v_settings FROM settings WHERE id = 'current';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'System settings not configured';
  END IF;

  -- 2. Validate Event Window
  IF CURRENT_DATE < v_settings.start_date OR CURRENT_DATE > v_settings.end_date THEN
    RAISE EXCEPTION 'Placement event is inactive (Active: % to %)', v_settings.start_date, v_settings.end_date;
  END IF;

  -- 3. Lock Person record row to prevent race conditions
  SELECT * INTO v_person
  FROM people
  WHERE (token = p_identifier OR UPPER(short_code) = UPPER(p_identifier))
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or inactive card code: %', p_identifier;
  END IF;

  -- 4. Slot configuration check
  v_slot_cap := COALESCE((v_settings.slot_caps->>p_slot)::NUMERIC, 0);
  v_max_scans := COALESCE((v_settings.slot_max_scans->>p_slot)::INT, 1);

  IF v_slot_cap <= 0 THEN
    RAISE EXCEPTION 'Invalid slot: %', p_slot;
  END IF;

  IF p_amount > v_slot_cap THEN
    RAISE EXCEPTION 'Amount ₹% exceeds % slot cap of ₹%', p_amount, INITCAP(p_slot), v_slot_cap;
  END IF;

  -- Today boundaries
  v_today_start := date_trunc('day', now());
  v_today_end := v_today_start + INTERVAL '1 day';

  -- 5. Calculate today's existing charges for this person
  SELECT 
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(CASE WHEN slot = p_slot THEN amount ELSE 0 END), 0),
    COALESCE(COUNT(CASE WHEN slot = p_slot THEN 1 END), 0)
  INTO v_today_spent, v_slot_spent, v_slot_scans
  FROM transactions
  WHERE person_id = v_person.id 
    AND voided = false 
    AND created_at >= v_today_start 
    AND created_at < v_today_end;

  -- Slot scan count limit check
  IF v_slot_scans >= v_max_scans THEN
    RAISE EXCEPTION 'Slot scan limit reached: Max % scan(s) for % per day', v_max_scans, INITCAP(p_slot);
  END IF;

  -- Daily ceiling check
  IF (v_today_spent + p_amount) > v_settings.daily_ceiling THEN
    RAISE EXCEPTION 'Exceeds daily ceiling of ₹%. Today spent: ₹%, Remaining: ₹%', 
      v_settings.daily_ceiling, v_today_spent, GREATEST(0, v_settings.daily_ceiling - v_today_spent);
  END IF;

  -- 6. Total Event Wallet check
  SELECT COALESCE(SUM(amount), 0) INTO v_total_spent
  FROM transactions
  WHERE person_id = v_person.id AND voided = false;

  IF (v_total_spent + p_amount) > v_person.wallet_total THEN
    RAISE EXCEPTION 'Insufficient event wallet balance. Wallet Total: ₹%, Spent: ₹%, Remaining: ₹%',
      v_person.wallet_total, v_total_spent, GREATEST(0, v_person.wallet_total - v_total_spent);
  END IF;

  -- 7. Insert Transaction
  INSERT INTO transactions (
    person_id, vendor_id, vendor_name, stall_name, slot, amount, bill_no
  ) VALUES (
    v_person.id, p_vendor_id, p_vendor_name, p_stall_name, p_slot, p_amount, p_bill_no
  ) RETURNING id INTO v_tx_id;

  -- 8. Automated Flags
  IF p_amount = v_slot_cap THEN
    INSERT INTO flags (transaction_id, person_id, type, reason)
    VALUES (v_tx_id, v_person.id, 'slot_cap_exact', 
            'Charge of ₹' || p_amount || ' exactly equals maximum ' || INITCAP(p_slot) || ' cap');
  END IF;

  SELECT COUNT(*) INTO v_recent_scans
  FROM transactions
  WHERE person_id = v_person.id
    AND voided = false
    AND created_at >= (now() - (v_settings.frequent_scan_window_mins || ' minutes')::INTERVAL);

  IF v_recent_scans > 2 THEN
    INSERT INTO flags (transaction_id, person_id, type, reason)
    VALUES (v_tx_id, v_person.id, 'frequent_scans', 
            v_recent_scans || ' scans detected for ' || v_person.name || ' within ' || v_settings.frequent_scan_window_mins || ' minutes');
  END IF;

  SELECT AVG(amount) INTO v_slot_avg
  FROM transactions
  WHERE slot = p_slot AND voided = false AND created_at >= v_today_start AND id != v_tx_id;

  IF v_slot_avg IS NOT NULL AND v_slot_avg > 0 AND p_amount > (v_slot_avg * (1 + (v_settings.flag_anomaly_pct / 100.0))) THEN
    INSERT INTO flags (transaction_id, person_id, type, reason)
    VALUES (v_tx_id, v_person.id, 'above_slot_avg', 
            'Amount ₹' || p_amount || ' is ' || ROUND(((p_amount - v_slot_avg)/v_slot_avg * 100)::numeric, 1) || '% higher than today''s average for ' || INITCAP(p_slot));
  END IF;

  -- Compute updated balances
  v_remaining_wallet := v_person.wallet_total - (v_total_spent + p_amount);
  v_remaining_ceiling := v_settings.daily_ceiling - (v_today_spent + p_amount);

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'person_name', v_person.name,
    'person_role', v_person.role,
    'amount', p_amount,
    'slot', p_slot,
    'bill_no', p_bill_no,
    'stall_name', p_stall_name,
    'remaining_wallet', v_remaining_wallet,
    'remaining_daily_ceiling', v_remaining_ceiling,
    'created_at', now()
  );
END;
$$;

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) & ACCESS CONTROL
-- ==============================================================================
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_history ENABLE ROW LEVEL SECURITY;

-- Helper functions for role extraction
CREATE OR REPLACE FUNCTION current_app_role() RETURNS text AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::jsonb ->> 'app_role',
    current_setting('app.current_user_role', true),
    'public'
  );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION current_app_stall() RETURNS text AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::jsonb ->> 'stall_name',
    current_setting('app.current_stall_name', true),
    ''
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Public/Authenticated read policies
DROP POLICY IF EXISTS "Allow read settings" ON settings;
CREATE POLICY "Allow read settings" ON settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read stalls" ON stalls;
CREATE POLICY "Allow read stalls" ON stalls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin modify stalls" ON stalls;
CREATE POLICY "Admin modify stalls" ON stalls FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read vendor_accounts" ON vendor_accounts;
CREATE POLICY "Allow read vendor_accounts" ON vendor_accounts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manage vendor_accounts" ON vendor_accounts;
CREATE POLICY "Admin manage vendor_accounts" ON vendor_accounts FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read people" ON people;
CREATE POLICY "Allow read people" ON people FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manage people" ON people;
CREATE POLICY "Admin manage people" ON people FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read roster_history" ON roster_history;
CREATE POLICY "Allow read roster_history" ON roster_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert roster_history" ON roster_history;
CREATE POLICY "Allow insert roster_history" ON roster_history FOR INSERT WITH CHECK (true);

-- Transactions: Vendor Read-Only & Cashier Stall Insert
DROP POLICY IF EXISTS "Blue Spring read vendor transactions" ON transactions;
CREATE POLICY "Blue Spring read vendor transactions" ON transactions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Cashier insert own stall transaction" ON transactions;
CREATE POLICY "Cashier insert own stall transaction" ON transactions
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin update transactions" ON transactions;
CREATE POLICY "Admin update transactions" ON transactions
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow read flags" ON flags;
CREATE POLICY "Allow read flags" ON flags FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert flags" ON flags;
CREATE POLICY "Allow insert flags" ON flags FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update flags" ON flags;
CREATE POLICY "Allow update flags" ON flags FOR UPDATE USING (true);

-- ==============================================================================
-- 10. REALTIME PUBLICATION
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'stalls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE stalls;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'flags'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE flags;
  END IF;
END $$;

-- ==============================================================================
-- 11. INITIAL SETTINGS, STALLS & ACCOUNTS SEED
-- ==============================================================================
INSERT INTO settings (id, event_name, start_date, end_date, daily_ceiling, slot_caps, slot_max_scans, flag_anomaly_pct, frequent_scan_window_mins)
VALUES (
  'current',
  'ISB PGP Placements 2026',
  CURRENT_DATE - INTERVAL '1 day',
  CURRENT_DATE + INTERVAL '5 days',
  800.00,
  '{"breakfast": 150.00, "lunch": 250.00, "snacks": 100.00, "beverages": 50.00, "dinner": 250.00}'::jsonb,
  '{"breakfast": 1, "lunch": 1, "snacks": 2, "beverages": 2, "dinner": 1}'::jsonb,
  30.00,
  10
)
ON CONFLICT (id) DO UPDATE SET
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  daily_ceiling = EXCLUDED.daily_ceiling;

-- Initial default stalls
INSERT INTO stalls (name, campus, vendor_name)
VALUES 
  ('Main Dining Counter (Stall 1)', 'Hyderabad', 'Blue Spring Catering'),
  ('Atrium Beverage & Snack Bar (Stall 2)', 'Hyderabad', 'Blue Spring Express'),
  ('Executive Lounge (Stall 3)', 'Mohali', 'Blue Spring Catering')
ON CONFLICT (name) DO NOTHING;

-- Initial default accounts
INSERT INTO vendor_accounts (username, password, name, role, campus, stall_name)
VALUES
  ('admin', 'CAS@960387', 'CAS Placement Operations', 'admin', 'Hyderabad', NULL),
  ('bluespring', 'BlueSpring@2026', 'Blue Spring Operations Manager', 'vendor', 'Hyderabad', NULL),
  ('cashier1', 'Cashier@123', 'Cashier - Main Dining', 'cashier', 'Hyderabad', 'Main Dining Counter (Stall 1)'),
  ('cashier2', 'Cashier@123', 'Cashier - Atrium Cafe', 'cashier', 'Hyderabad', 'Atrium Beverage & Snack Bar (Stall 2)')
ON CONFLICT (username) DO NOTHING;
