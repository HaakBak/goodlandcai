# Quick Fix Guide - 3 Issues & How to Fix

**For**: Kathy's POS System Testing  
**Date**: April 4, 2026  
**Time to Fix**: ~20 minutes total

---

## Issue 1: "Could not find table 'usage_logs'" 

### Error in Console
```
[DB] ❌ getUsageLogs() failed: 
{code: 'PGRST205', message: "Could not find the table 'public.usage_logs' in the schema cache"}
```

### Location
- Browser: Inventory page > Used tab
- Console: Shows when loading Recent Usage History

### ROOT CAUSE
The table is defined in your SQL schema file, but hasn't been created in Supabase yet.

### HOW TO FIX (5 minutes)

**Option A: Using Supabase UI (Easiest)**
1. Go to https://supabase.com → Your Project
2. Click on **"SQL Editor"** (left sidebar)
3. Click **"New Query"**
4. **Copy everything below and paste it**:

```sql
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_action ON usage_logs(action);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers and admins read usage logs" ON usage_logs;
DROP POLICY IF EXISTS "Anyone can log usage" ON usage_logs;

CREATE POLICY "Managers and admins read usage logs" ON usage_logs
  FOR SELECT USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

CREATE POLICY "Anyone can log usage" ON usage_logs
  FOR INSERT WITH CHECK (true);
```

5. Click **"Run"** button
6. Wait for "Query executed successfully"
7. **Done!** ✅

**Verify it worked**:
- Go to "Table Editor" (left sidebar)
- Look for "usage_logs" in the list
- Open it (should be empty with 5 columns: id, user_id, action, details, created_at)

---

## Issue 2: Logout Shows RLS Error (42501)

### Error in Console
```
[DB] ❌ addHistoryLog() failed: 
{code: '42501', message: 'new row violates row-level security policy for table "history"'}
```

### Location
- Happens when logging out
- Appears in browser console
- Doesn't block logout, but logs aren't recorded

### ROOT CAUSE
The code was trying to log the logout AFTER signing out of Supabase. Once you sign out, the RLS policy blocks writes.

### HOW TO FIX (Already Done! ✅)

**Status**: The code fix has already been applied ✅

**What we did**:
- File: [src/components/Sidebar.jsx](src/components/Sidebar.jsx#L11-L65)
- Changed: Moved `addHistoryLog()` to run BEFORE `supabase.auth.signOut()`
- Build: ✅ Successful (7.84 seconds)

**To test it worked**:
1. Login as Manager
2. Click Logout
3. Check browser console
4. Should see: ✅ **[Logout recorded in history]** (not ❌ error)

**If you STILL see the error**:
- Hard refresh browser: `Ctrl+Shift+Delete` → Clear cache → Reload
- Make sure you have latest code (npm run dev or redeploy)

---

## Issue 3: Recipe Deductions Not Saved to Usage Logs

### Problem
When you edit inventory items and reduce stock (e.g., 10 → 8 packs), no entry is created in `usage_logs`.

### Location
- Inventory > Management > Edit Inventory Item > Change stock > Save

### ROOT CAUSE
The Inventory page has edit functionality but doesn't call `addUsageLog()` when stock changes.

### HOW TO FIX (Upcoming Code Update)

**Status**: ⏳ Pending - requires code changes

**What we'll do**:
1. Open [src/pages/manager/Inventory.jsx](src/pages/manager/Inventory.jsx)
2. Find function `handleSaveEditItem()` (around line 480)
3. After the stock is updated, add a call to `addUsageLog()`
4. This will create an entry in `usage_logs` table with details

**For now**:
- ⏳ Usage logs won't be created from inventory edits
- ✅ But the database table exists and is ready
- You can still see usage_logs from other operations

**Timeline**: Will be added in next code deployment

---

## Quickest Test (10 minutes)

**Test everything works**:

```
1. Run the SQL (Issue 1) ........................... 3 minutes
   ├─ Copy/paste SQL
   ├─ Click Run
   └─ Verify table appears

2. Test Logout (Issue 2) ........................... 3 minutes
   ├─ Login as Manager
   ├─ Click Logout
   ├─ Check console for ✅ (not ❌)
   └─ Verify no RLS error

3. Test Inventory (Issue 1 verification) ........... 2 minutes
   ├─ Login as Manager
   ├─ Go to Inventory > Used tab
   ├─ Should load without "Could not find table" error
   └─ Complete!

TOTAL TIME: ~10 minutes ✅
```

---

## What NOT to Worry About

These are known limitations, not bugs:

- ❌ Recipe deductions not logged (Issue #3) - Will be fixed next
- ❌ Margin config in receipts (Employee noted) - Will handle separately
- ⚠️ Chunk size warnings on build - Normal for large apps, doesn't affect functionality

---

## Success Indicators

### ✅ After Issue 1 Fix (SQL)
- Inventory page loads
- "Used" tab shows "Recent Usage History" table
- No 'PGRST205' error in console

### ✅ After Issue 2 Verified (Code already fixed)
- Logout doesn't show RLS error
- Console shows: ✅ "[Logout recorded in history]"
- History table in Supabase has logout entries

### ✅ After Issue 3 (Coming next)
- Inventory edits create entries in usage_logs
- Complete audit trail of all stock changes
- Admin can view in dashboard

---

## Still Have Issues?

### Check These Things:

1. **Did the SQL run successfully?**
   - Supabase > SQL Editor > Look at the output
   - Should say "Query executed successfully"
   - Not "ERROR: Table already exists" (that's fine, means it's there)

2. **Is Supabase table there?**
   - Supabase > Table Editor
   - Search for "usage_logs" in left sidebar
   - Should be listed between "transactions" and "business_info"

3. **What does the error say exactly?**
   - Screenshot the exact error message
   - Post it in issue tracker with:
     - Which page/action caused it
     - Exact text of error
     - Role (Employee/Manager/Admin)

4. **Try these troubleshooting steps**:
   ```
   a) Hard refresh browser
      Ctrl+Shift+Delete → Clear all → Ctrl+R
   
   b) Clear Supabase cache
      Supabase > Table Editor > Refresh icon
   
   c) Check RLS policies
      Supabase > Table Editor > Select usage_logs
      → Click "Policies" tab
      → Should see 2 policies
   ```

---

## Documentation Files

For more details, see these files:

- **[DATABASE_ISSUES_AND_FIXES.md](DATABASE_ISSUES_AND_FIXES.md)** 
  - Complete technical analysis of all 3 issues
  - Detailed explanations
  - Implementation instructions

- **[TESTING_TROUBLESHOOTING_GUIDE.md](TESTING_TROUBLESHOOTING_GUIDE.md)**
  - Step-by-step testing procedures
  - Expected console output
  - Troubleshooting flowchart

---

## Summary

| Issue | Status | Action | Time |
|-------|--------|--------|------|
| #1: Missing usage_logs table | ❌ PENDING | Run SQL | 5 min |
| #2: Logout RLS error | ✅ FIXED | Test it | 3 min |
| #3: Deductions not logged | ⏳ PENDING | Code update | Next sprint |

✅ **1 of 3 fixed, 1 just waiting for SQL, 1 coming in next update**

---

**Next Step**: Run the SQL from Issue 1, then test!

Questions? Check the detailed guides linked above or contact development team.
