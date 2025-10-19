CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE job_status AS ENUM ('pending','processing','succeeded','failed','canceled');
CREATE TYPE export_type AS ENUM ('transactions_csv','receipts_zip','manual_backup');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE data_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  export_type export_type NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  date_start date,
  date_end date,
  storage_url text,
  file_size bigint,
  status_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (file_size IS NULL OR file_size >= 0),
  CHECK (date_end IS NULL OR date_start IS NULL OR date_end >= date_start)
);

CREATE INDEX data_exports_user_status_idx ON data_exports (user_id, status);
CREATE INDEX data_exports_user_created_idx ON data_exports (user_id, created_at DESC);
CREATE INDEX data_exports_user_type_idx ON data_exports (user_id, export_type);

CREATE TRIGGER set_timestamp_data_exports
BEFORE UPDATE ON data_exports
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE data_restores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  source_export_id uuid REFERENCES data_exports(id) ON DELETE SET NULL ON UPDATE CASCADE,
  source_url text,
  status job_status NOT NULL DEFAULT 'pending',
  status_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_export_id IS NOT NULL OR source_url IS NOT NULL)
);

CREATE INDEX data_restores_user_status_idx ON data_restores (user_id, status);
CREATE INDEX data_restores_user_created_idx ON data_restores (user_id, created_at DESC);

CREATE TRIGGER set_timestamp_data_restores
BEFORE UPDATE ON data_restores
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();