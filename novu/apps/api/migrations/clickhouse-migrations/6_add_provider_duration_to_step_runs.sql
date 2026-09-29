ALTER TABLE step_runs
  ADD COLUMN IF NOT EXISTS provider_duration_ms Nullable(UInt32);
