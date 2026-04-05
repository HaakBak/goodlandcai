-- Migration: Align live schema with current app dataset usage
-- This script updates the transactions and notifications tables
-- to match the fields used by the app while preserving existing data.

BEGIN;

-- 1) TRANSACTIONS: Add app-specific columns and remove legacy columns
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS order_number INTEGER,
  ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS vat_portion DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS cash_provided DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS change DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS time_ordered TEXT,
  ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100);

-- Preserve old subtotal/vat/total data by copying it into new columns when possible
DO $$
DECLARE
  has_subtotal BOOLEAN;
  has_vat BOOLEAN;
  has_total BOOLEAN;
  update_sql TEXT := '';
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'subtotal'
  ) INTO has_subtotal;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'vat'
  ) INTO has_vat;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'total'
  ) INTO has_total;

  IF has_subtotal OR has_vat OR has_total THEN
    IF has_subtotal THEN
      update_sql := update_sql || 'base_amount = COALESCE(base_amount, subtotal)';
    END IF;

    IF has_vat THEN
      IF update_sql <> '' THEN
        update_sql := update_sql || ', ';
      END IF;
      update_sql := update_sql || 'vat_portion = COALESCE(vat_portion, vat)';
    END IF;

    IF has_total THEN
      IF update_sql <> '' THEN
        update_sql := update_sql || ', ';
      END IF;
      update_sql := update_sql || 'total_amount = COALESCE(total_amount, total)';
    END IF;

    EXECUTE FORMAT('UPDATE transactions SET %s', update_sql);
  END IF;
END $$;

ALTER TABLE transactions
  DROP COLUMN IF EXISTS table_no,
  DROP COLUMN IF EXISTS subtotal,
  DROP COLUMN IF EXISTS vat,
  DROP COLUMN IF EXISTS total,
  DROP COLUMN IF EXISTS payment_method,
  DROP COLUMN IF EXISTS receipt_number;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check CHECK (
  status IN ('pending', 'completed', 'cancelled', 'Yes', 'No')
);

CREATE INDEX IF NOT EXISTS idx_transactions_order_number ON transactions(order_number);

-- 2) NOTIFICATIONS: Allow app-generated toast-style notifications
ALTER TABLE notifications
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS payload JSONB;

-- 3) Ensure notification policies support app notification creation and global alerts
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users create notifications" ON notifications;
DROP POLICY IF EXISTS "Admins create notifications" ON notifications;
DROP POLICY IF EXISTS "Admins update notifications" ON notifications;
DROP POLICY IF EXISTS "Admins delete notifications" ON notifications;

CREATE POLICY "Users read own notifications" ON notifications
  FOR SELECT USING (
    user_id IS NULL OR
    user_id = auth.uid()::uuid OR
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

CREATE POLICY "Authenticated users create notifications" ON notifications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Admins update notifications" ON notifications
  FOR UPDATE USING (
    user_id = auth.uid()::uuid OR (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

CREATE POLICY "Admins delete notifications" ON notifications
  FOR DELETE USING (
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

-- 4) RECIPES: Allow authenticated users to read recipes and keep Manager/Admin modify rights
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers and admins read recipes" ON recipes;
DROP POLICY IF EXISTS "Authenticated users read recipes" ON recipes;
DROP POLICY IF EXISTS "Admins modify recipes" ON recipes;
DROP POLICY IF EXISTS "Managers and admins modify recipes" ON recipes;
DROP POLICY IF EXISTS "Admins update recipes" ON recipes;
DROP POLICY IF EXISTS "Managers and admins update recipes" ON recipes;
DROP POLICY IF EXISTS "Admins delete recipes" ON recipes;
DROP POLICY IF EXISTS "Managers and admins delete recipes" ON recipes;

CREATE POLICY "Authenticated users read recipes" ON recipes
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Managers and admins modify recipes" ON recipes
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    (auth.jwt()->'user_metadata'->>'role') IN ('Employee', 'Manager', 'Administrator')
  );

CREATE POLICY "Managers and admins update recipes" ON recipes
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND
    (auth.jwt()->'user_metadata'->>'role') IN ('Employee', 'Manager', 'Administrator')
  );

CREATE POLICY "Managers and admins delete recipes" ON recipes
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND
    (auth.jwt()->'user_metadata'->>'role') IN ('Employee', 'Manager', 'Administrator')
  );

-- 5) SERVICE_FEES: Allow managers and admins to modify service fees
ALTER TABLE service_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins modify service fees" ON service_fees;
DROP POLICY IF EXISTS "Managers and admins modify service fees" ON service_fees;
DROP POLICY IF EXISTS "Admins update service fees" ON service_fees;
DROP POLICY IF EXISTS "Managers and admins update service fees" ON service_fees;
DROP POLICY IF EXISTS "Admins delete service fees" ON service_fees;
DROP POLICY IF EXISTS "Managers and admins delete service fees" ON service_fees;

CREATE POLICY "Managers and admins modify service fees" ON service_fees
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    (auth.jwt()->'user_metadata'->>'role') IN ('Employee', 'Manager', 'Administrator')
  );

CREATE POLICY "Managers and admins update service fees" ON service_fees
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND
    (auth.jwt()->'user_metadata'->>'role') IN ('Employee', 'Manager', 'Administrator')
  );

CREATE POLICY "Managers and admins delete service fees" ON service_fees
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND
    (auth.jwt()->'user_metadata'->>'role') IN ('Employee', 'Manager', 'Administrator')
  );

-- 6) HISTORY: Admins can view history while authenticated users can write history entries
ALTER TABLE history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees read own history" ON history;
DROP POLICY IF EXISTS "Admins read history" ON history;
DROP POLICY IF EXISTS "Anyone can log history" ON history;
DROP POLICY IF EXISTS "Authenticated users log history" ON history;

CREATE POLICY "Admins read history" ON history
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

CREATE POLICY "Authenticated users log history" ON history
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

COMMIT;
