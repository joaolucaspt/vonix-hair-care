-- Vonix Hair affiliates: per-recipient cooldown for OTP/magic-link mail.
-- Store only an HMAC of the normalized address; never store tokens or links.
CREATE TABLE IF NOT EXISTS public.vonix_affiliate_auth_mail_cooldown (
  fingerprint text PRIMARY KEY CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  last_requested_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vonix_affiliate_auth_mail_cooldown ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vonix_affiliate_auth_mail_cooldown FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.vonix_affiliate_auth_mail_cooldown TO service_role;

CREATE OR REPLACE FUNCTION public.vonix_affiliate_consume_auth_mail_cooldown(
  p_fingerprint text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $function$
DECLARE
  accepted boolean := false;
BEGIN
  IF p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RETURN false;
  END IF;
  WITH consumed AS (
    INSERT INTO public.vonix_affiliate_auth_mail_cooldown
      (fingerprint, last_requested_at)
    VALUES (p_fingerprint, now())
    ON CONFLICT (fingerprint)
      DO UPDATE SET last_requested_at=now()
      WHERE public.vonix_affiliate_auth_mail_cooldown.last_requested_at
        < now() - interval '120 seconds'
    RETURNING fingerprint
  )
  SELECT EXISTS(SELECT 1 FROM consumed) INTO accepted;
  RETURN accepted;
END
$function$;
REVOKE ALL ON FUNCTION public.vonix_affiliate_consume_auth_mail_cooldown(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vonix_affiliate_consume_auth_mail_cooldown(text)
  TO service_role;
