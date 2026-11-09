-- Synthetic-only regression. Never execute against a real customer database.
-- The exact database guard prevents accidental writes to staging/production.
BEGIN;
DO $$
BEGIN
  IF current_database() <> 'vonix_synthetic' THEN
    RAISE EXCEPTION 'QA refused: this is not the disposable synthetic database';
  END IF;
END $$;

INSERT INTO public.vonix_order_snapshots (order_id,payload)
VALUES
  (1001,'{"orderId":1001}'::jsonb),
  (1002,'{"orderId":1002,"marketingConsent":{"accepted":false,"policyVersion":"v1","recordedAt":"2026-11-09T15:00:00.000Z"}}'::jsonb),
  (1003,'{"orderId":1003,"marketingConsent":{"accepted":true,"policyVersion":"v1","recordedAt":"2026-11-09T15:00:00.000Z"}}'::jsonb),
  (1004,'{"orderId":1004,"marketingConsent":{"accepted":true,"policyVersion":"v0","recordedAt":"2026-11-09T15:00:00.000Z"}}'::jsonb);
INSERT INTO public.vonix_order_outbox (order_id,created_at)
VALUES (1001,now()-interval '5 minutes'),(1002,now()-interval '5 minutes'),(1003,now()-interval '5 minutes'),(1004,now()-interval '5 minutes');

DO $$
DECLARE ids integer[];
DECLARE claimed jsonb;
BEGIN
  SELECT array_agg(order_id::integer ORDER BY order_id) INTO ids
    FROM public.vonix_meta_recovery_candidates(5);
  IF ids IS DISTINCT FROM ARRAY[1003]::integer[] THEN
    RAISE EXCEPTION 'Consent recovery candidates incorrect: %, expected 1003 only', ids;
  END IF;
  IF (SELECT count(*) FROM public.vonix_meta_purchase_delivery) <> 1 THEN
    RAISE EXCEPTION 'Non-consenting orders must not get a CAPI delivery record';
  END IF;
  claimed := public.vonix_claim_meta_purchase(1001);
  IF claimed->>'claimed' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'Legacy order unexpectedly claimed for marketing';
  END IF;
  claimed := public.vonix_claim_meta_purchase(1002);
  IF claimed->>'claimed' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'Refused order unexpectedly claimed for marketing';
  END IF;
  claimed := public.vonix_claim_meta_purchase(1004);
  IF claimed->>'claimed' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'Wrong policy version unexpectedly claimed for marketing';
  END IF;
  claimed := public.vonix_claim_meta_purchase(1003);
  IF claimed->>'claimed' IS DISTINCT FROM 'true' OR
     NOT (claimed ? 'claimToken') OR claimed->>'claimToken' IS NULL THEN
    RAISE EXCEPTION 'Consenting order did not receive the lease token';
  END IF;
  IF (SELECT count(*) FROM public.vonix_meta_purchase_delivery) <> 1 THEN
    RAISE EXCEPTION 'Consent protections created unexpected rows';
  END IF;
  IF has_table_privilege('anon','public.vonix_order_snapshots','SELECT') OR
     has_table_privilege('authenticated','public.vonix_meta_purchase_delivery','SELECT') OR
     has_function_privilege('anon','public.vonix_claim_meta_purchase(bigint)','EXECUTE') THEN
    RAISE EXCEPTION 'RLS/grants did not isolate customer snapshots and CAPI jobs';
  END IF;
  RAISE NOTICE 'PASS: 4 synthetic orders, only accepted v1 selected/claimed, browser roles denied';
END $$;
ROLLBACK;
