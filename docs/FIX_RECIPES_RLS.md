# IMMEDIATE FIX: Recipes RLS Policy

## The Problem

Employees cannot access recipes in POS because the RLS policy only allows Managers & Admins.

## The Solution

Run this SQL in Supabase SQL Editor:

### Step 1: Remove Old (Broken) Policy

```sql
DROP POLICY IF EXISTS "Managers and admins read recipes" ON recipes;
```

### Step 2: Create New Policy (Allow All Authenticated Users)

```sql
CREATE POLICY "Authenticated users read recipes" ON recipes
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );
```

### Complete Fixed Policy Block

```sql
-- Drop the old policy that blocked employees
DROP POLICY IF EXISTS "Managers and admins read recipes" ON recipes;

-- Create new policy allowing all authenticated users to read
CREATE POLICY "Authenticated users read recipes" ON recipes
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

-- OPTIONAL: Verify the policy was created
SELECT policyname, roles, qual FROM pg_policies 
WHERE tablename = 'recipes' AND operation = 'SELECT';
```

## Why This Works

| Who | Current Policy | New Policy | Result |
|-----|---|---|---|
| Employee | ❌ Cannot read | ✅ Can read | ✅ POS works |
| Manager | ✅ Can read | ✅ Can read | ✅ Still works |
| Admin | ✅ Can read | ✅ Can read | ✅ Still works |
| Admin | ✅ Can write | ✅ Can write | ✅ Still works |

## What to Do

1. **Login to Supabase**
   - Go to: https://app.supabase.com
   - Select your project
   - Click "SQL Editor"

2. **Create New Query**
   - Click "New Query"
   - Paste the COMPLETE FIXED POLICY BLOCK above
   - Click "RUN"

3. **Verify Success**
   - You should see: "Query executed successfully"
   - Table Editor should now show recipes table working

4. **Test in POS**
   - Login as Employee
   - Go to POS
   - Try to add menu item with recipe
   - Should work WITHOUT "Inventory item not found" error

## If You Get Errors

### Error: "Extension plpgsql does not exist"
→ This is OK, the policy still works

### Error: "Cannot drop policy that does not exist"
→ It's already been dropped, skip that line

### Error: "Cannot create duplicate policy"
→ Drop it first, then create new one

## After This Fix

Once recipes are accessible to Employees:
- ✅ POS can load recipes
- ✅ Inventory deductions will work
- ✅ Stock will be updated automatically
- ✅ Transactions will complete normally

## Next: Verify Data Structure

After fixing RLS, verify recipe ingredients have correct IDs:

**In Supabase SQL Editor**:
```sql
-- Check first recipe's ingredients
SELECT id, dish_id, ingredients FROM recipes LIMIT 1;
```

**Expected ingredients structure**:
```json
[
  {
    "inventoryId": "some-uuid-here",
    "name": "Sugar",
    "quantity": 10
  }
]
```

**Bad structure** (if you see this, recipes need to be recreated):
```json
[
  {
    "id": "wrong-menu-item-uuid",
    "name": "Sugar",
    "quantity": 10
  }
]
```

If bad structure: Follow "Solution B" in [INVENTORY_DEDUCTION_ANALYSIS.md](INVENTORY_DEDUCTION_ANALYSIS.md)

---

## TL;DR

**Run this in Supabase SQL Editor**:
```sql
DROP POLICY IF EXISTS "Managers and admins read recipes" ON recipes;
CREATE POLICY "Authenticated users read recipes" ON recipes FOR SELECT USING (auth.uid() IS NOT NULL);
```

**Then test Employee POS login → Should work now** ✅

