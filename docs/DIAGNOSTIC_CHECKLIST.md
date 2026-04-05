# Diagnostic Checklist - Inventory Deduction Issues

**Run these checks to identify exactly what's wrong in YOUR system**

---

## Check #1: Does Employee Have Recipe Access? (5 min)

### In Browser Console (F12)

1. **Login as an Employee**
2. **Open DevTools**: Press F12
3. **Go to Console tab**
4. **Paste this**:

```javascript
// Check if recipes accessible
const recipes = await getRecipes();
console.log('Recipes loaded:', Object.keys(recipes).length > 0);
console.log('Sample recipe:', recipes[Object.keys(recipes)[0]]);
console.log('First ingredient:', recipes[Object.keys(recipes)[0]]?.ingredients?.[0]);
```

### What to Look For

**✅ GOOD** (recipes are accessible):
```
Recipes loaded: true
Sample recipe: { id: '...', dish_id: '...', ingredients: [...] }
First ingredient: { inventoryId: '8becf5aa-...', name: 'Sugar', quantity: 10 }
```

**❌ BAD** (recipes blocked by RLS):
```
Recipes loaded: false
Sample recipe: undefined
First ingredient: undefined
```

**What it means**:
- ✅ GOOD = RLS policy fixed (or doesn't need fixing)
- ❌ BAD = RLS policy blocking (CRITICAL - need Step 1 fix)

---

## Check #2: Are Ingredient IDs Correct? (5 min)

### In Browser Console (Continue from Check #1)

```javascript
// Check ingredient structure
const recipes = await getRecipes();
const firstRecipe = recipes[Object.keys(recipes)[0]];
const ingredient = firstRecipe?.ingredients?.[0];

console.log('Checking ingredient structure:');
console.log('Has inventoryId:', !!ingredient?.inventoryId);
console.log('Has id:', !!ingredient?.id);
console.log('InventoryId value:', ingredient?.inventoryId);
console.log('Id value:', ingredient?.id);
```

### What to Look For

**✅ GOOD** (correct inventory ID):
```
Checking ingredient structure:
Has inventoryId: true
Has id: false
InventoryId value: 8becf5aa-1234-5678-abcd-ef0123456789
Id value: undefined
```

**⚠️ CAUTION** (has both fields):
```
Has inventoryId: true
Has id: true
InventoryId value: 8becf5aa-1234-5678-abcd-ef0123456789
Id value: other-uuid-here
```
✅ OK if inventoryId is used (code prioritizes it)

**❌ BAD** (only has id field):
```
Has inventoryId: false
Has id: true
InventoryId value: undefined
Id value: 6bad9ee6-ff2d-46c3-a80a-f5c2dc08b3e5
```
❌ This is the problem! (need Step 3 fix - recreate recipes)

---

## Check #3: Does Inventory Item Exist? (5 min)

### In Browser Console

```javascript
// Check if ingredient ID matches any inventory item
const inventory = await getInventory();
const ingredient = {inventoryId: 'UUID-FROM-ABOVE'};  // Use ID from Check #2

const item = inventory.find(i => i.id === ingredient.inventoryId);
console.log('Inventory item found:', !!item);
console.log('Item name:', item?.name);
console.log('Item ID:', item?.id);
console.log('Current stock:', item?.stock ?? item?.inStock);
```

**Replace `UUID-FROM-ABOVE` with the actual inventoryId from Check #2**

### What to Look For

**✅ GOOD**:
```
Inventory item found: true
Item name: Sugar
Item ID: 8becf5aa-1234-5678-abcd-ef0123456789
Current stock: 100
```

**❌ BAD**:
```
Inventory item found: false
Item name: undefined
Item ID: undefined
Current stock: undefined
```

**Why**:
- ✅ GOOD = Inventory matches recipes
- ❌ BAD = UUID from recipe doesn't exist in inventory (data mismatch)

---

## Check #4: Does Deduction Work? (10 min)

### Step by step

1. **Note inventory before**:
   - Go to Inventory Manager
   - Find item used in recipe
   - Note current stock (e.g., Sugar = 100)

2. **Complete a transaction**:
   - Login as Employee
   - Go to POS
   - Add ONE menu item with recipe
   - Complete transaction (pay with cash)

3. **Check console during transaction**:
   - You should see:
   ```
   [POS] 🔍 Calculating recipe usage
   [POS] Recipe usage map: {...}
   [POS] ✅ Deducting X from Sugar
   [POS] 📦 Inventory deduction completed
   ```

4. **Check inventory after**:
   - Go back to Inventory Manager
   - Check stock level
   - Should be: 100 - (recipe_qty) = lower number

### What to Look For

**✅ GOOD**:
- Console shows "Deducting X from Sugar"
- Stock level decreased
- No errors in console

**❌ BAD**:
- Console shows "Inventory item not found"
- Stock level unchanged
- Error message appears

---

## Check #5: Is Audit Trail Recording? (5 min)

### In Supabase

1. **Go to Supabase Dashboard**
2. **Click Table Editor**
3. **Select "usage_logs" table**
4. **Look for recent entries**

### What to Look For

**✅ GOOD** (recent entries):
```
id: ...
user_id: ... (employee's ID)
action: RECIPE_DEDUCTION
details: {
  inventory_item_name: "Sugar",
  quantity_deducted: 10,
  old_stock: 100,
  new_stock: 90
}
created_at: 2026-04-04 14:30:00
```

**❌ BAD** (no entries or empty):
- No RECIPE_DEDUCTION entries
- Suggests logging isn't working or recipes never deducted

---

## Diagnostic Summary Table

| Check | Result | Meaning | Fix Needed |
|-------|--------|---------|-----------|
| #1: Recipe access | ✅ Found | Recipes accessible | NONE |
| #1: Recipe access | ❌ Not found | RLS blocking | Step 1: Fix RLS |
| #2: Ingredient IDs | ✅ inventoryId | Correct structure | NONE |
| #2: Ingredient IDs | ❌ Only id | Wrong structure | Step 3: Recreate |
| #3: Item exists | ✅ Found | Inventory linked | NONE |
| #3: Item exists | ❌ Not found | Data mismatch | Step 3: Recreate |
| #4: Deduction works | ✅ Works | Stock deducted | NONE |
| #4: Deduction works | ❌ Fails | Check 1-3 first | See above |
| #5: Audit trail | ✅ Entries | Logging working | NONE |
| #5: Audit trail | ❌ No entries | Check logging code | Code already fixed |

---

## How to Interpret Results

### Result Pattern A: Only Check #1 Fails

```
Check #1: ❌ Recipes blocked
Check #2-5: N/A (can't proceed)
```

**Problem**: RLS policy blocks recipes  
**Solution**: Fix RLS ([FIX_RECIPES_RLS.md](FIX_RECIPES_RLS.md))  
**Time**: 5 minutes

---

### Result Pattern B: Checks #2 & #3 Fail

```
Check #1: ✅ Recipes accessible
Check #2: ❌ Only 'id' field (no inventoryId)
Check #3: ❌ ID not in inventory
Check #4: ❌ Deduction fails
```

**Problem**: Recipes saved with wrong ingredient IDs  
**Solution**: Delete & recreate recipes  
**Time**: 10-20 minutes

---

### Result Pattern C: Check #4 Fails but #1-3 OK

```
Check #1: ✅ Recipes accessible
Check #2: ✅ inventoryId field correct
Check #3: ✅ Inventory item exists
Check #4: ❌ Deduction fails
```

**Problem**: Bug in deduction logic (unlikely, code recently fixed)  
**Solution**: Check console for specific error, contact support  
**Time**: Debugging

---

### Result Pattern D: All Except #5 OK

```
Check #1-4: ✅ All working
Check #5: ❌ No usage_logs entries
```

**Problem**: Audit logging failed (non-critical)  
**Solution**: Deductions work fine, logging is secondary issue  
**Note**: Code fix deployed, monitoring ongoing

---

### Result Pattern E: All Checks Pass

```
Check #1-5: ✅ All good
```

**Problem**: No problem! ✅  
**System Status**: Fully operational  
**Action**: Test all use cases, deploy to production  

---

## Next Steps Based on Your Results

### If Pattern A (RLS blocked):
👉 Go to [FIX_RECIPES_RLS.md](FIX_RECIPES_RLS.md)

### If Pattern B (Wrong IDs):
👉 Go to [INVENTORY_DEDUCTION_FIX_STEPS.md](INVENTORY_DEDUCTION_FIX_STEPS.md) - Step 3

### If Pattern C (Logic error):
👉 Check [INVENTORY_DEDUCTION_ANALYSIS.md](INVENTORY_DEDUCTION_ANALYSIS.md) - Troubleshooting

### If Pattern D (Logging issue):
👉 Non-critical, deductions are working

### If Pattern E (All good):
👉 System ready - test thoroughly then deploy

---

## Quick Reference: Copy-Paste Diagnostic Commands

### All checks in one block:

```javascript
// Check 1: Recipes accessible?
const recipes = await getRecipes();
console.log('1️⃣ Recipes:', Object.keys(recipes).length > 0 ? '✅' : '❌');

// Check 2: Correct ingredient IDs?
const ing = recipes[Object.keys(recipes)[0]]?.ingredients?.[0];
console.log('2️⃣ Has inventoryId:', !!ing?.inventoryId ? '✅' : '❌', '(value:', ing?.inventoryId, ')');

// Check 3: Inventory item exists?
const inventory = await getInventory();
const found = inventory.find(i => i.id === ing?.inventoryId);
console.log('3️⃣ Item exists:', !!found ? '✅' : '❌', '(name:', found?.name, ')');

// Check 4: Can perform deduction?
console.log('4️⃣ Perform test transaction and check console for deduction logs');

// Check 5: Audit trail?
console.log('5️⃣ Check Supabase usage_logs table for RECIPE_DEDUCTION entries');
```

---

## Questions to Ask Yourself

1. **Can Employee login to POS?** → Try Check #1 first
2. **Does stock decrease after transaction?** → Need Checks #1-4
3. **Are changes recorded?** → Check #5
4. **Don't know where to start?** → Do all 5 checks in order

---

## Save This Output

When you complete these checks:
- 📋 Take screenshots of results
- 📝 Note any error messages
- 📊 Compare to patterns above
- 🔗 Reference the appropriate fix guide

---

**Ready?** Start with Check #1 above! ⬆️

