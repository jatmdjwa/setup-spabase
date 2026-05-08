-- Migration: add_embedding_trigger
--
-- Creates trigger functions and triggers that asynchronously invoke the
-- `generate-embedding` Edge Function whenever rows in `insights` or
-- `document_chunks` are inserted, or have their embedded text columns
-- updated.
--
-- Dependencies:
--   * Extension `pg_net` (enabled in 20260503010000_enable_pg_net_extension.sql)
--   * Schema `vault` (provided by Supabase) containing a secret named
--     `service_role_key`. The secret MUST be created out-of-band via:
--       SELECT vault.create_secret('<service_role_key>', 'service_role_key',
--                                  'used by embedding trigger');
--     This is intentionally not part of any migration so the key value
--     never lands in source control.
--
-- Edge Function URL:
--   https://gntgcxdbcbywfboejimz.supabase.co/functions/v1/generate-embedding
--
-- Both trigger functions are SECURITY DEFINER so they can read from the
-- `vault.decrypted_secrets` view. They swallow errors / NULL request ids
-- from `net.http_post` and emit RAISE NOTICE warnings instead, so a
-- transient pg_net problem cannot block writes to the underlying tables.

-- ---------------------------------------------------------------------------
-- (a) insights trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_generate_embedding_insights()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_text          text;
  v_service_key   text;
  v_function_url  text := 'https://gntgcxdbcbywfboejimz.supabase.co/functions/v1/generate-embedding';
  v_request_id    bigint;
BEGIN
  -- Pick the best available text representation for embedding
  v_text := COALESCE(NEW.content_normalized, NEW.content);

  -- Defensive guard: nothing to embed
  IF v_text IS NULL OR length(btrim(v_text)) = 0 THEN
    RAISE NOTICE 'trigger_generate_embedding_insights: skipping row id=% (empty text)', NEW.id;
    RETURN NEW;
  END IF;

  -- Read the service role key from Vault
  BEGIN
    SELECT decrypted_secret
      INTO v_service_key
      FROM vault.decrypted_secrets
     WHERE name = 'service_role_key'
     LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'trigger_generate_embedding_insights: failed to read vault secret: %', SQLERRM;
    RETURN NEW;
  END;

  IF v_service_key IS NULL THEN
    RAISE NOTICE 'trigger_generate_embedding_insights: service_role_key not found in vault, skipping row id=%', NEW.id;
    RETURN NEW;
  END IF;

  -- Fire-and-forget HTTP POST to the Edge Function
  BEGIN
    SELECT net.http_post(
      url     := v_function_url,
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || v_service_key
                 ),
      body    := jsonb_build_object(
                   'table',     'insights',
                   'id',        NEW.id,
                   'text',      v_text,
                   'task_type', 'RETRIEVAL_DOCUMENT'
                 )
    ) INTO v_request_id;

    IF v_request_id IS NULL THEN
      RAISE NOTICE 'trigger_generate_embedding_insights: net.http_post returned NULL request id for row id=%', NEW.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never block the underlying write; embedding can be backfilled later
    RAISE NOTICE 'trigger_generate_embedding_insights: http_post failed for row id=%: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- (b) document_chunks trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_generate_embedding_chunks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_text          text;
  v_service_key   text;
  v_function_url  text := 'https://gntgcxdbcbywfboejimz.supabase.co/functions/v1/generate-embedding';
  v_request_id    bigint;
BEGIN
  v_text := NEW.body;

  IF v_text IS NULL OR length(btrim(v_text)) = 0 THEN
    RAISE NOTICE 'trigger_generate_embedding_chunks: skipping row id=% (empty body)', NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret
      INTO v_service_key
      FROM vault.decrypted_secrets
     WHERE name = 'service_role_key'
     LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'trigger_generate_embedding_chunks: failed to read vault secret: %', SQLERRM;
    RETURN NEW;
  END;

  IF v_service_key IS NULL THEN
    RAISE NOTICE 'trigger_generate_embedding_chunks: service_role_key not found in vault, skipping row id=%', NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    SELECT net.http_post(
      url     := v_function_url,
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || v_service_key
                 ),
      body    := jsonb_build_object(
                   'table',     'document_chunks',
                   'id',        NEW.id,
                   'text',      v_text,
                   'task_type', 'RETRIEVAL_DOCUMENT'
                 )
    ) INTO v_request_id;

    IF v_request_id IS NULL THEN
      RAISE NOTICE 'trigger_generate_embedding_chunks: net.http_post returned NULL request id for row id=%', NEW.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'trigger_generate_embedding_chunks: http_post failed for row id=%: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- (c) Attach triggers (re-runnable)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_insights_generate_embedding ON public.insights;
CREATE TRIGGER trg_insights_generate_embedding
  AFTER INSERT OR UPDATE OF content, content_normalized
  ON public.insights
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_generate_embedding_insights();

DROP TRIGGER IF EXISTS trg_document_chunks_generate_embedding ON public.document_chunks;
CREATE TRIGGER trg_document_chunks_generate_embedding
  AFTER INSERT OR UPDATE OF body
  ON public.document_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_generate_embedding_chunks();
