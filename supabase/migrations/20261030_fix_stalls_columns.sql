-- ==============================================================================
-- CAS MEAL WALLET: FIX STALLS & PEOPLE MISSING COLUMNS
-- ==============================================================================

-- 1. Ensure stalls table has stall_code and code_active columns
ALTER TABLE stalls ADD COLUMN IF NOT EXISTS stall_code TEXT UNIQUE;
ALTER TABLE stalls ADD COLUMN IF NOT EXISTS code_active BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_stalls_code ON stalls(stall_code);

-- 2. Ensure people table has access_code column
ALTER TABLE people ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_people_access_code ON people(access_code);

-- 3. Seed initial default stalls if table is empty
INSERT INTO stalls (name, campus, vendor_name, stall_code, code_active)
VALUES 
  ('Main Dining Counter (Stall 1)', 'Hyderabad', 'Blue Spring Catering', 'STALL01', true),
  ('Atrium Beverage & Snack Bar (Stall 2)', 'Hyderabad', 'Blue Spring Express', 'STALL02', true),
  ('Executive Lounge (Stall 3)', 'Mohali', 'Blue Spring Catering', 'STALL03', true)
ON CONFLICT (name) DO UPDATE SET
  stall_code = COALESCE(stalls.stall_code, EXCLUDED.stall_code),
  code_active = COALESCE(stalls.code_active, EXCLUDED.code_active);

-- 4. Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
