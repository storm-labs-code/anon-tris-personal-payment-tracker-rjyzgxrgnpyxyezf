BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'currency_code') THEN
    CREATE TYPE public.currency_code AS ENUM ('KRW');
  END IF;
END $$;

ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'KRW';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'theme_preference') THEN
    CREATE TYPE public.theme_preference AS ENUM ('light','dark');
  END IF;
END $$;

ALTER TYPE public.theme_preference ADD VALUE IF NOT EXISTS 'light';
ALTER TYPE public.theme_preference ADD VALUE IF NOT EXISTS 'dark';

ALTER TABLE public.user_settings
  ALTER COLUMN primary_currency SET DEFAULT 'KRW'::public.currency_code;

ALTER TABLE public.user_settings
  ALTER COLUMN theme SET DEFAULT 'light'::public.theme_preference;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS alerts_enabled boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_settings'::regclass
      AND conname = 'user_settings_user_id_key'
  ) THEN
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_email_visible boolean NOT NULL DEFAULT false;

COMMIT;