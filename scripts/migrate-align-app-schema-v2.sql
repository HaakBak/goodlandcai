-- Migration: Align app field names to the deployed Supabase schema
-- Adds app-specific columns used by the current UI and copies legacy snake_case values where possible.

BEGIN;

-- 1) MENU: Add fields used by the POS manager app
ALTER TABLE menu
  ADD COLUMN IF NOT EXISTS "basePrice" DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "VAT_fee" DECIMAL(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalPrice" DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "hasSizes" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sizes JSONB DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu' AND column_name = 'base_price'
  ) THEN
    UPDATE menu
    SET "basePrice" = COALESCE("basePrice", base_price);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu' AND column_name = 'vat_fee'
  ) THEN
    UPDATE menu
    SET "VAT_fee" = COALESCE("VAT_fee", vat_fee);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu' AND (column_name = 'base_price' OR column_name = 'vat_fee')
  ) THEN
    UPDATE menu
    SET "totalPrice" = COALESCE(
      "totalPrice",
      COALESCE(base_price, 0) + COALESCE(vat_fee, 0)
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu' AND column_name = 'has_sizes'
  ) THEN
    UPDATE menu
    SET "hasSizes" = COALESCE("hasSizes", has_sizes);
  END IF;
END $$;

UPDATE menu
SET sizes = COALESCE(sizes, '{}'::jsonb)
WHERE sizes IS NULL;

-- 2) INVENTORY: Add app model columns and map legacy values
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS "expirationDate" DATE,
  ADD COLUMN IF NOT EXISTS "inStock" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reorderLevel" INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "measurementUnit" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "measurementQty" INTEGER,
  ADD COLUMN IF NOT EXISTS "openStock" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER DEFAULT 5;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory' AND column_name = 'expiration_date'
  ) THEN
    UPDATE inventory
    SET "expirationDate" = COALESCE("expirationDate", expiration_date);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory' AND column_name = 'in_stock'
  ) THEN
    UPDATE inventory
    SET "inStock" = COALESCE("inStock", in_stock);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory' AND column_name = 'reorder_level'
  ) THEN
    UPDATE inventory
    SET "reorderLevel" = COALESCE("reorderLevel", reorder_level);
  END IF;
END $$;

-- 3) SUPPLIERS: Add items array storage
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]';

UPDATE suppliers
SET items = COALESCE(items, '[]'::jsonb)
WHERE items IS NULL;

-- 4) HISTORY: Add the app field used by inventory/audit logging
ALTER TABLE history
  ADD COLUMN IF NOT EXISTS date DATE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'history' AND column_name = 'created_at'
  ) THEN
    UPDATE history
    SET date = COALESCE(date, created_at::date)
    WHERE date IS NULL;
  END IF;
END $$;

-- 5) SERVICE_FEES: Add the app field used by POSM and copy existing dine_in values
ALTER TABLE service_fees
  ADD COLUMN IF NOT EXISTS "dineIn" DECIMAL(5, 2) NOT NULL DEFAULT 0;

UPDATE service_fees
SET "dineIn" = COALESCE("dineIn", dine_in);

COMMIT;
