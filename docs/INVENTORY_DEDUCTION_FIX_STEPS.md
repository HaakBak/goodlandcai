# Inventory Deduction System - Complete Fix Guide

**Date**: April 4, 2026  
**Issue**: Recipe deductions not working in POS  
**Error**: "Inventory item not found for deduction: [UUID]"  
**Status**: FIXABLE - Multiple causes identified

---

## Summary of Root Causes

### ✅ Identified Problems

1. **🔴 CRITICAL**: Recipes RLS Policy blocks Employees from reading recipes
   - Only Managers & Admins can access recipes
   - Employees get empty recipe list (silently fails)
   - POS has no ingredients to deduct

2. **🟠 HIGH**: Recipe ingredients may have wrong ID field  
   - Code looks for `inventoryId` or fallback to `id`
   - If recipes saved with menu item ID instead of inventory ID
   - System tries to find menu item ID in inventory table → Not found

3. **🟡 MEDIUM**: No audit logging of deductions  
   - Deductions happen (or fail) silently
   - No database record of what was deducted
   - Impossible to debug issues

---

## Complete Fix (4 Steps - 30 minutes)

### Step 1: Fix RLS Policy (5 min) ⚡ CRITICAL

**Location**: Supabase Dashboard

**Action**:
1. Login to Supabase → Your Project
2. Click "SQL Editor" → "New Query"
3. **Copy and paste this**:

```sql
-- Drop the old policy that blocks employees
DROP POLICY IF EXISTS "Managers and admins read recipes" ON recipes;

-- Create new policy allowing all authenticated users
CREATE POLICY "Authenticated users read recipes" ON recipes
  FOR SELECT USING (auth.uid() IS NOT NULL);
```

4. Click **RUN**
5. Wait for: "Query executed successfully" ✅

**What this does**:
- Allows Employees to read recipes ✅
- Managers & Admins still have access ✅
- Recipes will load in Employee POS ✅

---

### Step 2: Verify Data Structure (10 min)

**Check if recipe ingredients have CORRECT IDs**

#### In Supabase:

1. Click "Table Editor"
2. Select "recipes" table
3. Click first recipe row
4. Expand "ingredients" field
5. Look for structure:

**✅ CORRECT**:
```json
{
  "inventoryId": "8becf5aa-correct-uuid",
  "name": "Sugar",
  "quantity": 10
}
```

**❌ WRONG**:
```json
{
  "id": "6bad9ee6-wrong-uuid",
  "name": "Sugar",
  "quantity": 10
}
```

---

### Step 3A: If Ingredients Have CORRECT IDs (Skip to Step 4)

Your recipes are fine! Proceed to testing.

---

### Step 3B: If Ingredients Have WRONG IDs (Delete & Recreate)

The recipes need to be recreated with correct inventory IDs.

**Option B1 - Delete Old Recipes**:

1. **In Supabase SQL Editor**:
```sql
-- Delete recipes with wrong structure
DELETE FROM recipes 
WHERE ingredients::text NOT LIKE '%"inventoryId"%';
```

2. **In Application**:
   - Login as **Manager**
   - Go to **Inventory > Recipes**
   - **Delete** any recipes with ❌
   - **Create new recipes** with correct ingredients:
     - Select Menu Item
     - Click "Add Ingredients"
     - Choose inventory items (NOT menu items!)
     - Set quantities
     - Click "Save Recipe"

---

### Step 4: Test Everything (10 min)

#### Test 4A: Employee Login & POS

```
1. Test as Employee:
   ├─ Login with Employee account
   ├─ Click POS
   ├─ Try to add menu item WITH recipe
   └─ Check console: Should NOT see errors about recipes

2. Check Console (F12 → Console tab):
   ✅ Should see: "[POS] 🔍 Calculating recipe usage"
   ✅ Should see: "[POS] ✅ Deducting X from [item name]"
   ❌ Should NOT see: "Inventory item not found"
```

#### Test 4B: Inventory Before & After

```
1. Before Transaction:
   └─ Note stock level of item
   └─ Example: Sugar = 100 packs

2. Complete Transaction:
   ├─ Login as Employee
   ├─ Add menu item with recipe x1 (uses 10 sugar)
   ├─ Complete transaction

3. After Transaction:
   └─ Check inventory: Sugar = 90 packs ✅
   └─ Check history: Should show deduction entry

4. Check Supabase (usage_logs):
   └─ Should see RECIPE_DEDUCTION entry
   └─ Shows: item name, qty deducted, old/new stock
```

#### Test 4C: Multiple Deductions

```
1. Add same recipe TWICE (qty: 2)
2. Complete transaction
3. Check inventory deduction = 20 (not 10!)
4. Verify in database
```

---

## What Changed in Code

### Added to POS.jsx

1. **Enhanced Logging** in `calculateRecipeUsage()`:
   - Shows which recipes are loaded
   - Shows which ingredients are found
   - Warns about missing recipes/ingredients

