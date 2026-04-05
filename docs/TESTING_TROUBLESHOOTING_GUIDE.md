# Testing & Troubleshooting Guide - Database Issues Fixed

**Date**: April 4, 2026  
**Build Status**: ✅ 7.84 seconds (no errors)  
**Changes**: 1 critical code fix + 2 SQL fixes needed

---

## Summary of Issues & Fixes

### ✅ FIXED (Code)
**Issue #2: Logout RLS Violation**
- **File**: [src/components/Sidebar.jsx](src/components/Sidebar.jsx#L11-L65)
- **Change**: Reordered logout steps to log history BEFORE signing out
- **Status**: ✅ Build verified

### ⏳ REQUIRES SQL (Database)
**Issue #1: Missing usage_logs table**
- **Action**: Run SQL in Supabase to create table
- **Status**: Waiting for manual SQL execution

**Issue #3: Recipe deductions not logged**
- **Action**: Inventory code needs to call addUsageLog()
- **Status**: Will add in next code update

---

## IMMEDIATE ACTION REQUIRED

### Run This SQL in Supabase (5 minutes)

**Steps**:
1. Go to: https://supabase.com → Your Project → SQL Editor
2. Create new query
3. Copy & paste this entire block:

```sql
-- ============================================================================
-- CREATE USAGE_LOGS TABLE (if it doesn't exist)
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_action ON usage_logs(action);

-- Enable Row-Level Security
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Managers and admins read usage logs" ON usage_logs;
DROP POLICY IF EXISTS "Anyone can log usage" ON usage_logs;

-- RLS Policy: Managers & Admins can read usage logs
CREATE POLICY "Managers and admins read usage logs" ON usage_logs
  FOR SELECT USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

-- RLS Policy: Anyone can log usage (for system operations)
CREATE POLICY "Anyone can log usage" ON usage_logs
  FOR INSERT WITH CHECK (true);

COMMIT;
```

4. Click **"Run"** button (or Ctrl+Enter)
5. You should see: "Query executed successfully"

---

## Testing Checklist

### Test 1: Verify usage_logs Table Created
```
After running SQL:
1. In Supabase, go to Table Editor
2. Look for "usage_logs" table in left sidebar
3. Click it
4. You should see empty table with columns: id, user_id, action, details, created_at
✅ SUCCESS if table appears
```

### Test 2: Verify Logout History is Logged
```
Steps:
1. In your app, login as any role (Employee/Manager/Admin)
2. Click logout in sidebar
3. Check browser console - should show:
   ✅ [Logout recorded in history]
   NOT [❌ addHistoryLog() failed]
4. In Supabase > Table Editor > "history" table
5. Scroll to latest row - should be your logout with type "Admin Logout" / etc
✅ SUCCESS if logout logged without RLS error
```

### Test 3: Verify Inventory Page Loads
```
Steps:
1. Login as Manager
2. Go to Inventory page
3. Click "Inventory" tab > "Used" subtab
4. Should see "Recent Usage History" table (may be empty)
5. No error in console like "Could not find table 'usage_logs'"
✅ SUCCESS if usage history table displays
```

### Test 4: Verify All Roles Work
```
Test each role:
1. Employee login:
   - Login ✅
   - Use POS ✅
   - Logout (should log in history) ✅
   
2. Manager login:
   - Login ✅
   - Go to Inventory ✅
   - Logout (should log in history) ✅
   
3. Administrator login:
   - Login ✅
   - View admin page ✅
   - Logout (should log in history) ✅
✅ SUCCESS if all roles work without RLS errors
```

---

## Expected Console Output (After Fixes)

### Logout Console Logs
```
🚪 [User Logout Initiated] {role: "MANAGER", username: "john_manager", userId: "abc-123"}
✅ [Logout recorded in history] {type: "Manager Logout", user: "john_manager"}
[Sidebar] ✅ Supabase session signed out
💾 [SessionStorage Cleared - All userRole and username keys removed]
```

**NOT Expected** (sign of remaining issue):
```
❌ [DB] ❌ addHistoryLog() failed: {code: '42501', message: 'new row violates row-level security'}
```

### Inventory Console Logs
```
[DB] ✅ getUsageLogs() from Supabase
[DB] ✅ getInventory() from Supabase
[DB] ✅ getRecipes() from Supabase
```

**NOT Expected** (sign of missing table):
```
[DB] ❌ getUsageLogs() failed: {code: 'PGRST205', message: "Could not find table 'public.usage_logs'"}
```

---

## Troubleshooting

### Issue: Still Getting "Could not find table 'usage_logs'"

**Diagnosis**:
1. Open Supabase > Table Editor
2. Look in left sidebar - is "usage_logs" listed?
3. If NO → SQL didn't run properly
4. If YES → Might be cache issue

**Fix**:
```sql
-- Check if table exists
SELECT TO_REGCLASS('public.usage_logs');
-- If returns NULL, table doesn't exist
-- If returns 'public.usage_logs'::regclass, table exists

-- If it exists but still getting error, refresh:
REFRESH MATERIALIZED VIEW CONCURRENTLY usage_logs; 
-- (This might fail, but try it)

-- Try a simple select:
SELECT * FROM usage_logs LIMIT 1;
-- If this works, the table is there

-- Clear browser cache and refresh app:
Ctrl+Shift+Delete in browser → Clear cache → Reload
```

### Issue: Logout Still Shows RLS Error (42501)

**Diagnosis**:
1. Check browser console during logout
2. If you see `[DB] ❌ addHistoryLog() failed: {code: '42501'...}`
3. It means history log is still being inserted AFTER logout

**Fix**:
- Make sure you have the LATEST code from [src/components/Sidebar.jsx](src/components/Sidebar.jsx)
- The `addHistoryLog()` call MUST come BEFORE `supabase.auth.signOut()`
- Rebuild: `npm run build`
- Hard refresh browser: `Ctrl+Shift+Delete` then reload

### Issue: Inventory Edits Still Not Creating Usage Logs

**Status**: This requires additional code (coming next)

**Temporary Workaround**:
- Usage logs will still be created manually via other routes
- Inventory adjustments just won't appear in history yet

**Permanent Fix** (next update):
- We'll add `addUsageLog()` calls in Inventory.jsx `handleSaveEditItem()`

---

## Verification Steps (Complete Workflow)

**Test this complete flow**:

```
1. START
   ├─ Open app
   ├─ Login as MANAGER
   └─ Get logged in

2. USE INVENTORY
   ├─ Go to Inventory > Management > Add Item
   ├─ Add "Test Sugar" with stock=10
   ├─ Click Save
   ├─ Go to Inventory > Management > Edit Item
   ├─ Find "Test Sugar"
   ├─ Change stock from 10 → 8
   ├─ Click Save
   └─ Check console for success

3. CHECK LOGS
   ├─ Go to Supabase Dashboard
   ├─ Table Editor > "history"
   ├─ Look for "Inventory Change" entries
   └─ Verify timestamps match your edits

4. LOGOUT
   ├─ Click Sidebar > Logout
   ├─ Check console:
   │  ✓ Should see: [Logout recorded in history]
   │  ✗ Should NOT see: [❌ addHistoryLog() failed]
   └─ Go to Supabase > "history" table
      └─ Latest entry should be "Manager Logout"

5. LOGIN AGAIN
   ├─ Login successful ✓
   ├─ Go to Inventory > Used tab
   ├─ Should show "Recent Usage History" table
   └─ May be empty (depends on Issue #3 fix)

6. SUCCESS
   ✅ All console logs show ✅ (no ❌)
   ✅ History table has logout entries
   ✅ Inventory operations logged
```

---

## Next Steps (Coming Soon)

### Phase: Add Recipe Deduction Logging
- **Files**: [src/pages/manager/Inventory.jsx](src/pages/manager/Inventory.jsx)
- **Change**: Call `addUsageLog()` when inventory stock is changed
- **Benefit**: Complete audit trail for inventory adjustments

### Phase: Enhanced Monitoring
- Monitor usage_logs via admin dashboard (future feature)
- Real-time inventory tracking
- Audit reports

---

## Reference: What Was Changed

### Code Changes (1 file)
- [src/components/Sidebar.jsx](src/components/Sidebar.jsx)
  - Reordered `handleLogout()` steps
  - NOW: Log history BEFORE signout
  - BEFORE: Log history AFTER signout (failed due to RLS)

### SQL Changes Needed (1 script)
- Supabase SQL Editor
  - Create `usage_logs` table
  - Add RLS policies
  - Create indexes

### Database Status
```
BEFORE (Broken):
├─ usage_logs table: ❌ MISSING → Inventory fails to load
├─ Logout logging: ❌ RLS ERROR → 42501 permission denied
└─ Recipe deductions: ❌ NOT LOGGED → No audit trail

AFTER (Fixed):
├─ usage_logs table: ✅ EXISTS → Inventory loads
├─ Logout logging: ✅ WORKS → No RLS errors
└─ Recipe deductions: ⏳ COMING → Will audit
```

---

## Support

### If you get stuck:
1. Check [DATABASE_ISSUES_AND_FIXES.md](DATABASE_ISSUES_AND_FIXES.md) for detailed explanations
2. Verify SQL was executed in Supabase (check Table Editor)
3. Check browser console for exact error messages
4. Hard refresh: `Ctrl+Shift+Delete` → Clear all → `Ctrl+R`

### Supabase Docs:
- RLS Policies: https://supabase.com/docs/guides/auth/row-level-security
- Table Editor: https://supabase.com/docs/guides/database/tables
- SQL Editor: https://supabase.com/docs/guides/database/sql-editor

---

**Last Updated**: April 4, 2026  
**Status**: 1 code fix applied ✅ | 1 SQL fix needed ⏳ | 1 code enhancement coming 🔄
