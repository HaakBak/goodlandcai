# Recipe Duplication Error Analysis

**Issue**: System doesn't handle recipe duplication properly  
**Status**: 🔴 **VULNERABILITY FOUND** - Silent data loss possible  
**Severity**: HIGH - Can lose recipe data

---

## Problem Summary

### Current Behavior

When fetching recipes from the database:
```javascript
const recipes = {};
data.forEach(r => { recipes[r.dish_id] = r; });  // ⚠️ OVERWRITES!
```

**If multiple recipes exist for the same menu item**:
- Last one wins (overwrites previous ones)
- Other recipes are silently lost
- No error, no warning
- User doesn't know about it

### Example Scenario

```
Database has:
├─ Recipe 1 for "Iced Tea" (id: uuid-1)
├─ Recipe 2 for "Iced Tea" (id: uuid-2)  ← Duplicate!

getRecipes() returns:
{
  "iced-tea-dish-id": Recipe 2 only  ← Recipe 1 is lost!
}
```

---

## Root Causes

### 1. No UNIQUE Constraint on dish_id
**Location**: [scripts/supabase-schema.sql](scripts/supabase-schema.sql#L326-L340)

```sql
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id UUID REFERENCES menu(id) ON DELETE CASCADE,
  -- ❌ NO UNIQUE (dish_id) constraint!
  ingredients JSONB DEFAULT '[]',
  ...
);
```

**Problem**: Database allows multiple recipes per menu item

**Should be**:
```sql
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id UUID REFERENCES menu(id) ON DELETE CASCADE UNIQUE,  -- ✅ Enforce ONE recipe per dish
  ingredients JSONB DEFAULT '[]',
  ...
);
```

---

### 2. No Deduplication Logic in Code
**Location**: [src/services/databaseService.js](src/services/databaseService.js#L1106-1125)

Current code:
```javascript
export const getRecipes = async () => {
  // ... fetch all recipes
  const recipes = {};
  data.forEach(r => { 
    recipes[r.dish_id] = r;  // ⚠️ Overwrites if duplicates exist
  });
  return recipes;
};
```

**Problem**: Silently loses recipes if duplicates exist

**Better approach**:
```javascript
// Option 1: Detect and warn about duplicates
const recipes = {};
const duplicates = {};
data.forEach(r => { 
  if (recipes[r.dish_id]) {
    // Recipe already exists for this dish!
    duplicates[r.dish_id] = [recipes[r.dish_id], r];
  }
  recipes[r.dish_id] = r;
});

if (Object.keys(duplicates).length > 0) {
  console.warn('[DB] ⚠️ Duplicate recipes found for dishes:', Object.keys(duplicates));
  // Could notify admin to clean up
}
```

---

### 3. No Check When Saving
**Location**: [src/services/databaseService.js](src/services/databaseService.js#L1130-1157)

```javascript
export const saveRecipe = async (dishId, recipe) => {
  // ... no check if recipe already exists
  const recipeData = {
    dish_id: dishId,
    ingredients: recipe.ingredients ?? recipe,
    id: recipe.id || crypto.randomUUID(),  // Always creates new ID
  };
  
  // Upsert will create if not exists, update if matches on ID
  const { error } = await supabase.from('recipes').upsert(recipeData);
};
```

**Problem**: 
- If `recipe.id` is undefined, it generates new UUID
- Creates new recipe instead of updating existing one
- Can easily create duplicates

**What happens**:
```
Click "Save Recipe" twice:
1. First click: Creates recipe with uuid-1
2. Second click: Creates recipe with uuid-2 (same dish_id!)
Result: 2 recipes for same menu item
```

---

### 4. RLS Policy Violation
**Location**: [scripts/supabase-schema.sql](scripts/supabase-schema.sql#L344-L355)

```sql
-- Only Admins can modify recipes
CREATE POLICY "Admins modify recipes" ON recipes
  FOR INSERT WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role') = 'Administrator'
  );
```

**But in Inventory.jsx**, Managers are saving recipes:
```javascript
const { username, userRole } = getCurrentUserInfo();  // Manager's role
await saveRecipe(selectedDish.id, recipePayload);     // Tries to save
// RLS blocks this if user is Manager!
```

This creates a silent failure and could allow duplicates to accumulate offline.

---

## How Duplicates Can Occur

### Scenario 1: User Clicks Save Twice
```
1. Manager creates recipe for "Iced Tea"
2. Clicks "Save" button
3. Network is slow, clicks again
4. First request completes (creates recipe-1)
5. Second request completes (creates recipe-2)
6. Result: 2 recipes for same menu item
```

### Scenario 2: Offline Sync Queue
```
1. Manager offline, clicks "Save"
2. Enter back online
3. Sync queue tries to sync
4. Network issue causes retry
5. Duplicate entry in sync queue
6. Both execute
7. Result: 2 recipes for same menu item
```

### Scenario 3: RLS Policy Failure + Offline
```
1. Manager tries to save recipe
2. RLS blocks because policy says "Admins only"
3. Code catches error, queues for offline sync
4. Same saveRecipe called elsewhere concurrently
5. Both queue mutations
6. On sync: 2 duplicate recipes created
```

---

## Impact Assessment

### Data Integrity: 🔴 **CRITICAL**

**What Gets Lost**:
- First recipe for a menu item is silently overwritten
- No way to recover (no audit trail)
- User has no idea

**Example**:
```
Manager spent 30 minutes creating perfect recipe
Second recipe is created by accident
First recipe is LOST
User has no warning
```

### System Flow Impact: 🟡 **MEDIUM**

- POS might get wrong recipe (the last one)
- Inventory deductions could be wrong
- Inconsistent recipe usage

### Database Integrity: 🟡 **MEDIUM**

- No constraint preventing it
- Data becomes inconsistent
- Hard to identify which is "real" recipe

---

## Recommended Fixes

### Fix 1: Add UNIQUE Constraint (Database) - CRITICAL

**Location**: Supabase SQL Editor

**What to run**:
```sql
-- Add unique constraint on dish_id
ALTER TABLE recipes ADD CONSTRAINT unique_recipe_per_dish UNIQUE (dish_id);

-- Or if constraint already needs migration:
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS unique_recipe_per_dish;
ALTER TABLE recipes ADD CONSTRAINT unique_recipe_per_dish UNIQUE (dish_id);
```

**Impact**: 
- ✅ Prevents database from accepting duplicates
- ✅ Database returns error instead of silent overwrite
- ✅ Only allows one recipe per menu item

**Risk**: LOW - This is the correct design

---

### Fix 2: Detect & Handle Duplicates (Code) - HIGH

**Location**: [src/services/databaseService.js](src/services/databaseService.js#L1106-1125)

```javascript
export const getRecipes = async () => {
  const supabase = initSupabaseClient();
  // ... existing code ...
  
  try {
    return await retryWithBackoff(async () => {
      const { data, error } = await supabase.from('recipes').select('*');
      if (error) throw error;
      console.log('[DB] ✅ getRecipes() from Supabase');
      
      // ✅ NEW: Detect duplicates
      const recipes = {};
      const duplicates = {};
      
      data.forEach(r => {
        if (recipes[r.dish_id]) {
          if (!duplicates[r.dish_id]) {
            duplicates[r.dish_id] = [];
          }
          duplicates[r.dish_id].push(r.id);
        }
        recipes[r.dish_id] = r;
      });
      
      // ⚠️ Log warning if duplicates found
      if (Object.keys(duplicates).length > 0) {
        console.error('[DB] ❌ DUPLICATE RECIPES DETECTED:', duplicates);
        console.error('[DB] ⚠️ Multiple recipes exist for dishes:', Object.keys(duplicates));
        console.error('[DB] ⚠️ Manual cleanup required in Supabase!');
        // Could trigger admin notification here
      }
      
      setLocalStorage(STORAGE_KEYS.RECIPES, recipes);
      return recipes;
    });
  } catch (error) {
    console.error('[DB] ❌ getRecipes() failed:', error);
    return getLocalStorage(STORAGE_KEYS.RECIPES, {});
  }
};
```

**Impact**:
- ✅ Detects duplicates before they cause problems
- ✅ Alerts admin to cleanup
- ✅ Uses most recent recipe (stable behavior)

---

### Fix 3: Prevent Duplicates on Save (Code) - HIGH

**Location**: [src/services/databaseService.js](src/services/databaseService.js#L1130-1157)

```javascript
export const saveRecipe = async (dishId, recipe) => {
  const supabase = initSupabaseClient();
  const recipeData = Array.isArray(recipe)
    ? { dish_id: dishId, ingredients: recipe, id: crypto.randomUUID() }
    : {
        ...recipe,
        dish_id: dishId,
        ingredients: recipe.ingredients ?? recipe,
        id: recipe.id || crypto.randomUUID(),  // ⚠️ Always generates new ID!
      };

  if (!supabase || !isOnline) {
    console.log('[DB] 📥 saveRecipe() — queued for offline sync');
    queueMutation({ type: 'INSERT', table: 'recipes', data: recipeData });
    return Promise.resolve();
  }

  try {
    await retryWithBackoff(async () => {
      // ✅ Check if recipe already exists for this dish
      if (!recipeData.id || recipeData.id === 'ffffffff-ffff-ffff-ffff-ffffffffffff') {
        // No ID provided - check if recipe already exists
        const { data: existing, error: fetchError } = await supabase
          .from('recipes')
          .select('id')
          .eq('dish_id', dishId)
          .single();
        
        if (fetchError && fetchError.code !== 'PGRST116') {
          // Real error (not "no rows found")
          throw fetchError;
        }
        
        // If recipe exists, update it instead of creating new
        if (existing?.id) {
          recipeData.id = existing.id;
          console.log('[DB] 📝 Updating existing recipe for dish:', dishId);
        } else {
          // Only generate new ID if no recipe exists
          recipeData.id = crypto.randomUUID();
          console.log('[DB] ➕ Creating new recipe for dish:', dishId);
        }
      }
      
      const { error } = await supabase.from('recipes').upsert(recipeData);
      if (error) throw error;
      console.log('[DB] ✅ saveRecipe() to Supabase');
    });
  } catch (error) {
    console.error('[DB] ❌ saveRecipe() failed:', error);
    queueMutation({ type: 'INSERT', table: 'recipes', data: recipeData });
  }
};
```

**Impact**:
- ✅ Reuses existing recipe ID when updating
- ✅ Prevents duplicate creation on double-click
- ✅ Clear logging of what's happening

---

### Fix 4: Fix RLS Policy (Database) - MEDIUM

**Current Policy**: Only Admins can modify recipes  
**Reality**: Managers modify recipes in Inventory Manager

**Option A: Allow Managers** (if intended)
```sql
DROP POLICY IF EXISTS "Admins modify recipes" ON recipes;

CREATE POLICY "Managers and admins modify recipes" ON recipes
  FOR INSERT WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

CREATE POLICY "Managers and admins update recipes" ON recipes
  FOR UPDATE USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );
```

**Option B: Keep admin-only** (if intended)
- Update UI to only allow Admins to edit recipes
- Lock down Manager access

---

## Implementation Priority

| Fix | Priority | Time | Impact | Risk |
|-----|----------|------|--------|------|
| #1: UNIQUE constraint | 🔴 CRITICAL | 5 min | Prevents duplicates at DB level | LOW |
| #2: Duplicate detection | 🟠 HIGH | 15 min | Detects & alerts | LOW |
| #3: Prevent double-save | 🟠 HIGH | 10 min | Stops user mistakes | LOW |
| #4: Fix RLS policy | 🟡 MEDIUM | 5 min | Close security gap | LOW |

**Total**: 35 minutes for full solution

---

## Testing Recommendations

### Test 1: Uniqueness Constraint
```
1. Create recipe for menu item A
2. Try to create second recipe for same menu item
3. Expected: Database error or auto-update
4. NOT: Silent duplicate creation
```

### Test 2: Duplicate Detection
```
1. Manually insert 2 recipes in Supabase
2. Reload recipes in app
3. Expected: Console warning about duplicates
4. NOT: Silent overwrite
```

### Test 3: Double-Click Prevention
```
1. Create recipe
2. Click "Save" twice quickly
3. Expected: Only one recipe created
4. NOT: Duplicate with same ingredients
```

### Test 4: RLS Policy
```
1. Login as Manager
2. Try to save recipe
3. Expected: Works (or fails with clear error)
4. NOT: Silent queue for offline sync
```

---

## Summary

### Current Vulnerabilities

| # | Issue | Severity | Risk |
|---|-------|----------|------|
| 1 | No UNIQUE constraint on dish_id | 🔴 CRITICAL | Silent data loss |
| 2 | Code overwrites duplicate recipes | 🔴 CRITICAL | Data lost without warning |
| 3 | saveRecipe always creates new ID | 🟠 HIGH | Double-click = duplicate |
| 4 | RLS policy vs reality | 🟡 MEDIUM | Offline sync anomalies |

### Fixes Applied

✅ Recipe ingredient validation (prevents null UUID)  
⏳ Duplicate prevention (needs implementation)  
⏳ RLS policy alignment (needs implementation)

---

## Recommendation

**Implement all 4 fixes**:
1. Add UNIQUE constraint (5 min)
2. Add duplicate detection (15 min)
3. Prevent double-save (10 min)
4. Fix RLS policy (5 min)

**Total: 35 minutes**

This makes the system robust against recipe duplication and data loss.

