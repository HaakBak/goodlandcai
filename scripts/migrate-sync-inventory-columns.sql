-- Migration: Create and sync camelCase columns in inventory table
-- Purpose: Add missing camelCase columns and populate them from snake_case values
-- Date: 2026-04-05

-- Step 1: Add missing camelCase columns if they don't exist
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS "inStock" INTEGER DEFAULT 0;

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS "reorderLevel" INTEGER DEFAULT 10;

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS "measurementUnit" VARCHAR(20);

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS "measurementQty" INTEGER DEFAULT 1;

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS "openStock" INTEGER DEFAULT 0;

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER DEFAULT 5;

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS "expirationDate" DATE;

-- Step 2: Sync snake_case data to camelCase columns
UPDATE inventory
SET
  "inStock" = in_stock,
  "reorderLevel" = reorder_level,
  "measurementUnit" = COALESCE(NULLIF(unit, ''), 'pcs'),  -- Use unit or default to 'pcs'
  "measurementQty" = COALESCE("measurementQty", 1),  -- Keep existing or default to 1
  "openStock" = COALESCE("openStock", 0),  -- Keep existing or default to 0
  "lowStockThreshold" = COALESCE("lowStockThreshold", reorder_level),  -- Use reorder_level as default
  "expirationDate" = expiration_date
WHERE TRUE;  -- Update all rows

-- Step 3: Verify migration success
SELECT 
  COUNT(*) as total_rows,
  COUNT(CASE WHEN "inStock" IS NOT NULL THEN 1 END) as inStock_populated,
  COUNT(CASE WHEN "measurementUnit" IS NOT NULL THEN 1 END) as unit_populated,
  COUNT(CASE WHEN "measurementQty" IS NOT NULL THEN 1 END) as qty_populated,
  COUNT(CASE WHEN "lowStockThreshold" IS NOT NULL THEN 1 END) as threshold_populated
FROM inventory;
