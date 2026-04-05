-- Migration: add history.date and menu.sizes for current app field usage
-- This migration is intended to be run after the existing schema alignment migrations.

BEGIN;

ALTER TABLE menu
  ADD COLUMN IF NOT EXISTS sizes JSONB DEFAULT '{}'::jsonb;

UPDATE menu
SET sizes = COALESCE(sizes, '{}'::jsonb)
WHERE sizes IS NULL;

ALTER TABLE history
  ADD COLUMN IF NOT EXISTS date DATE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'history'
      AND column_name = 'created_at'
  ) THEN
    UPDATE history
    SET date = COALESCE(date, created_at::date)
    WHERE date IS NULL;
  END IF;
END $$;

COMMIT;
