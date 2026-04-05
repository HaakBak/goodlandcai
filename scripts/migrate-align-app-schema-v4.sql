-- Migration: ensure menu.has_sizes exists for current app compatibility
-- This migration fixes legacy schema mismatches when saving menu items.

BEGIN;

ALTER TABLE menu
  ADD COLUMN IF NOT EXISTS has_sizes BOOLEAN DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu' AND column_name = 'hasSizes'
  ) THEN
    UPDATE menu
    SET has_sizes = COALESCE(has_sizes, "hasSizes")
    WHERE has_sizes IS NULL;
  END IF;
END $$;

COMMIT;
