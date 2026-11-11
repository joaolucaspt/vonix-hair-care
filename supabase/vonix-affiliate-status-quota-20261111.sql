-- Vonix affiliate-only: keep private status lookup budget separate from signup.
-- Existing submit (8/15m) and admin (12/15m) limits are unchanged.
-- This migration is idempotent and does not alter historical applications.
BEGIN;
ALTER TABLE public.vonix_affiliate_throttles
  DROP CONSTRAINT IF EXISTS vonix_affiliate_throttles_scope_check;
ALTER TABLE public.vonix_affiliate_throttles
  ADD CONSTRAINT vonix_affiliate_throttles_scope_check
  CHECK (scope IN ('submit','admin','status'));

CREATE OR REPLACE FUNCTION public.vonix_affiliate_consume_rate_limit(
  p_scope text, p_fingerprint text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  v_bucket timestamptz := date_bin('15 minutes', now(), '2000-01-01 00:00:00+00'::timestamptz);
  v_hits integer;
BEGIN
  IF p_scope NOT IN ('submit','admin','status') OR p_fingerprint !~ '^[a-f0-9]{64}$'
  THEN RETURN false; END IF;
  INSERT INTO public.vonix_affiliate_throttles(scope,fingerprint,bucket_start,hits)
  VALUES(p_scope,p_fingerprint,v_bucket,1)
  ON CONFLICT(scope,fingerprint,bucket_start) DO UPDATE
    SET hits = public.vonix_affiliate_throttles.hits+1
  RETURNING hits INTO v_hits;
  RETURN v_hits <= CASE p_scope
    WHEN 'submit' THEN 8 WHEN 'admin' THEN 12 ELSE 60 END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.vonix_affiliate_rate_limit_allowed(
  p_scope text, p_fingerprint text
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $function$
  SELECT CASE
    WHEN p_scope NOT IN ('submit','admin','status') OR p_fingerprint !~ '^[a-f0-9]{64}$'
      THEN false
    ELSE coalesce((
      SELECT hits < CASE p_scope
        WHEN 'submit' THEN 8 WHEN 'admin' THEN 12 ELSE 60 END
      FROM public.vonix_affiliate_throttles
      WHERE scope=p_scope AND fingerprint=p_fingerprint
        AND bucket_start=date_bin('15 minutes',now(),
            '2000-01-01 00:00:00+00'::timestamptz)
    ),true)
  END;
$function$;
REVOKE ALL ON FUNCTION public.vonix_affiliate_consume_rate_limit(text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vonix_affiliate_rate_limit_allowed(text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vonix_affiliate_consume_rate_limit(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vonix_affiliate_rate_limit_allowed(text,text) TO service_role;
COMMIT;
