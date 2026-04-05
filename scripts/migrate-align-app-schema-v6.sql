-- Migration: add history timestamp, user and role columns for current app audit logging
-- This migration aligns the legacy history table with the fields used by addHistoryLog().

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

BEGIN;


ALTER TABLE history
  ADD COLUMN IF NOT EXISTS "user" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS role VARCHAR(50),
  ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE;

ALTER TABLE history
  ALTER COLUMN user_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'history'
      AND column_name = 'created_at'
  ) THEN
    UPDATE history
    SET timestamp = COALESCE(timestamp, created_at)
    WHERE timestamp IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'history'
      AND column_name = 'user_id'
  ) THEN
    UPDATE history h
    SET "user" = COALESCE(h."user", up.username),
        role = COALESCE(h.role, up.role)
    FROM user_profiles up
    WHERE h.user_id = up.id
      AND (h."user" IS NULL OR h.role IS NULL);
  END IF;
END $$;

COMMIT;
