BEGIN;

-- New enum for occurrence status
CREATE TYPE occurrence_status AS ENUM ('scheduled', 'completed', 'skipped', 'snoozed');

-- Add generation mode for recurring items
ALTER TABLE recurring_transactions
  ADD COLUMN auto_create_transactions boolean NOT NULL DEFAULT false;

-- Occurrences table to represent each scheduled instance of a recurring transaction
CREATE TABLE recurring_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  recurring_transaction_id uuid NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  occurs_on date NOT NULL,
  status occurrence_status NOT NULL DEFAULT 'scheduled',
  transaction_id uuid NULL REFERENCES transactions(id) ON DELETE SET NULL ON UPDATE CASCADE,
  snoozed_until date NULL,
  reminder_sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurring_occurrences_unique_rule_date UNIQUE (recurring_transaction_id, occurs_on),
  CONSTRAINT recurring_occurrences_completed_has_tx CHECK (status <> 'completed' OR transaction_id IS NOT NULL),
  CONSTRAINT recurring_occurrences_snoozed_has_date CHECK (status <> 'snoozed' OR snoozed_until IS NOT NULL)
);

CREATE INDEX idx_recurring_occurrences_user_occurs_on ON recurring_occurrences (user_id, occurs_on);
CREATE INDEX idx_recurring_occurrences_status ON recurring_occurrences (status);
CREATE UNIQUE INDEX recurring_occurrences_transaction_id_unique ON recurring_occurrences (transaction_id) WHERE transaction_id IS NOT NULL;

-- Store user web push subscriptions to enable reminders
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  expiration_time timestamptz NULL,
  user_agent text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions (user_id);

-- Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_recurring_occurrences
BEFORE UPDATE ON recurring_occurrences
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_timestamp_push_subscriptions
BEFORE UPDATE ON push_subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;