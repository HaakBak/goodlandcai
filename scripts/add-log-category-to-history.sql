/**
 * add-log-category-to-history.sql
 * 
 * Migration to add log_category column to history table
 * This enables separation of SYSTEM_OPERATION and BUSINESS_OPERATION logs
 * 
 * WHAT THIS DOES:
 * 1. Adds log_category column (default: 'SYSTEM_OPERATION')
 * 2. Creates index for faster filtering by category
 * 3. Ensures existing logs are categorized as SYSTEM_OPERATION
 * 
 * CATEGORIES:
 * - SYSTEM_OPERATION: Auth logs, security events (admin view only)
 * - BUSINESS_OPERATION: Transactions, inventory, alerts (manager view)
 * 
 * Instructions:
 * 1. Go to Supabase Dashboard > SQL Editor
 * 2. Create new query
 * 3. Paste this entire script
 * 4. Run the query
 * 5. Verify in Data Editor: history table should have log_category column
 * 
 * Rollback (if needed):
 * ALTER TABLE history DROP COLUMN log_category;
 * DROP INDEX idx_history_category;
 */

-- ============================================================================
-- STEP 1: Add log_category column
-- ============================================================================

ALTER TABLE history 
ADD COLUMN log_category VARCHAR(50) 
DEFAULT 'SYSTEM_OPERATION' 
CHECK (log_category IN ('SYSTEM_OPERATION', 'BUSINESS_OPERATION'));

-- ============================================================================
-- STEP 2: Create index for faster queries by category
-- ============================================================================

CREATE INDEX idx_history_category ON history(log_category);

-- ============================================================================
-- STEP 3: Categorize existing logs
-- ============================================================================

-- Transaction-related logs → BUSINESS_OPERATION
UPDATE history 
SET log_category = 'BUSINESS_OPERATION' 
WHERE type IN (
  'Employee Transaction',
  'Transaction Completed',
  'Inventory Added',
  'Inventory Updated',
  'Inventory Removed',
  'Inventory Low Stock Alert',
  'Item Expiration Alert',
  'Menu Item Added',
  'Menu Item Updated',
  'Menu Item Removed',
  'Recipe Changed',
  'Daily Report Generated'
);

-- Authentication/Security logs stay SYSTEM_OPERATION (default)
-- User Signup, Login, Logout, etc.

-- ============================================================================
-- STEP 4: Verification Queries
-- ============================================================================

-- Check that column was added:
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'history' AND column_name = 'log_category';

-- Count logs by category:
-- SELECT log_category, COUNT(*) as count 
-- FROM history 
-- GROUP BY log_category;

-- Verify index exists:
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'history' AND indexname = 'idx_history_category';

-- ============================================================================
-- STEP 5: Update RLS Policies (if needed)
-- ============================================================================

-- Current policies still work because:
-- - Employees see own logs (user_id = auth.uid()) regardless of category
-- - Managers see all logs (role IN ('Manager', 'Administrator')) regardless of category
-- - Admin tools will filter by category in application code

-- Optional: Create policy to specifically hide BUSINESS_OPERATION from employees viewing admin console
-- (Not required - frontend filtering is sufficient)

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- After running this script:
-- 1. Restart dev server (npm run dev)
-- 2. History table can now categorize logs by type
-- 3. AdminView will show SYSTEM_OPERATION only
-- 4. ManagerHistory will show BUSINESS_OPERATION only
-- 5. logger.db() wrapper will set category automatically
