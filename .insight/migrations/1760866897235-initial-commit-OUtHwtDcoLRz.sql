BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD CONSTRAINT categories_color_format_check CHECK (color IS NULL OR color ~* '^#([0-9A-F]{6}|[0-9A-F]{3})$');

CREATE UNIQUE INDEX IF NOT EXISTS categories_user_id_name_lower_uniq
  ON public.categories (user_id, lower(name));

CREATE INDEX IF NOT EXISTS categories_name_trgm_idx
  ON public.categories USING gin (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS categories_user_id_idx
  ON public.categories (user_id);

CREATE INDEX IF NOT EXISTS categories_is_favorite_idx
  ON public.categories (is_favorite);

CREATE UNIQUE INDEX IF NOT EXISTS tags_user_id_name_lower_uniq
  ON public.tags (user_id, lower(name));

CREATE INDEX IF NOT EXISTS tags_name_trgm_idx
  ON public.tags USING gin (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tags_user_id_idx
  ON public.tags (user_id);

ALTER TABLE public.preset_tags
  DROP CONSTRAINT IF EXISTS preset_tags_preset_id_fkey,
  DROP CONSTRAINT IF EXISTS preset_tags_tag_id_fkey;

ALTER TABLE public.preset_tags
  ADD CONSTRAINT preset_tags_preset_id_fkey
    FOREIGN KEY (preset_id) REFERENCES public.presets(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT preset_tags_tag_id_fkey
    FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE ON UPDATE CASCADE;

DO $$ BEGIN
IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'preset_tags_pkey'
) THEN
  ALTER TABLE public.preset_tags
    ADD CONSTRAINT preset_tags_pkey PRIMARY KEY (preset_id, tag_id);
END IF;
END $$;

ALTER TABLE public.transaction_tags
  DROP CONSTRAINT IF EXISTS transaction_tags_transaction_id_fkey,
  DROP CONSTRAINT IF EXISTS transaction_tags_tag_id_fkey;

ALTER TABLE public.transaction_tags
  ADD CONSTRAINT transaction_tags_transaction_id_fkey
    FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT transaction_tags_tag_id_fkey
    FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE ON UPDATE CASCADE;

DO $$ BEGIN
IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transaction_tags_pkey'
) THEN
  ALTER TABLE public.transaction_tags
    ADD CONSTRAINT transaction_tags_pkey PRIMARY KEY (transaction_id, tag_id);
END IF;
END $$;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_category_id_fkey;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.recurring_transactions
  DROP CONSTRAINT IF EXISTS recurring_transactions_category_id_fkey;

ALTER TABLE public.recurring_transactions
  ADD CONSTRAINT recurring_transactions_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.presets
  DROP CONSTRAINT IF EXISTS presets_category_id_fkey;

ALTER TABLE public.presets
  ADD CONSTRAINT presets_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.category_budgets
  DROP CONSTRAINT IF EXISTS category_budgets_category_id_fkey;

ALTER TABLE public.category_budgets
  ADD CONSTRAINT category_budgets_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;