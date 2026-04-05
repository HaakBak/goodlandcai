-- GoodLand Cafe POS - User Profiles Migration
-- Remove Phone Column from user_profiles Table
-- Version: 1.0.0
-- Date: March 24, 2026
--
-- IMPORTANT: This migration removes the phone column from the user_profiles table
-- Run this SQL in Supabase SQL Editor after backing up your data
--
-- Steps:
-- 1. Copy this entire script
-- 2. Go to Supabase Console → SQL Editor
-- 3. Create new query and paste this script
-- 4. Click "Run" button
-- 5. Verify the table structure (phone column should be gone)

-- ============================================================================
-- STEP 1: Drop any indexes that reference phone column
-- ============================================================================
-- (Note: There may not be explicit indexes on phone, but we check for constraints)

-- ============================================================================
-- STEP 2: Drop the phone column from user_profiles table
-- ============================================================================
ALTER TABLE user_profiles DROP COLUMN IF EXISTS phone;

-- ============================================================================
-- STEP 3: Verify the table structure (optional - for verification)
-- ============================================================================
-- Uncomment the line below to see the updated table structure
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name='user_profiles';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
-- Migration complete! The phone column has been removed from user_profiles table.
-- 
-- Updated user_profiles table now contains:
-- - id (UUID, PRIMARY KEY)
-- - username (VARCHAR(50), UNIQUE)
-- - password_hash (VARCHAR(255))
-- - email (VARCHAR(100))
-- - role (VARCHAR(50))
-- - status (VARCHAR(20))
-- - created_at (TIMESTAMP WITH TIME ZONE)
-- - updated_at (TIMESTAMP WITH TIME ZONE)
-- - last_login (TIMESTAMP WITH TIME ZONE)
--
-- The phone column is no longer stored. User phone numbers are not tracked
-- at the profile level in this version of the system.
-- ============================================================================
