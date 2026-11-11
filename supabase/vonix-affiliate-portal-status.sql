-- Dedicated Vonix Hair Afiliadas database only. Never apply to the store DB.
-- Idempotent schema counterpart to the Supabase migration applied on 2026-11-10.
-- Sensitive application payloads remain inside encrypted server-only storage.
-- This projection contains only email, dates and review state.
CREATE TABLE IF NOT EXISTS public.vonix_affiliate_portal_status (
  application_id uuid PRIMARY KEY REFERENCES public.vonix_affiliate_applications(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL CHECK(status IN ('pendente','aprovada','recusada')),
  submitted_at timestamptz NOT NULL,
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vonix_affiliate_portal_status_email_idx
  ON public.vonix_affiliate_portal_status(lower(email));
ALTER TABLE public.vonix_affiliate_portal_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vonix_affiliate_portal_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vonix_affiliate_portal_status TO authenticated;
DROP POLICY IF EXISTS affiliate_portal_select_verified_email
  ON public.vonix_affiliate_portal_status;
CREATE POLICY affiliate_portal_select_verified_email
  ON public.vonix_affiliate_portal_status FOR SELECT TO authenticated
  USING (
    lower(email) = lower(coalesce((SELECT auth.jwt() ->> 'email'), ''))
    AND (SELECT auth.uid()) IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.vonix_affiliate_sync_portal_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Phone-only applications do not have an email-verified portal identity.
  IF NEW.email IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.vonix_affiliate_portal_status
    (application_id,email,status,submitted_at,reviewed_at,updated_at)
  VALUES (NEW.id, lower(NEW.email), NEW.status, NEW.created_at, NEW.reviewed_at, now())
  ON CONFLICT (application_id) DO UPDATE
  SET email=excluded.email, status=excluded.status,
    submitted_at=excluded.submitted_at, reviewed_at=excluded.reviewed_at,
    updated_at=now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.vonix_affiliate_sync_portal_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS vonix_affiliate_portal_sync ON public.vonix_affiliate_applications;
CREATE TRIGGER vonix_affiliate_portal_sync
  AFTER INSERT OR UPDATE OF email,status,reviewed_at ON public.vonix_affiliate_applications
  FOR EACH ROW EXECUTE FUNCTION public.vonix_affiliate_sync_portal_status();

INSERT INTO public.vonix_affiliate_portal_status
  (application_id,email,status,submitted_at,reviewed_at)
SELECT id,lower(email),status,created_at,reviewed_at
FROM public.vonix_affiliate_applications
WHERE email IS NOT NULL
ON CONFLICT (application_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.vonix_affiliate_admin_invites (
  email text PRIMARY KEY CHECK(email=lower(email)),
  role text NOT NULL DEFAULT 'reviewer' CHECK(role IN ('reviewer','owner')),
  password_set_at timestamptz,
  invited_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vonix_affiliate_admin_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vonix_affiliate_admin_invites FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vonix_affiliate_admin_invites TO authenticated;
DROP POLICY IF EXISTS affiliate_admin_own_invite ON public.vonix_affiliate_admin_invites;
CREATE POLICY affiliate_admin_own_invite ON public.vonix_affiliate_admin_invites
  FOR SELECT TO authenticated
  USING(
    email=lower(coalesce((SELECT auth.jwt()->>'email'),'')) AND
    (SELECT auth.uid()) IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.vonix_affiliate_activate_admin_account()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_email text;
BEGIN
  SELECT lower(email) INTO current_email
  FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL
    AND encrypted_password IS NOT NULL AND length(encrypted_password)>0;
  IF current_email IS NULL THEN RETURN false; END IF;
  UPDATE public.vonix_affiliate_admin_invites
    SET password_set_at=now()
    WHERE email=current_email AND password_set_at IS NULL;
  RETURN EXISTS (
    SELECT 1 FROM public.vonix_affiliate_admin_invites
    WHERE email=current_email AND password_set_at IS NOT NULL
  );
END $$;
REVOKE ALL ON FUNCTION public.vonix_affiliate_activate_admin_account()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vonix_affiliate_activate_admin_account()
  TO authenticated;

-- Admin emails are installed separately through authorized governance intake.
-- Never add personal admin e-mail addresses to publicly readable repo source.
