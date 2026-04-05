-- ============================================================================
-- SUPABASE SQL: FIX INVENTORY TABLE PRIMARY KEY ERROR
-- ============================================================================
-- 
-- Purpose: Solve "Unable to delete row as table has no primary keys" error
-- Location: Supabase Dashboard → SQL Editor
-- Time: ~2 minutes
--
-- ============================================================================

-- STEP 1: Delete the broken inventory table
-- ============================================================================
DROP TABLE IF EXISTS inventory CASCADE;

-- ============================================================================
-- STEP 2: Recreate inventory table with PRIMARY KEY constraint
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  in_stock INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  unit VARCHAR(20),
  cost DECIMAL(10, 2),
  type VARCHAR(50),
  expiration_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: Add indexes for performance
-- ============================================================================
CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_in_stock ON inventory(in_stock);

-- ============================================================================
-- STEP 4: Enable Row Level Security (RLS)
-- ============================================================================
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies (Authorization)
-- ============================================================================

-- Policy 1: Managers & Admins can READ inventory
CREATE POLICY "Managers and admins read inventory" ON inventory
  FOR SELECT USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

-- Policy 2: Only Managers & Admins can INSERT
CREATE POLICY "Managers and admins modify inventory" ON inventory
  FOR INSERT WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

-- Policy 3: Only Managers & Admins can UPDATE
CREATE POLICY "Managers and admins update inventory" ON inventory
  FOR UPDATE USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

-- Policy 4: Only Managers & Admins can DELETE
CREATE POLICY "Managers and admins delete inventory" ON inventory
  FOR DELETE USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

-- ============================================================================
-- VERIFICATION: Check that PRIMARY KEY exists
-- ============================================================================
-- Run this to confirm:
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'inventory';
-- 
-- Expected result: Should show a row with constraint_type = 'PRIMARY KEY'
--
-- ============================================================================
-- NEXT STEP: Import the CSV data
-- ============================================================================
-- 
-- 1. Go to: Data → Import CSV
-- 2. Choose file: inventory_updated.csv
-- 3. Table: inventory (newly created)
-- 4. Click "Import"
-- 
-- Then verify:
-- SELECT COUNT(*) FROM inventory;  -- Should return: 20
--
-- ============================================================================
