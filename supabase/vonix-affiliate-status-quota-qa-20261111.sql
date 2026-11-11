-- PostgreSQL-only, disposable regression for separate status-vs-submit quotas.
DO $qa$
DECLARE
  v_submit text := repeat('c',64);
  v_status text := repeat('d',64);
  v_admin text := repeat('e',64);
  v_i integer;
BEGIN
  IF NOT has_function_privilege('service_role',
       'public.vonix_affiliate_consume_rate_limit(text,text)','EXECUTE')
     OR has_function_privilege('anon',
       'public.vonix_affiliate_consume_rate_limit(text,text)','EXECUTE')
     OR has_function_privilege('authenticated',
       'public.vonix_affiliate_consume_rate_limit(text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'rate limiter privilege regression';
  END IF;

  FOR v_i IN 1..8 LOOP
    IF NOT public.vonix_affiliate_consume_rate_limit('submit',v_submit) THEN
      RAISE EXCEPTION 'legitimate submit % should be permitted',v_i;
    END IF;
  END LOOP;
  IF public.vonix_affiliate_consume_rate_limit('submit',v_submit) THEN
    RAISE EXCEPTION 'ninth submit should be blocked';
  END IF;
  FOR v_i IN 1..60 LOOP
    IF NOT public.vonix_affiliate_consume_rate_limit('status',v_status) THEN
      RAISE EXCEPTION 'status lookup % should be permitted',v_i;
    END IF;
  END LOOP;
  IF public.vonix_affiliate_consume_rate_limit('status',v_status) THEN
    RAISE EXCEPTION 'sixty-first status lookup must be blocked';
  END IF;
  IF public.vonix_affiliate_rate_limit_allowed('status',v_status) THEN
    RAISE EXCEPTION 'exhausted status quota should show unavailable';
  END IF;
  IF NOT public.vonix_affiliate_rate_limit_allowed('submit',repeat('f',64)) THEN
    RAISE EXCEPTION 'status lookups must not close new candidate signup';
  END IF;
  FOR v_i IN 1..12 LOOP
    IF NOT public.vonix_affiliate_consume_rate_limit('admin',v_admin) THEN
      RAISE EXCEPTION 'admin quota regression';
    END IF;
  END LOOP;
  IF public.vonix_affiliate_consume_rate_limit('admin',v_admin) THEN
    RAISE EXCEPTION '13th admin attempt must be blocked';
  END IF;
  IF public.vonix_affiliate_consume_rate_limit('not-allowed',repeat('a',64)) OR
     public.vonix_affiliate_consume_rate_limit('status','malformed') OR
     public.vonix_affiliate_rate_limit_allowed('status','malformed') THEN
    RAISE EXCEPTION 'invalid abuse inputs accepted';
  END IF;
  IF (SELECT COUNT(*) FROM public.vonix_affiliate_throttles WHERE scope='status')<>1 THEN
    RAISE EXCEPTION 'status writes other scope rows or fails to record scope';
  END IF;
END $qa$;
