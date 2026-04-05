# Phase 4 Deployment & Web App Update Plan

**Date**: April 4, 2026  
**Status**: Based on your earlier planning

---

## Phase 4: Deployment & Real-World Testing

### What Phase 4 Covers (Based on System Evolution)

**Phase 1-3 Summary**:
- ✅ Phase 1: Fixed inventory deduction system (Issues #1-3)
- ✅ Phase 2: Null UUID bug analysis & prevention
- ✅ Phase 3: Recipe duplication prevention & data alignment

**Phase 4 Goals**:
1. **Deploy cleaned data** to Supabase production
2. **Update web app** with latest system improvements
3. **Real-world testing** - full POS workflow
4. **Monitor & optimize** - error tracking, performance

---

## Can You Edit Data After Deployment?

### ✅ YES - WITH CONDITIONS

**After deploying data, you can:**

1. **Edit via Supabase Dashboard**
   - Click table → Click cell → Edit → Save
   - ✅ Works for individual items
   - ✅ Update prices anytime
   - ✅ Adjust inventory levels

2. **Edit via Application UI**
   - Manager: Create/edit recipes in Inventory page
   - Manager: Update menu items (with proper UI)
   - Employee: Can't edit (read-only for them)
   - Admin: Full access to all tables

3. **Edit via SQL**
   ```sql
   -- Update specific item
   UPDATE menu SET base_price = 7.50 WHERE name = 'French Fries';
   
   -- Update inventory
   UPDATE inventory SET in_stock = 500 WHERE name = 'Coffee Beans';
   
   -- Update recipe
   UPDATE recipes SET ingredients = '[...]' WHERE id = 'uuid';
   ```

4. **Bulk Updates**
   - Export CSV
   - Edit in Excel/Google Sheets
   - Re-import via Data → Import CSV
   - ✅ Works (with primary key, which we'll fix)

---

## How to Update Web App After Data Deployment

### Scenario 1: Minor Updates (pricing, stock levels)

**Just edit in Supabase** - App reads directly from DB
```
1. Supabase Dashboard → Table View
2. Click cell to edit
3. Save
4. App automatically shows updated data on next load ✅
```

### Scenario 2: Code Updates (add features, fix bugs)

**Redeploy application code**:

```bash
1. Make code changes in VS Code
2. Build: npm run build
3. Deploy to production:
   - If using Vercel: git push (auto-deploys)
   - If using hosting: Upload dist/ folder
4. App updated with new features ✅
```

**Example: Add new recipe validation**
```javascript
// Edit: src/pages/manager/Inventory.jsx
// Add validation for min ingredient quantity

// Then:
$ npm run build      # Build new version
$ git push          # Deploys to production (if Vercel)
```

### Scenario 3: Schema Changes (add new columns)

**Steps**:

```sql
-- 1. Add column in Supabase
ALTER TABLE menu ADD COLUMN supplier VARCHAR(100);

-- 2. Update app to display
-- Edit: src/components/MenuCard.jsx
// Show supplier info
<p>{item.supplier}</p>

-- 3. Rebuild & deploy
$ npm run build
$ git push
```

---

## Deployment Checklist for Data

1. **Before deploying:**
   - ✅ Fix primary key issue (see next section)
   - ✅ Delete existing inventory/menu/recipes tables
   - ✅ Recreate tables with proper schema
   - ✅ Import updated CSV files

2. **During deployment:**
   - ✅ Monitor Supabase for errors
   - ✅ Validate data imported correctly
   - ✅ Run validation SQL queries

3. **After deployment:**
   - ✅ Test Employee POS
   - ✅ Test Manager Inventory
   - ✅ Test Admin Dashboard
   - ✅ Check console for errors
   - ✅ Verify prices display correctly

4. **Go live:**
   - ✅ Update app to use production data
   - ✅ Monitor for issues
   - ✅ Keep backup of old data

---

## Now Solving: Primary Key Issue

**The Error You're Seeing**:
```
Unable to delete row as a table has no primary keys
Add a primary key column to your table first...
```

### Root Cause Analysis

The inventory table **lacks a PRIMARY KEY constraint** on the `id` column. This happened because:

1. **Scenario A**: Table was created without PRIMARY KEY
2. **Scenario B**: Primary key was dropped accidentally
3. **Scenario C**: Data was imported incorrectly, bypassing PK constraint

---

## Solution: Fix the Inventory Table

### Option 1: Drop & Recreate (Recommended) ✅

**Step 1: Delete the broken table**
```sql
DROP TABLE IF EXISTS inventory CASCADE;
```

**Step 2: Recreate with proper schema**
```sql
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  in_stock INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  unit VARCHAR(20),
  cost DECIMAL(10, 2),
  type VARCHAR(50),
  expiration_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_in_stock ON inventory(in_stock);

-- Enable RLS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Managers & Admins can read inventory
CREATE POLICY "Managers and admins read inventory" ON inventory
  FOR SELECT USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

-- RLS Policy: Only Managers & Admins can modify
CREATE POLICY "Managers and admins modify inventory" ON inventory
  FOR INSERT WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

CREATE POLICY "Managers and admins update inventory" ON inventory
  FOR UPDATE USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );

CREATE POLICY "Managers and admins delete inventory" ON inventory
  FOR DELETE USING (
    (auth.jwt()->'user_metadata'->>'role') IN ('Manager', 'Administrator')
  );
```

**Step 3: Import the fresh data**
```
Supabase Dashboard:
1. Data → Import CSV
2. File: inventory_updated.csv
3. Table: inventory
4. Click Import
```

**Step 4: Verify**
```sql
SELECT COUNT(*) FROM inventory;  -- Should be: 20

-- Try to delete a row (should work now)
DELETE FROM inventory WHERE id = 'some-uuid';  -- ✅ Works!
```

---

### Option 2: Add Primary Key to Existing Table (If keeping data)

```sql
-- If table has data but no PK:
ALTER TABLE inventory ADD PRIMARY KEY (id);
```

**⚠️ Warning**: Only works if:
- All `id` values are non-null
- All `id` values are unique
- No duplicate IDs exist

**Check first**:
```sql
-- Count nulls
SELECT COUNT(*) FROM inventory WHERE id IS NULL;
-- Should return: 0

-- Count duplicates
SELECT id, COUNT(*) FROM inventory GROUP BY id HAVING COUNT(*) > 1;
-- Should return: 0 rows
```

---

## Why This Error Happens & How to Prevent It

### Common Causes

| Cause | Signs | Fix |
|-------|-------|-----|
| Table created without PRIMARY KEY | "No primary keys" error | Drop & recreate |
| Duplicate IDs in data | Import fails with uniqueness error | Clean data first |
| NULL IDs | Can't add PK | Update NULLs to UUIDs |
| PK was accidentally dropped | Worked before, now doesn't | Recreate PK |

### Prevention Tips

1. **Always use provided schema** from [scripts/supabase-schema.sql](scripts/supabase-schema.sql)
2. **Don't import before table creation**
3. **Verify before importing**:
   ```sql
   SELECT COUNT(*) FROM information_schema.table_constraints 
   WHERE table_name = 'inventory' AND constraint_type = 'PRIMARY KEY';
   -- Should return: 1
   ```

---

## Complete Deployment Procedure (Fixed)

### Step 1: Clean Up Old Tables

```sql
-- Backup if needed, then delete
DROP TABLE IF EXISTS recipes CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS menu CASCADE;
```

### Step 2: Create Fresh Schema

```sql
-- Copy entire schema from: scripts/supabase-schema.sql
-- Run in Supabase SQL Editor
-- Make sure menu, inventory, recipes tables are created with PRIMARY KEYs
```

### Step 3: Import Data in Order

```
Important: Import in this order (due to foreign keys):
1. menu_updated.csv → table: menu
2. inventory_updated.csv → table: inventory
3. recipes_updated.csv → table: recipes
```

### Step 4: Validate

```sql
-- After each import, check:
SELECT COUNT(*) FROM menu;       -- 19
SELECT COUNT(*) FROM inventory;  -- 20
SELECT COUNT(*) FROM recipes;    -- 20

-- Try delete to verify PK exists
DELETE FROM inventory WHERE id = 'test-id';  -- Should work (or NOT FOUND error, not PK error)
```

### Step 5: Test in App

1. **Employee POS**: Order items, verify stock decreases
2. **Manager Inventory**: View recipes, create new one
3. **Admin**: Check all data visible
4. **Console**: No errors about missing data

---

## Phase 4 Timeline Estimate

| Task | Time | Status |
|------|------|--------|
| Fix primary key issue | 5 min | ⏳ NOW |
| Drop old tables | 2 min | ⏳ NOW |
| Recreate schema | 3 min | ⏳ NOW |
| Import 3 CSV files | 5 min | ⏳ NOW |
| Validate with SQL | 5 min | ⏳ NOW |
| Test in application | 15 min | ⏳ AFTER IMPORT |
| Full system test | 20 min | ⏳ AFTER APP TEST |
| **TOTAL** | **55 min** | **✅ READY** |

---

## After Data Deployment: Next Steps

### Immediate (Day 1)
- ✅ Complete deployment
- ✅ Test all user roles
- ✅ Verify inventory deductions work
- ✅ Check POS transactions

### Short-term (This Week)
- ⏳ Add UNIQUE constraint on recipes.dish_id
- ⏳ Create usage_logs table
- ⏳ Monitor for errors in production
- ⏳ Gather user feedback

### Medium-term (Next Sprint)
- ⏳ Add advanced features (discounts, membership)
- ⏳ Implement 2FA (from earlier planning)
- ⏳ Add reporting dashboard
- ⏳ Mobile app version

---

## Edit & Update Web App After Deployment

### Quick Edits (No Code Changes)

**Change a price**:
```
Supabase → menu table → Click price cell → Edit → Save
App shows new price immediately ✅
```

**Change inventory level**:
```
Supabase → inventory table → Click in_stock → Edit → Save
App reflects new stock immediately ✅
```

**Change recipe ingredients**:
```
Manager → Inventory → Click recipe → Edit → Save
Changes persist in database ✅
```

### Feature Updates (Code Changes)

**Add new discount feature**:
1. Edit [src/pages/employee/POS.jsx](src/pages/employee/POS.jsx)
2. Add discount calculation logic
3. Build: `npm run build`
4. Deploy: `git push` (or upload dist/)
5. Live immediately ✅

**Update menu item display**:
1. Edit [src/components/MenuCard.jsx](src/components/MenuCard.jsx)
2. Change layout/styling/info shown
3. Build & deploy
4. Live immediately ✅

### Database Schema Updates

**Add new column**:
```sql
-- 1. Add to Supabase
ALTER TABLE menu ADD COLUMN supplier_id UUID;

-- 2. Update app to use it
// Edit components to show supplier info

-- 3. Deploy code
npm run build && git push

-- 4. Update old rows if needed
UPDATE menu SET supplier_id = 'uuid' WHERE supplier_id IS NULL;
```

---

## Summary: Three Questions Answered

### 1. Phase 4 Plan
✅ Deploy cleaned data → Test thoroughly → Monitor → Iterate

### 2. Can You Edit After Deployment?
✅ YES
- **Data**: Edit in Supabase instantly
- **Code**: Update app & redeploy
- **Schema**: Add columns with SQL
- **Everything**: Live without downtime

### 3. Primary Key Issue - SOLVED
✅ Drop broken inventory table → Recreate with PRIMARY KEY schema → Re-import data

---

**Status**: 🟢 READY FOR PHASE 4 DEPLOYMENT  
**Estimated Time to Live**: 55 minutes  
**Risk Level**: 🟢 LOW (with proper backup)

Next: Execute the SQL fix below, then we proceed to deployment!
