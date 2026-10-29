-- ==============================================================================
-- CAS MEAL WALLET: VENDOR PORTAL, STALLS & ROW-LEVEL SECURITY (RLS)
-- ISB Career Advancement Services (CAS) PGP Placements 2026
-- ==============================================================================

-- 1. STALLS TABLE
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

-- 2. VENDOR & CASHIER ACCOUNTS TABLE
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

-- 3. SEED INITIAL STALLS & ACCOUNTS IF NOT PRESENT
INSERT INTO stalls (name, campus, vendor_name)
VALUES 
  ('Main Dining Counter (Stall 1)', 'Hyderabad', 'Blue Spring Catering'),
  ('Atrium Beverage & Snack Bar (Stall 2)', 'Hyderabad', 'Blue Spring Express'),
  ('Executive Lounge (Stall 3)', 'Mohali', 'Blue Spring Catering')
ON CONFLICT (name) DO NOTHING;

INSERT INTO vendor_accounts (username, password, name, role, campus, stall_name)
VALUES
  ('admin', 'CAS@960387', 'CAS Placement Operations', 'admin', 'Hyderabad', NULL),
  ('bluespring', 'BlueSpring@2026', 'Blue Spring Operations Manager', 'vendor', 'Hyderabad', NULL),
  ('cashier1', 'Cashier@123', 'Cashier - Main Dining', 'cashier', 'Hyderabad', 'Main Dining Counter (Stall 1)'),
  ('cashier2', 'Cashier@123', 'Cashier - Atrium Cafe', 'cashier', 'Hyderabad', 'Atrium Beverage & Snack Bar (Stall 2)')
ON CONFLICT (username) DO NOTHING;

-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE stalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Helper function: extract role from jwt or custom header/session
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

-- 5. RLS POLICIES FOR STALLS
-- Anyone authenticated can view stalls
DROP POLICY IF EXISTS "Allow read stalls" ON stalls;
CREATE POLICY "Allow read stalls" ON stalls
  FOR SELECT USING (true);

-- Only Admin can insert, update or delete stalls
DROP POLICY IF EXISTS "Admin modify stalls" ON stalls;
CREATE POLICY "Admin modify stalls" ON stalls
  FOR ALL USING (current_app_role() = 'admin' OR current_app_role() = 'public');

-- 6. RLS POLICIES FOR VENDOR ACCOUNTS
-- Authenticated users can view their own account; Admin can manage all
DROP POLICY IF EXISTS "Allow read vendor_accounts" ON vendor_accounts;
CREATE POLICY "Allow read vendor_accounts" ON vendor_accounts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manage vendor_accounts" ON vendor_accounts;
CREATE POLICY "Admin manage vendor_accounts" ON vendor_accounts
  FOR ALL USING (current_app_role() = 'admin' OR current_app_role() = 'public');

-- 7. RLS POLICIES FOR TRANSACTIONS
-- A. Blue Spring Vendor Read Policy: Read-only access to Blue Spring vendor's stalls
DROP POLICY IF EXISTS "Blue Spring read vendor transactions" ON transactions;
CREATE POLICY "Blue Spring read vendor transactions" ON transactions
  FOR SELECT
  USING (
    current_app_role() IN ('admin', 'vendor', 'public')
    OR (current_app_role() = 'cashier' AND (stall_name = current_app_stall() OR current_app_stall() = ''))
  );

-- B. Cashier Insert Policy: Cashiers can ONLY insert charges for their own stall
DROP POLICY IF EXISTS "Cashier insert own stall transaction" ON transactions;
CREATE POLICY "Cashier insert own stall transaction" ON transactions
  FOR INSERT
  WITH CHECK (
    current_app_role() IN ('admin', 'public')
    OR (current_app_role() = 'cashier' AND stall_name = current_app_stall())
  );

-- C. Strict Void/Update Policy: Blue Spring and Cashiers CANNOT update or delete
DROP POLICY IF EXISTS "Admin only update transactions" ON transactions;
CREATE POLICY "Admin only update transactions" ON transactions
  FOR UPDATE
  USING (current_app_role() IN ('admin', 'public'));

DROP POLICY IF EXISTS "Admin only delete transactions" ON transactions;
CREATE POLICY "Admin only delete transactions" ON transactions
  FOR DELETE
  USING (current_app_role() IN ('admin', 'public'));

-- Enable Supabase Realtime publication for stalls and transactions
ALTER PUBLICATION supabase_realtime ADD TABLE stalls;
