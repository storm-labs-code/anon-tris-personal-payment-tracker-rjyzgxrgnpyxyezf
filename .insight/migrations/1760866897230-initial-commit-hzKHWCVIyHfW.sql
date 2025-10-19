BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE payment_method AS ENUM ('cash', 'card', 'bank_transfer', 'mobile', 'other');
CREATE TYPE recurrence_frequency AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE theme_preference AS ENUM ('light', 'dark', 'system');
CREATE TYPE currency_code AS ENUM ('KRW');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  primary_currency currency_code NOT NULL DEFAULT 'KRW',
  time_zone text NOT NULL DEFAULT 'Asia/Seoul',
  theme theme_preference NOT NULL DEFAULT 'system',
  notifications_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name text NOT NULL,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
CREATE INDEX idx_categories_user ON categories(user_id);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name text NOT NULL,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
CREATE INDEX idx_tags_user ON tags(user_id);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON tags FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  amount bigint NOT NULL CHECK (amount >= 0),
  occurred_at timestamptz NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE,
  payee text,
  payment_method payment_method NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, occurred_at DESC);
CREATE INDEX idx_transactions_user_category ON transactions(user_id, category_id);
CREATE INDEX idx_transactions_user_method ON transactions(user_id, payment_method);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE transaction_tags (
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (transaction_id, tag_id)
);
CREATE INDEX idx_transaction_tags_tag ON transaction_tags(tag_id);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON transaction_tags FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE transaction_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  url text NOT NULL,
  content_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, url)
);
CREATE INDEX idx_transaction_receipts_tx ON transaction_receipts(transaction_id);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON transaction_receipts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name text NOT NULL,
  amount bigint CHECK (amount IS NULL OR amount >= 0),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE,
  payee text,
  payment_method payment_method,
  notes text,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
CREATE INDEX idx_presets_user ON presets(user_id);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON presets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE preset_tags (
  preset_id uuid NOT NULL REFERENCES presets(id) ON DELETE CASCADE ON UPDATE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (preset_id, tag_id)
);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON preset_tags FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE recurring_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  amount bigint NOT NULL CHECK (amount >= 0),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE,
  payee text,
  payment_method payment_method NOT NULL,
  notes text,
  frequency recurrence_frequency NOT NULL,
  interval integer NOT NULL DEFAULT 1 CHECK (interval >= 1),
  start_date date NOT NULL,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  reminder_enabled boolean NOT NULL DEFAULT false,
  reminder_time time WITHOUT TIME ZONE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date),
  CHECK (reminder_enabled = false OR reminder_time IS NOT NULL)
);
CREATE INDEX idx_recurring_tx_user_active ON recurring_transactions(user_id, is_active, frequency);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON recurring_transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE category_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE ON UPDATE CASCADE,
  period_start date NOT NULL,
  amount bigint NOT NULL CHECK (amount >= 0),
  alert_threshold_percent integer NOT NULL DEFAULT 80 CHECK (alert_threshold_percent >= 0 AND alert_threshold_percent <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, period_start),
  CHECK (date_trunc('month', period_start) = period_start)
);
CREATE INDEX idx_budgets_user_period ON category_budgets(user_id, period_start);
CREATE TRIGGER set_timestamp BEFORE UPDATE ON category_budgets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;