-- rls_auto_enable() is an event trigger function — it must only be invoked by the
-- Postgres DDL event trigger system, never via the REST API. Revoke public EXECUTE
-- to close the anon/authenticated SECURITY DEFINER exposure flagged by the advisor.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
