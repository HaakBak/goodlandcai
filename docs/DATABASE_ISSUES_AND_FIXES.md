# Database Issues & Fixes - Testing Findings

**Date**: April 4, 2026  
**Status**: 3 Issues Identified + Fixes

---

## Issue #1: Missing `usage_logs` Table

### Error
```
[DB] ❌ getUsageLogs() failed: 
{code: 'PGRST205', message: "Could not find the table 'public.usage_logs' in the schema cache"}
```

### Root Cause
The `usage_logs` table is defined in [scripts/supabase-schema.sql](scripts/supabase-schema.sql) but hasn't been created in your Supabase instance yet.

### Solution
Run this SQL in your Supabase SQL Editor:

```sql
-- USAGE LOGS TABLE
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX idx_usage_logs_action ON usage_logs(action);

-- Enable RLS
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Managers & Admins can read usage logs
CREATE POLICY "Managers and admins read usage logs" ON usage_logs
  FOR SELECT USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

-- RLS Policy: Anyone can log usage
CREATE POLICY "Anyone can log usage" ON usage_logs
  FOR INSERT WITH CHECK (true);
```

### Steps
1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy & paste the SQL above
4. Click "Run"
5. Test: Go back to Inventory page, it should load usage logs now

---

## Issue #2: addHistoryLog() RLS Violation on Logout

### Error
```
[DB] ❌ addHistoryLog() failed: 
{code: '42501', message: 'new row violates row-level security policy for table "history"'}
```

### Root Cause
When logging out, the code:
1. Signs out from **Supabase** first
2. **Then** tries to insert history log
3. But Supabase auth is already cleared → RLS policy blocks insert (no authenticated user context)

### Solution

