-- Migration: add history.time for current app audit logging
-- This migration fixes legacy history schema mismatches for addHistoryLog().

BEGIN;

ALTER TABLE history
  ADD COLUMN IF NOT EXISTS time VARCHAR(20);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'history'
      AND column_name = 'created_at'
  ) THEN
    UPDATE history
    SET time = COALESCE(time, to_char(created_at, 'HH24:MI:SS'))
    WHERE time IS NULL;
  END IF;
END $$;

COMMIT;
