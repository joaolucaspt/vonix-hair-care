-- Vonix Hair: read-only-in-effect regression of checkout deduplication.
-- Only for a disposable PostgreSQL instance with database name vonix_synthetic.
-- All synthetic writes are rolled back, no Appmax or production dependencies.
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'vonix_synthetic' THEN
    RAISE EXCEPTION 'Refusing checkout QA outside isolated vonix_synthetic';
  END IF;
END $$;

DO $$
DECLARE
  fingerprint text := repeat('a',64);
  second_key text := repeat('b',64);
  reservation jsonb;
  duplicate jsonb;
  token uuid;
  next_token uuid;
  config text[];
  method text;
BEGIN
  -- Claiming the same purchase intent twice must never create two charges.
  reservation := public.vonix_checkout_claim(fingerprint);
  IF reservation->>'claimed' IS DISTINCT FROM 'true' OR
     reservation->>'phase' IS DISTINCT FROM 'reserved' OR
     reservation->>'orderId' IS NOT NULL THEN
    RAISE EXCEPTION 'Fresh reservation was not obtained safely: %', reservation;
  END IF;
  token := (reservation->>'claimToken')::uuid;
  IF token IS NULL THEN RAISE EXCEPTION 'Missing lease token'; END IF;
  duplicate := public.vonix_checkout_claim(fingerprint);
  IF duplicate->>'claimed' IS DISTINCT FROM 'false' OR
     duplicate->>'claimToken' IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate shopping fingerprint unexpectedly claimed';
  END IF;
  IF public.vonix_checkout_advance(fingerprint, gen_random_uuid(), 'reserved', 'creating_order', null) THEN
    RAISE EXCEPTION 'Stale/wrong token advanced the payment state';
  END IF;
  IF NOT public.vonix_checkout_advance(fingerprint,token,'reserved','creating_order',null) THEN
    RAISE EXCEPTION 'Lease owner cannot advance to creating_order';
  END IF;
  IF public.vonix_checkout_advance(fingerprint,token,'reserved','creating_order',null) THEN
    RAISE EXCEPTION 'Old payment phase advanced twice';
  END IF;
  IF NOT public.vonix_checkout_advance(fingerprint,token,'creating_order','order_created',1234) THEN
    RAISE EXCEPTION 'Order ID not recorded';
  END IF;
  duplicate := public.vonix_checkout_claim(fingerprint);
  IF duplicate->>'claimed' IS DISTINCT FROM 'false' OR
     duplicate->>'orderId' IS DISTINCT FROM '1234' THEN
    RAISE EXCEPTION 'Existing order is not reused for status-only recovery';
  END IF;
  IF NOT public.vonix_checkout_advance(fingerprint,token,'order_created','charging',null) THEN
    RAISE EXCEPTION 'Could not reserve charge phase';
  END IF;
  IF NOT public.vonix_checkout_advance(fingerprint,token,'charging','submitted',null) THEN
    RAISE EXCEPTION 'Could not submit charge phase';
  END IF;
  IF NOT public.vonix_checkout_finalize(1234,'completed') THEN
    RAISE EXCEPTION 'Paid attempt could not finalize';
  END IF;
  duplicate := public.vonix_checkout_claim(fingerprint);
  IF duplicate->>'claimed' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'Completed shopping intent was retried inside 24h';
  END IF;
  -- Verified completed intents may become a new purchase only after 24 hours.
  -- Use explicit key rather than an unqualified PL/pgSQL variable.
  UPDATE public.vonix_checkout_intents SET updated_at = now()-interval '25 hours'
    WHERE public.vonix_checkout_intents.fingerprint = repeat('a',64);
  reservation := public.vonix_checkout_claim(fingerprint);
  IF reservation->>'claimed' IS DISTINCT FROM 'true' OR
     reservation->>'orderId' IS NOT NULL OR
     (reservation->>'claimToken')::uuid = token THEN
    RAISE EXCEPTION 'Fresh paid order after 24h was not independently reserved';
  END IF;

  -- An authenticated Appmax cancellation can unlock a distinct retry.
  reservation := public.vonix_checkout_claim(second_key);
  next_token := (reservation->>'claimToken')::uuid;
  IF NOT public.vonix_checkout_advance(second_key,next_token,'reserved','creating_order',null) OR
     NOT public.vonix_checkout_advance(second_key,next_token,'creating_order','order_created',1235) OR
     NOT public.vonix_checkout_finalize(1235,'cancelled') THEN
    RAISE EXCEPTION 'Cancellation setup failed';
  END IF;
  duplicate := public.vonix_checkout_claim(second_key);
  IF duplicate->>'claimed' IS DISTINCT FROM 'true' OR
     duplicate->>'orderId' IS NOT NULL OR
     (duplicate->>'claimToken')::uuid = next_token THEN
    RAISE EXCEPTION 'Genuine cancelled purchase did not issue a new lease';
  END IF;
  IF has_table_privilege('anon','public.vonix_checkout_intents','SELECT') OR
     has_table_privilege('authenticated','public.vonix_checkout_intents','SELECT') OR
     has_function_privilege('anon','public.vonix_checkout_claim(text)','EXECUTE') OR
     has_function_privilege('authenticated','public.vonix_checkout_finalize(bigint,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Public roles can access payment state';
  END IF;
  FOREACH method IN ARRAY ARRAY['vonix_checkout_claim','vonix_checkout_advance','vonix_checkout_finalize']
  LOOP
    SELECT proconfig INTO config FROM pg_catalog.pg_proc
     WHERE proname=method AND pronamespace='public'::regnamespace;
    IF config IS NULL OR NOT ('search_path=' = ANY(config) OR 'search_path=""' = ANY(config)) THEN
      RAISE EXCEPTION 'Unsafe search path for privileged function %: %', method, config;
    END IF;
  END LOOP;
  RAISE NOTICE 'PASS: reserved/duplicate/fenced transitions/paid retry/cancel retry/grants/search_path';
END $$;
ROLLBACK;
