# Fix Foreign Key Constraint on History Table - Implementation Guide

## Problem
When users signup or login, the system tries to log activity to the `history` table, but fails with:
```
FK error: "Key is not present in table 'user_profiles'"
```

## Root Cause
- The `history` table has `user_id UUID NOT NULL REFERENCES user_profiles(id)`
- During signup, `addHistoryLog()` is called **without** the user_id available yet
- This causes the foreign key constraint violation

## Solution (2-Step Process)

### Step 1: Update Supabase Schema (Make user_id Nullable)

**Go to Supabase Dashboard:**
1. Click **SQL Editor**
2. Create **new query**
3. Copy the entire contents of `scripts/fix-history-fk-constraint.sql`
4. Paste into the SQL editor
5. Click **Run** button

**What this does:**
- Makes `history.user_id` NULLABLE (audit logs can exist without user context)
- Preserves existing data during migration
- Recreates the foreign key constraint with NULL handling

**Verify the fix worked:**
In SQL Editor, run this verification query:
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'history' 
AND column_name = 'user_id';
```

Expected result:
```
column_name  | data_type | is_nullable
user_id      | uuid      | YES
```

---

### Step 2: Update Frontend Code (Already Done ✅)

The following fixes have already been applied:

**databaseService.js:**
- Updated `addHistoryLog()` to accept both `userId` and `user_id` parameters
- Now handles NULL user_id gracefully
- Improved logging for debugging

**Login.jsx:**
- All signup flows now pass userId explicitly to addHistoryLog()
- All login flows now pass userId explicitly to addHistoryLog()
- Session storage set BEFORE first history log call

---

## Testing the Fix

### 1. Restart Development Server
```bash
npm run dev
```

### 2. Test Employee Signup
1. Go to login page
2. Select **EMPLOYEE**
3. Create new employee account (new username/email)
4. ✅ Should succeed without FK errors
5. Check browser console - should see:
   ```
   [Employee Signup] Checking duplicate username...
   [Employee Signup] ✅ Username available...
   [DB] 📝 Adding history log [User Signup]...
   [DB] ✅ addHistoryLog() to Supabase
   [DB] 📝 Adding history log [Employee Login]...
   [DB] ✅ addHistoryLog() to Supabase
   ```

### 3. Test Manager Signup
1. Go to login page
2. Select **MANAGEMENT**
3. Create new manager account (new username/email)
4. ✅ Should succeed without FK errors
5. Check console for similar success logs

### 4. Test Login (Both Roles)
1. Login as existing employee
2. Login as existing manager
3. Both should log history correctly ✅

### 5. Verify History Was Logged
In Supabase Dashboard:
1. Go to **SQL Editor**
2. Run:
```sql
SELECT id, user_id, type, description, created_at 
FROM history 
ORDER BY created_at DESC 
LIMIT 10;
```

Expected:
- Recent entries from your signup/login tests
- user_id should NOT be NULL (it should have the actual user UUID)
- type should be 'User Signup', 'Employee Login', etc.

---

## Rollback (If Needed)

If something goes wrong, you can revert to the original schema:

```sql
-- Drop the nullable user_id constraint
ALTER TABLE history DROP CONSTRAINT IF EXISTS history_user_id_fkey;

-- Add back the NOT NULL constraint
ALTER TABLE history 
ALTER COLUMN user_id SET NOT NULL;

-- Recreate the foreign key
ALTER TABLE history 
ADD CONSTRAINT history_user_id_fkey FOREIGN KEY (user_id) 
REFERENCES user_profiles(id) ON DELETE CASCADE;
```

However, this may fail if any history records have NULL user_id. Delete those first:
```sql
DELETE FROM history WHERE user_id IS NULL;
```

---

## Files Modified

1. **scripts/fix-history-fk-constraint.sql** ← Run this in Supabase
2. **src/services/databaseService.js** ← Already updated
   - `addHistoryLog()` function now handles userId parameter
   
3. **src/pages/Login.jsx** ← Already updated
   - All `addHistoryLog()` calls now pass `userId` explicitly
   - Session storage set before history logging

---

## Troubleshooting

### Still getting FK errors after running SQL?
1. Verify schema migration ran (check Supabase SQL history)
2. Make sure `history.user_id` is nullable (run verification query above)
3. Restart dev server with `npm run dev`
4. Clear browser cache (Ctrl+Shift+Delete)

### History not showing up in database?
1. Check browser console for error messages
2. Verify Supabase credentials are correct
3. Check network tab (F12) to see API requests

### Some old history records using NULL?
This is fine - they were logged before the fix. They won't prevent new logs.

---

## Questions?

Check the browser console (F12) during signup/login for detailed debug logs:
```
[DB] 📝 Adding history log...
[DB] ✅ addHistoryLog() to Supabase
```

These show exactly what data is being sent and whether it succeeded.