2. **Audit Trail** in `deductInventoryFromCart()`:
   - Creates usage_logs entry for each deduction
   - Records: item name, qty, old/new stock
   - Enables troubleshooting

3. **Better Error Messages**:
   - Shows why deduction failed
   - Lists possible causes
   - Helps debugging

### Build Status
✅ Verified 7.76 seconds (no errors)

---

## Verification Checklist

### ✅ After Step 1 (RLS Fix)

- [ ] Ran SQL in Supabase
- [ ] Got "Query executed successfully"
- [ ] Recipes table is accessible in Table Editor

### ✅ After Step 2-3 (Data Check)

- [ ] Verified recipe ingredients structure
- [ ] All ingredients have `inventoryId` field
- [ ] No recipes with wrong `id` field

### ✅ After Step 4 (Testing)

- [ ] Employee can login to POS ✅
- [ ] Employee can add recipe items ✅
- [ ] Inventory stock is deducted ✅
- [ ] Console shows deduction logs ✅
- [ ] usage_logs table shows entries ✅

---

## Troubleshooting

### Problem: "Inventory item not found" Still Appears

**Cause**: Recipe ingredients still have wrong ID

**Fix**:
1. Verify Step 2 (data structure check)
2. If wrong, follow Step 3B (delete & recreate)
3. Re-test

### Problem: Employee Can't Login

**Cause**: Not related to this issue

**Fix**:
1. Check username/password
2. Check user role is "Employee"
3. Check user_profiles table has employee

### Problem: No usage_logs Entries

**Cause**: Deduction succeeded but logging failed

**Fix**: This is non-critical but indicates:
- Database insert operation may have issues
- Check usage_logs table exists
- Check RLS policy allows inserts

### Problem: Recipe Loads but Shows "No Ingredients"

**Cause**: Recipe was never saved OR ingredients are empty

**Fix**:
1. Delete recipe in Inventory Manager
2. Create new recipe
3. Add ingredients from inventory items
4. Save and test

---

## Expected Console Output (Success)

```
[POS] 🔍 Calculating recipe usage. Recipes available: 2
[POS] 📋 Recipe for Iced Tea:
[POS]   - Sugar: 8becf5aa-uuid (qty: 15)
[POS]   - Tea Powder: 4f8d2eee-uuid (qty: 10)
[POS] Recipe usage map: {
  "8becf5aa-uuid": 15,
  "4f8d2eee-uuid": 10
}
[POS] Available inventory IDs: [list of many UUIDs]
[POS] ✅ Deducting 15 from Sugar (100 → 85)
[POS] ✅ Deducting 10 from Tea Powder (50 → 40)
[POS] 📦 Inventory deduction completed
```

---

## Files Modified

1. **[scripts/supabase-schema.sql](scripts/supabase-schema.sql)** - RLS Policy (you'll modify in Supabase)
2. **[src/pages/employee/POS.jsx](src/pages/employee/POS.jsx)** - Enhanced logging (already deployed)
3. **Recipe data** - May need cleanup if wrong IDs

---

## Timeline

| Step | Action | Time | Blocker |
|------|--------|------|---------|
| 1 | Fix RLS Policy | 5 min | 🔴 Critical |
| 2 | Check data structure | 5 min | ⏳ Depends on Step 1 |
| 3 | Delete/recreate recipes | 10-20 min | 🟠 If wrong IDs |
| 4 | Test everything | 10 min | ⏳ Final validation |

**Total**: 30-40 minutes

---

## Next Steps (If Tests Pass)

Once all tests pass:
1. ✅ Inventory deductions working
2. ✅ Audit trail recording
3. ✅ Ready for production OR Phase 4

---

## Important Notes

### Why This Happened

The recipes table has an RLS policy that was intended to restrict access to Managers only. However, the POS system is used by Employees, so they need access to recipes.

### Why Employees Need Recipe Access

- Employees use POS to process orders
- Orders reference menu items
- Menu items have recipes
- Recipes define which inventory items to deduct
- Therefore: Employees must be able to read recipes

### Why Audit Logging Matters

- Tracks every inventory change
- Enables accountability
- Helps debug issues
- Required for compliance/audits
- Usage_logs table shows: who changed what, when

---

## Success Criteria

✅ **System is fixed when**:
1. Employee can login and use POS
2. Recipe items deduct from inventory
3. Stock levels decrease after transactions
4. usage_logs table records deductions
5. Multiple deductions work correctly (qty x2 = 2x deduction)

---

**Need help?** Check:
- [INVENTORY_DEDUCTION_ANALYSIS.md](INVENTORY_DEDUCTION_ANALYSIS.md) - Detailed technical analysis
- [FIX_RECIPES_RLS.md](FIX_RECIPES_RLS.md) - Just the SQL fix
- Console output in browser (F12) - Real-time logs

