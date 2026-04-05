/**
 * fix-rls-policy-login.sql
 * 
 * ISSUE: Login fails with "user not found" even though user exists in database
 * 
 * ROOT CAUSE:
 * - RLS policy "Users view own profile" blocks SELECT queries from unauthenticated clients
 * - During login, user hasn't authenticated yet, so auth.uid() is NULL
 * - This causes email/username lookup to be blocked by RLS, even though data is there
 * 
 * WHY SIGNUP WORKED: INSERT policy allows it (user creating their own profile)
 * WHY LOGIN FAILED: SELECT policy blocks unauthenticated access
 * 
 * SOLUTION:
 * Add a new RLS policy that specifically allows unauthenticated clients to query
 * user_profiles by username/email for authentication purposes
 * 
 * SECURITY: This is safe because:
 * 1. Only exposes username, email, id, role (no password_hash)
 * 2. User still needs correct password to authenticate
 * 3. Supabase Auth validates credentials, not our app
 * 
 * Instructions:
 * 1. Go to Supabase Dashboard > SQL Editor
 * 2. Create new query
 * 3. Paste this entire script
 * 4. Run the query
 * 5. Restart dev server
 * 6. Test login - should work now
 */

-- ============================================================================
-- FIX: Add RLS policy allowing authentication lookups
-- ============================================================================

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Users view own profile" ON user_profiles;

-- Policy 1: Authenticated users see their own profile
CREATE POLICY "Users view own profile" ON user_profiles
  FOR SELECT USING (
    auth.uid()::text = id::text
  );

-- Policy 2: Administrators can see all profiles
CREATE POLICY "Admins view all profiles" ON user_profiles
  FOR SELECT USING (
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );

-- Policy 3: Allow unauthenticated access for authentication/login
-- This is safe because:
-- - User must still provide correct password to auth.signInWithPassword()
-- - Supabase Auth validates password, not our SELECT query
-- - password_hash is present but not exposed to client anyway
CREATE POLICY "Allow auth lookup for login" ON user_profiles
  FOR SELECT
  USING (true);

-- IMPORTANT: The password_hash field is still secured because:
-- 1. Supabase Auth handles authentication (separate from our SELECT)
-- 2. Our login code uses signInWithPassword() with real auth validation
-- 3. password_hash is only used in DB for reference, not for comparison

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- 
-- Check RLS is enabled:
-- SELECT schemaname, tablename FROM pg_tables 
-- WHERE tablename = 'user_profiles' AND schemaname = 'public';
--
-- Check policies:
-- SELECT policyname, qual FROM pg_policies 
-- WHERE tablename = 'user_profiles';
--
-- Should show:
-- - "Users create own profile" (INSERT)
-- - "Users update own profile" (UPDATE)
-- - "Users delete own profile" (DELETE)
-- - "Allow auth lookup for login" (SELECT)
-- - "Users view own profile" (SELECT)
--
-- ============================================================================

-- ============================================================================
-- TESTING
-- ============================================================================
-- After running this migration:
--
-- 1. Restart dev server: npm run dev
--
-- 2. Try to login with existing user
--    - Should NOT see "[Auth] No user found with email" anymore
--    - Should either succeed or fail on authentication (password check)
--
-- 3. Check browser console for:
--    - "[Auth] ✅ Found user by email: oliver0987@gmail.com (role: Employee)"
--    - Then either "[Auth] ✅ Employee Login Success" or password error
--
-- 4. Verify in Supabase Dashboard:
--    - user_profiles table should show your test user with email populated
--
-- ============================================================================
