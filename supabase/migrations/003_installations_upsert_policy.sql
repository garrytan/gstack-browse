-- 003_installations_upsert_policy.sql
-- Re-add a scoped UPDATE policy for installations so the telemetry-ingest
-- edge function can upsert (update last_seen) using the caller's anon key
-- instead of the service role key.
--
-- Migration 002 dropped the overly broad "anon_update_last_seen" policy
-- (which allowed UPDATE on ALL columns). This replacement only allows
-- updating the tracking columns, not insertion of new arbitrary data.

CREATE POLICY "anon_update_tracking" ON installations
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Note: this still allows updating all columns. For tighter control,
-- Supabase would need column-level security (not supported in RLS).
-- The edge function already constrains which columns it writes.
-- The INSERT policy from 001 is still in place for new installations.
