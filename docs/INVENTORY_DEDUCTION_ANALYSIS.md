# Inventory Deduction System - Root Cause Analysis

**Issue**: Recipe deductions not working in POS  
**Error**: `Inventory item not found for deduction: 6bad9ee6-ff2d-46c3-a80a-f5c2dc08b3e5`  
**Status**: CRITICAL - Blocking POS transactions

---

## Problem Summary

When a transaction is completed in POS with a recipe-based item:
1. ❌ Inventory stock is NOT deducted
2. ❌ Database shows NO changes  
3. ❌ Console shows: "Inventory item not found for deduction: [UUID]"

This means the UUID in the error is not a valid inventory item ID.

---

## Root Cause Analysis

### Issue #1: RLS Policy Blocking Employee Recipe Reads ⚠️

**Location**: [scripts/supabase-schema.sql](scripts/supabase-schema.sql#L330-L336)

```sql
-- RLS Policy: Managers & Admins can read recipes
CREATE POLICY "Managers and admins read recipes" ON recipes
  FOR SELECT USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );
```

**Problem**: 
- Employees **cannot read** recipes due to RLS restriction
- When Employee logs in and calls `getRecipes()` in POS:
  - Query returns **NO DATA** (empty object) due to RLS blocking
  - `calculateRecipeUsage()` gets no recipes
  - No inventory deduction happens (silently fails)

**Impact**:  CRITICAL  
- Employee role: Cannot access recipes at all
- POS System: No recipe ingredients to deduct
- Workaround: Managers can use POS, employees cannot

---

### Issue #2: Ingredient ID Field Mismatch ⚠️

**Location**: [src/pages/employee/POS.jsx](src/pages/employee/POS.jsx#L19-L36)

**Code Block**:
```javascript
const calculateRecipeUsage = (cart, recipes) => {
  const usage = {};
  cart.forEach((cartItem) => {
    const dishId = cartItem.menuItem?.id;
    const recipe = recipes?.[dishId] || recipes?.[String(dishId)];
    if (!recipe?.ingredients || !Array.isArray(recipe.ingredients)) {
      return;
    }
    recipe.ingredients.forEach((ingredient) => {
      const inventoryId = ingredient.inventoryId || ingredient.id;  // <-- FALLBACK
      // ...
    });
  });
  return usage;
};
```

**Problem**:
- Code uses fallback: `ingredient.id` if `inventoryId` missing
- If recipes were saved with WRONG field (e.g., menu item ID instead of inventory ID):
  - `inventoryId` would be a menu item UUID (not in inventory table)
  - Error: "Inventory item not found"
  - The UUID `6bad9ee6-ff2d-46c3-a80a-f5c2dc08b3e5` is likely a menu item ID

**Two Scenarios**:

**Scenario A**: Recipes saved with `ingredient.id` (menu item)
```javascript
// WRONG - saved menu item ID:
{
  id: "6bad9ee6-ff2d-46c3-a80a-f5c2dc08b3e5",  // <-- Menu item ID!
  name: "Sugar",
  quantity: 10
}

// Expected - inventory item ID:
{
  inventoryId: "8becf5aa-1234-5678-abcd-ef0123456789",  // <-- Inventory ID
  name: "Sugar",  
  quantity: 10
}
```

**Scenario B**: Recipe created before code maintained `inventoryId` field
- Old recipes may only have `id` field
- Code falls back to using `id` (which is wrong type of ID)

---

### Issue #3: Missing Database Audit Trail 🔍

**When deduction SUCCEEDS** (for Managers):
- Stock IS updated in inventory table
- But usage_logs table has NO entry
- No audit trail of what was deducted and when

**When deduction FAILS** (for Employees):
- Stock NOT updated
- No error logged
- No usage_logs entry
- Silent failure = impossible to debug

---

## Diagnostic Checklist

### Step 1: Check RLS Policy on Recipes

```sql
-- Run in Supabase SQL Editor
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  rol, 
  qual, 
  with_check 
FROM pg_policies 
WHERE tablename = 'recipes';
```

**Expected Result**: Should show policy for Managers & Admins only

---

### Step 2: Check Actual Recipe Data Structure

```sql
-- Run in Supabase SQL Editor
SELECT id, dish_id, ingredients FROM recipes LIMIT 1;
```

**Then in browser DevTools**:
```javascript
const [recipes] = await Promise.all([getRecipes()]);
console.log('Recipes structure:', recipes);
// Look at: recipes[dishId]?.ingredients
// Check if ingredients have: inventoryId OR id
```

**Example Output**:
```javascript
{
  "b1234567-89ab-cdef-0123-456789abcdef": {
    "id": "recipe-uuid",
    "dish_id": "b1234567-89ab-cdef-0123-456789abcdef",
    "ingredients": [
      {
        "inventoryId": "8becf5aa-correct-inventory-uuid",  // ✅ CORRECT
        "name": "Sugar",
        "quantity": 10
      }
      // OR
      {
        "id": "6bad9ee6-wrong-menu-item-uuid",  // ❌ WRONG!
        "name": "Sugar",
        "quantity": 10
      }
    ]
  }
}
```

---

### Step 3: Check Inventory Item IDs

```sql
-- Run in Supabase SQL Editor
SELECT id, name FROM inventory LIMIT 5;
```

**Then compare**:
- Is `6bad9ee6-ff2d-46c3-a80a-f5c2dc08b3e5` in this list?
- If NO → Confirms it's a wrong ID (probably menu item)
- If YES → RLS policy is blocking the read

---

## Solutions

### Solution A: Fix RLS Policy for Employees (RECOMMENDED)

**Why**: Employees need to read recipes to use POS

**Change**: Modify recipes RLS policy to allow Employees

```sql
-- CURRENT (BROKEN):
CREATE POLICY "Managers and admins read recipes" ON recipes
  FOR SELECT USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

-- FIXED (ALLOW EMPLOYEES):
CREATE POLICY "All authenticated users read recipes" ON recipes
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

-- DROP OLD POLICY FIRST:
DROP POLICY "Managers and admins read recipes" ON recipes;
```

**Steps**:
1. Supabase Dashboard → SQL Editor
2. Copy the DROP and CREATE above
3. Run query
4. Verify: Test Employee login → should be able to access POS recipes

---

### Solution B: Validate & Fix Recipe Ingredient Structure

**If recipes have wrong IDs in ingredients**:

#### Option B1: Delete & Recreate Recipes

```sql
-- DELETE OLD RECIPES (in Supabase SQL Editor)
DELETE FROM recipes WHERE ingredients::text LIKE '%"id"%';

-- THEN:
-- 1. Login as Manager
-- 2. Go to Inventory Manager
-- 3. Recreate recipes (will use correct inventoryId now)
```

#### Option B2: Batch Update Recipes (Advanced)

```sql
-- UPDATE ingredients to use correct ID structure
-- Only if you know exact mapping between menu_id → inventory_id
UPDATE recipes 
SET ingredients = jsonb_set(
  ingredients,
  '{0,inventoryId}',
  ingredients->'0'->>'id'
)
WHERE ingredients::text NOT LIKE '%inventoryId%';
```

---

### Solution C: Add Audit Logging to Deductions

**Location**: [src/pages/employee/POS.jsx](src/pages/employee/POS.jsx#L40-L58)

**Add usage logging when deduction happens**:

```javascript
const deductInventoryFromCart = async (cart) => {
  if (!cart || cart.length === 0) return;

  const [recipes, inventory] = await Promise.all([getRecipes(), getInventory()]);
  const usageMap = calculateRecipeUsage(cart, recipes);

  const updates = Object.entries(usageMap).map(([inventoryId, quantityUsed]) => {
    const inventoryItem = inventory.find((item) => item.id === inventoryId);
    if (!inventoryItem) {
      console.warn('[POS] Inventory item not found for deduction:', inventoryId);
      return Promise.resolve();
    }

    const currentStock = parseNumericValue(inventoryItem.stock ?? inventoryItem.stock_level ?? inventoryItem.quantity ?? inventoryItem.inStock);
    const newStock = Math.max(0, currentStock - quantityUsed);
    
    // ADD LOGGING HERE:
    try {
      await addUsageLog({
        user_id: getCurrentUserInfo().userId,
        action: 'RECIPE_DEDUCTION',
        details: {
          inventory_item_id: inventoryId,
          inventory_item_name: inventoryItem.name,
          quantity_deducted: quantityUsed,
          old_stock: currentStock,
          new_stock: newStock
        }
      });
    } catch (logErr) {
      console.warn('[POS] Could not log deduction:', logErr);
    }
    
    return updateInventoryItem(inventoryId, { stock: newStock });
  });

  await Promise.all(updates);
};
```

---

## Recommended Fix Order

### Phase 1: Fix RLS (CRITICAL - 5 min)
1. Update recipes RLS policy to allow Employees
2. Verify Employee can login to POS

### Phase 2: Verify Data (10 min)  
1. Run diagnostic SQL queries above
2. Check recipe ingredient structure
3. Confirm inventory IDs match

### Phase 3: Fix Recipe Data (10-30 min)
1. If ingredients have wrong IDs: Delete & recreate recipes
2. OR: Run batch SQL update

### Phase 4: Add Logging (15 min)
1. Add usage logging to deductInventoryFromCart()
2. Deploy
3. Monitor usage_logs table for deduction entries

---

## Testing Procedures

### Test 1: RLS Policy Fix
```
1. Login as Employee
2. Go to POS
3. Try to add menu item with recipe
4. Check console for error
5. Expected: No RLS error, recipe loaded successfully
```

### Test 2: Inventory Deduction
```
1. Login as Manager (create recipe if needed)
2. Record current stock: SELECT stock FROM inventory WHERE name = 'Sugar'
3. Create transaction with recipe item x2
4. Complete transaction
5. Check stock: SELECT stock FROM inventory WHERE name = 'Sugar'
6. Expected: Stock reduced by (2 * recipe_qty)
```

### Test 3: Audit Trail
```
1. Complete POS transaction
2. Check usage_logs table:
   SELECT * FROM usage_logs 
   WHERE action = 'RECIPE_DEDUCTION' 
   ORDER BY created_at DESC LIMIT 5;
3. Expected: Entry shows inventory_item_name, quantity_deducted, timestamps
```

---

## Prevention & Best Practices

### Best Practice #1: Test All User Roles
- ✅ Test Employee flow
- ✅ Test Manager workflow  
- ✅ Test Admin operations

### Best Practice #2: Validate Recipe Structure
```javascript
// When saving recipe, validate:
if (!currentRecipe.every(r => r.inventoryId)) {
  alert('⚠️ All ingredients must have valid inventory IDs');
  return;
}
```

### Best Practice #3: Monitor Audit Trail
```javascript
// In dashboard, show deductions:
const recentDeductions = await Promise.all([
  supabase
    .from('usage_logs')
    .select('*')
    .eq('action', 'RECIPE_DEDUCTION')
    .order('created_at', { ascending: false })
    .limit(20)
]);
```

---

## Summary of Issues

| # | Issue | Severity | Cause | Status |
|---|-------|----------|-------|--------|
| A | RLS blocks Employee reads | 🔴 CRITICAL | Policy missing Employee role | ⏳ Needs fix |
| B | Wrong ingredient ID structure | 🟠 HIGH | Legacy recipe data | ⏳ Needs verification |
| C | No audit logging | 🟡 MEDIUM | Missing logging code | ⏳ Needs implementation |

---

## Files Requiring Changes

1. **[scripts/supabase-schema.sql](scripts/supabase-schema.sql)** - RLS Policy
2. **[src/pages/employee/POS.jsx](src/pages/employee/POS.jsx)** - Add logging
3. Recipe data in database - May need cleanup

---

**Next Steps**:
1. Run diagnostic SQL queries to confirm root cause (RLS or bad data)
2. Apply Phase 1 fix (RLS policy)  
3. Re-test POS deductions
4. Implement Phase 2-4 fixes if needed

