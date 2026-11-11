-- Vonix Haircare Showcase: affiliate applicant portal trigger hotfix (2026-11-11).
-- New applicant form does not collect email. Historical verified-email portal is
-- only for applicants whose email exists. Keep portal email NOT NULL and RLS intact.
-- Safe to apply repeatedly and independently of the e-commerce database.
CREATE OR REPLACE FUNCTION public.vonix_affiliate_sync_portal_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Email-less candidates are managed by the owner moderation console, not
  -- by the historical email-verified applicant portal.
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.vonix_affiliate_portal_status
    (application_id,email,status,submitted_at,reviewed_at,updated_at)
  VALUES (NEW.id, lower(NEW.email), NEW.status, NEW.created_at, NEW.reviewed_at, now())
  ON CONFLICT (application_id) DO UPDATE
  SET email=excluded.email, status=excluded.status,
    submitted_at=excluded.submitted_at, reviewed_at=excluded.reviewed_at,
    updated_at=now();
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.vonix_affiliate_sync_portal_status()
  FROM PUBLIC, anon, authenticated;
