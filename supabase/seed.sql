-- ==============================================================================
-- CAS MEAL WALLET - SEED DATA
-- 10 People (Coordinators, Drivers, CAS Staff), 2 Vendors, Transactions, Flags
-- ==============================================================================

-- 1. Insert Settings
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

-- 2. Insert Vendors
INSERT INTO vendors (id, username, password_hash, name, stall_name, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'bluespring_dining', 'vendor123', 'Blue Spring Catering', 'Executive Dining Hall - Stall 1', 'vendor'),
  ('22222222-2222-2222-2222-222222222222', 'bluespring_cafe', 'vendor123', 'Blue Spring Express', 'Atrium Beverage & Snack Bar - Stall 2', 'vendor')
ON CONFLICT (username) DO NOTHING;

-- 3. Insert 10 People
INSERT INTO people (id, name, role, token, short_code, phone, email, wallet_total) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Aarav Sharma', 'Interview Coordinator', 'tok_aarav_sharma_98f21e847c2', 'CAS01', '+91 98765 43210', 'aarav_sharma@isb.edu', 5000.00),
  ('a1000000-0000-0000-0000-000000000002', 'Rhea Sen', 'Interview Coordinator', 'tok_rhea_sen_76b42a912d8', 'CAS02', '+91 98765 43211', 'rhea_sen@isb.edu', 5000.00),
  ('a1000000-0000-0000-0000-000000000003', 'Vikramaditya Rao', 'CAS Staff', 'tok_vikram_rao_43c89d023f1', 'CAS03', '+91 98765 43212', 'vikram_rao@isb.edu', 6000.00),
  ('a1000000-0000-0000-0000-000000000004', 'Pooja Hegde', 'CAS Staff', 'tok_pooja_hegde_12d45a678e9', 'CAS04', '+91 98765 43213', 'pooja_hegde@isb.edu', 6000.00),
  ('a1000000-0000-0000-0000-000000000005', 'Ramesh Yadav', 'Driver', 'tok_ramesh_yadav_55e67b890f2', 'CAS05', '+91 98765 43214', 'ramesh_transport@isb.edu', 3000.00),
  ('a1000000-0000-0000-0000-000000000006', 'Suresh Kumar', 'Driver', 'tok_suresh_kumar_88f90c123a4', 'CAS06', '+91 98765 43215', 'suresh_transport@isb.edu', 3000.00),
  ('a1000000-0000-0000-0000-000000000007', 'Tanvi Deshmukh', 'Student Volunteer', 'tok_tanvi_deshmukh_33a12b456c7', 'CAS07', '+91 98765 43216', 'tanvi_deshmukh@isb.edu', 4000.00),
  ('a1000000-0000-0000-0000-000000000008', 'Karan Malhotra', 'Interview Coordinator', 'tok_karan_malhotra_66b34c567d8', 'CAS08', '+91 98765 43217', 'karan_malhotra@isb.edu', 5000.00),
  ('a1000000-0000-0000-0000-000000000009', 'Ananya Roy', 'Student Volunteer', 'tok_ananya_roy_99c56d789e0', 'CAS09', '+91 98765 43218', 'ananya_roy@isb.edu', 4000.00),
  ('a1000000-0000-0000-0000-000000000010', 'Mohammed Farooq', 'Driver', 'tok_farooq_driver_22d78e901f3', 'CAS10', '+91 98765 43219', 'farooq_transport@isb.edu', 3000.00)
ON CONFLICT (token) DO NOTHING;

-- 4. Sample Transactions (Past and Today)
INSERT INTO transactions (id, person_id, vendor_id, vendor_name, stall_name, slot, amount, bill_no, voided, created_at) VALUES
  -- Aarav Sharma (Yesterday)
  ('t0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Blue Spring Catering', 'Executive Dining Hall - Stall 1', 'breakfast', 120.00, 'BS-1001', false, now() - INTERVAL '1 day' + INTERVAL '8 hours'),
  ('t0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Blue Spring Catering', 'Executive Dining Hall - Stall 1', 'lunch', 220.00, 'BS-1045', false, now() - INTERVAL '1 day' + INTERVAL '13 hours'),
  ('t0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Blue Spring Express', 'Atrium Beverage & Snack Bar - Stall 2', 'beverages', 40.00, 'BS-1089', false, now() - INTERVAL '1 day' + INTERVAL '16 hours'),
  -- Aarav Sharma (Today)
  ('t0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Blue Spring Catering', 'Executive Dining Hall - Stall 1', 'breakfast', 140.00, 'BS-2012', false, now() - INTERVAL '2 hours'),
  -- Rhea Sen (Today - exact cap flag sample)
  ('t0000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Blue Spring Catering', 'Executive Dining Hall - Stall 1', 'lunch', 250.00, 'BS-2034', false, now() - INTERVAL '1 hour'),
  -- Vikramaditya Rao (Today - flagged by person)
  ('t0000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Blue Spring Express', 'Atrium Beverage & Snack Bar - Stall 2', 'snacks', 95.00, 'BS-2056', false, now() - INTERVAL '40 minutes')
ON CONFLICT (id) DO NOTHING;

-- 5. Seed Flags
INSERT INTO flags (id, transaction_id, person_id, type, reason, user_note, resolved) VALUES
  ('f0000000-0000-0000-0000-000000000001', 't0000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 'slot_cap_exact', 'Charge of ₹250.00 exactly equals maximum Lunch cap', NULL, false),
  ('f0000000-0000-0000-0000-000000000002', 't0000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000003', 'user_flagged', 'Flagged by cardholder on personal wallet portal', 'I only had one samosa (₹40), stall charged ₹95', false)
ON CONFLICT (id) DO NOTHING;
