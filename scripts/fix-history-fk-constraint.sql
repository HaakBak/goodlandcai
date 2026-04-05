/**
 * fix-history-fk-constraint.sql
 * 
 * Migration script to fix the history table foreign key constraint issue.
 * 
 * Problem:
 * - history.user_id is NOT NULL and has FK constraint to user_profiles(id)
 * - During signup, addHistoryLog() called without user_id available yet
 * - Causes "Key is not present in table 'user_profiles'" error
 * 
 * Solution:
 * - Make user_id NULLABLE (audit logs can exist without a user context)
 * - Update addHistoryLog to pass user_id explicitly
 * - Clean up any orphaned history records with NULL user_id
 * 
 * Instructions:
 * 1. Copy this entire SQL script
 * 2. Go to Supabase Dashboard > SQL Editor
 * 3. Create new query
 * 4. Paste this script
 * 5. Run the query
 * 6. Verify: Check history table schema, should show user_id as nullable
 * 
 * After running this script:
 * - Restart dev server
 * - Test signup/login - should not get FK errors
 */

-- ============================================================================
-- STEP 1: Add temporary column to store old data
-- ============================================================================
-- This allows us to preserve any existing history during the migration

ALTER TABLE history 
ADD COLUMN user_id_nullable UUID REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Copy existing data to new column
UPDATE history 
SET user_id_nullable = user_id 
WHERE user_id IS NOT NULL;

-- ============================================================================
-- STEP 2: Drop the old NOT NULL constraint
-- ============================================================================
-- We need to drop the old column and recreate it as nullable

-- Drop the old foreign key constraint (PostgreSQL will auto-name it)
ALTER TABLE history 
DROP CONSTRAINT history_user_id_fkey;

-- Drop the old NOT NULL column
ALTER TABLE history 
DROP COLUMN user_id;

-- ============================================================================
-- STEP 3: Rename the new nullable column back to user_id
-- ============================================================================
ALTER TABLE history 
RENAME COLUMN user_id_nullable TO user_id;

-- Recreate the index on user_id (it was dropped when column was dropped)
CREATE INDEX idx_history_user_id ON history(user_id);

-- ============================================================================
-- STEP 4: Verification queries (run these to confirm the migration)
-- ============================================================================
-- 
-- Check history table structure:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'history' 
-- ORDER BY ordinal_position;
--
-- Check FK constraints:
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'history';
--
-- Check sample data:
-- SELECT id, user_id, type, description, created_at 
-- FROM history 
-- LIMIT 5;
-- ============================================================================

-- ============================================================================
-- STEP 5: RLS Policy Update (optional but recommended)
-- ============================================================================
-- The existing policy "Employees read own history" will still work
-- because PostgreSQL handles NULL in comparisons correctly
-- (NULL = auth.uid()::uuid evaluates to NULL/false, not error)

-- Optional: Add explicit NULL handling if needed
-- CREATE POLICY "View system logs without user" ON history
--   FOR SELECT USING (user_id IS NULL);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- The history table now allows NULL user_id values
-- This prevents FK errors when logging events without a user context
-- 
-- Next: Update src/services/databaseService.js addHistoryLog to pass user_id
-- And: Update src/pages/Login.jsx to pass userId to addHistoryLog calls