**File**: [src/components/Sidebar.jsx](src/components/Sidebar.jsx#L1-L70)

Change the logout flow order - **log BEFORE signing out of Supabase**:

```javascript
const handleLogout = async () => {
  const now = new Date();
  const actualUsername = sessionStorage.getItem('username') || 'Unknown';
  const actualUserId = sessionStorage.getItem('userId') || null;
  
  console.log('🚪 [User Logout Initiated]', { role, username: actualUsername });
  
  // STEP 1: LOG FIRST (while still authenticated)
  try {
    let logoutType = 'Logout';
    let description = '';
    let logRole = 'Unknown';
    
    if (role === 'ADMIN') {
      logoutType = 'Admin Logout';
      description = `Administrator ${actualUsername} logged out of the system`;
      logRole = 'Administrator';
    } else if (role === 'EMPLOYEE') {
      logoutType = 'Employee Logout';
      description = `Employee ${actualUsername} logged out of the system`;
      logRole = 'Employee';
    } else if (role === 'MANAGER') {
      logoutType = 'Manager Logout';
      description = `Manager ${actualUsername} logged out of the system`;
      logRole = 'Manager';
    }
    
    await addHistoryLog({
      userId: actualUserId,
      type: logoutType,
      description: description,
      user: actualUsername,
      role: logRole,
      timestamp: now.toISOString(),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0]
    });
    console.log('✅ [Logout recorded in history]', { type: logoutType, user: actualUsername });
  } catch (err) {
    console.warn('[Sidebar] Could not record logout in history:', err);
  }
  
  // STEP 2: THEN Sign out from Supabase
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('[Sidebar] Warning during Supabase logout:', error);
      } else {
        console.log('[Sidebar] ✅ Supabase session signed out');
      }
    }
  } catch (err) {
    console.warn('[Sidebar] Could not sign out from Supabase:', err);
  }
  
  // STEP 3: FINALLY Clear session
  clearUserSession();
  console.log('💾 [SessionStorage Cleared]');
  
  // Navigate to login
  navigate('/', { replace: true });
};
```

### What Changed
1. **BEFORE**: Supabase.auth.signOut() → addHistoryLog() → clearSession()
2. **AFTER**: addHistoryLog() → Supabase.auth.signOut() → clearSession()

This way, the history log is inserted WHILE the user is still authenticated.

---

## Issue #3: Recipe Deductions Not Saved to Usage Logs

### Problem
When inventory items are deducted (from recipe usage in Inventory > Used tab), no entry is created in `usage_logs`.

### Root Cause
The Inventory.jsx code doesn't have a function to create usage log entries when items are deducted.

### Current Status
- ✅ `addUsageLog()` function exists in databaseService.js
- ❌ Inventory.jsx doesn't call it when deducting items

### Solution

**File**: [src/pages/manager/Inventory.jsx](src/pages/manager/Inventory.jsx)

Add usage log entry when saving recipe edits. In `handleSaveEditItem()`, after the item is updated, add:

```javascript
// After: await updateInventoryItem(editingItem.id, updatedItemData);

// LOG THE CHANGE TO USAGE LOGS if stock was changed
if (oldStock !== newStock) {
  try {
    const stockChange = newStock - oldStock;
    await addUsageLog({
      user_id: sessionStorage.getItem('userId'),
      action: 'INVENTORY_ADJUSTMENT',
      details: {
        item_id: editingItem.id,
        item_name: editFormData.name,
        old_stock: oldStock,
        new_stock: newStock,
        change: stockChange,
        change_reason: 'Manual stock adjustment',
      }
    });
    console.log('✅ [Usage Log Created for Stock Change]', { 
      item: editFormData.name, 
      oldStock, 
      newStock 
    });
  } catch (err) {
    console.warn('[Inventory] Could not log usage:', err);
    // Continue even if usage log fails
  }
}
```

**Import**: At the top of Inventory.jsx, add:
```javascript
import { addUsageLog } from '../services/databaseService';
```

---

## Priority & Timeline

| Issue | Priority | Impact | Time to Fix |
|-------|----------|--------|------------|
| #1: Missing usage_logs table | 🔴 HIGH | Inventory fails completely | 5 minutes (SQL) |
| #2: Logout RLS error | 🔴 HIGH | Can't log user actions | 10 minutes (code) |
| #3: Recipe deductions not logged | 🟡 MEDIUM | Incomplete audit trail | 5 minutes (code) |

---

## Implementation Steps

### Step 1: Create usage_logs Table (5 min)
1. Open Supabase Dashboard
2. SQL Editor → New Query
3. Paste the SQL from Issue #1
4. Run query
5. Test: Reload Inventory page

### Step 2: Fix Logout Order (10 min)
1. Open [src/components/Sidebar.jsx](src/components/Sidebar.jsx)
2. Replace the `handleLogout` function with the fixed version (Issue #2)
3. Save file
4. Test: Login → Logout → Check history table in Supabase

### Step 3: Log Recipe Deductions (5 min)
1. Open [src/pages/manager/Inventory.jsx](src/pages/manager/Inventory.jsx)
2. Add import at top: `import { addUsageLog } from '../services/databaseService';`
3. In `handleSaveEditItem()` around line 523 (after updateInventoryItem), add the usage log entry code
4. Save file
5. Test: Edit inventory stock → Check usage_logs table

---

## Testing Validation

### After Fix #1 (usage_logs table):
```
Expected: Inventory > Used tab shows "Recent Usage History" (should be empty initially)
If error gone: ✅ SUCCESS - table exists and is queryable
```

### After Fix #2 (logout history):
```
Steps:
1. Login as any role
2. Logout
3. Check Supabase > Table Editor > history
4. Look for latest row with type "Admin Logout" / "Manager Logout" / "Employee Logout"
Expected: Entry found, no RLS error in console
If working: ✅ SUCCESS - history logged before Supabase signout
```

### After Fix #3 (recipe deductions):
```
Steps:
1. Inventory > Management > Edit Inventory Item
2. Change stock from 10 → 8 (reduce by 2)
3. Click Save
4. Check Supabase > Table Editor > usage_logs
5. Look for latest row with action "INVENTORY_ADJUSTMENT"
Expected: Entry found with details showing old_stock=10, new_stock=8, change=-2
If working: ✅ SUCCESS - deductions logged to usage_logs
```

---

## Verification Checklist

After applying all fixes:

- [ ] Inventory page loads without errors
- [ ] Inventory > Used tab shows "Recent Usage History" table
- [ ] Can edit inventory items and stock is updated
- [ ] When stock is changed, usage_logs entry created
- [ ] Logout doesn't show RLS error in console
- [ ] History table has logout entries after logout
- [ ] No errors in browser console when testing all flows

---

## Next Steps After Fixes

1. **Run these tests**
   - Employee: Login → POS → Logout
   - Manager: Login → Inventory → Edit item → Logout
   - Admin: Login → Admin view → Logout

2. **Check Supabase tables**
   - `history` table has all logout entries
   - `usage_logs` table has inventory adjustments
   - No rows with null user_id (should have actual UUID)

3. **Monitor console**
   - No PGRST205 errors (missing table)
   - No 42501 errors (RLS violation)
   - All logs show ✅ success indicators

---

## If Issues Persist

**For Issue #1** (usage_logs still not found):
- Check Supabase > Table Editor → Refresh
- Verify table has columns: id, user_id, action, details, created_at
- Check RLS policies are enabled: click on "Policies" tab

**For Issue #2** (logout still has RLS error):
- Verify this code runs BEFORE supabase.auth.signOut()
- Check browser DevTools Network tab → see if auth tokens are still sent
- Verify history table RLS policy allows INSERT with TRUE

**For Issue #3** (usage logs not created):
- Check if addUsageLog() is being called (add console.log to verify)
- Verify usage_logs table exists (Issue #1)
- Check if user_id from sessionStorage is a valid UUID
