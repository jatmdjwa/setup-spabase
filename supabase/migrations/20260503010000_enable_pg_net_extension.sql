-- Enable pg_net extension for triggering Edge Functions from DB triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Note: The service_role_key must be stored in Supabase Vault BEFORE
-- the trigger runs. See companion documentation for the vault.create_secret
-- call (which is intentionally not in this migration because the secret
-- value should not be committed to source control).
