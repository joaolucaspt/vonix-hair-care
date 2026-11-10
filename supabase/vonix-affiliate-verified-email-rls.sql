-- Vonix Hair Afiliadas only. This change has also been applied through
-- Supabase migration vonix_affiliate_verified_auth_email_rls_20261110.
-- A JWT e-mail alone must not authorize a private candidate record: the
-- matching Supabase Auth identity must have CURRENT verified e-mail ownership.
CREATE SCHEMA IF NOT EXISTS vonix_affiliate_private;
REVOKE ALL ON SCHEMA vonix_affiliate_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA vonix_affiliate_private TO authenticated;

CREATE OR REPLACE FUNCTION vonix_affiliate_private.confirmed_current_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT lower(u.email::text)
  FROM auth.users AS u
  WHERE u.id = (SELECT auth.uid())
    AND u.email_confirmed_at IS NOT NULL
    AND u.email IS NOT NULL
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION vonix_affiliate_private.confirmed_current_email()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION vonix_affiliate_private.confirmed_current_email()
  TO authenticated;

DROP POLICY IF EXISTS affiliate_portal_select_verified_email
  ON public.vonix_affiliate_portal_status;
CREATE POLICY affiliate_portal_select_verified_email
  ON public.vonix_affiliate_portal_status
  FOR SELECT TO authenticated
  USING (lower(email) = (SELECT vonix_affiliate_private.confirmed_current_email()));

DROP POLICY IF EXISTS affiliate_admin_own_invite
  ON public.vonix_affiliate_admin_invites;
CREATE POLICY affiliate_admin_own_invite
  ON public.vonix_affiliate_admin_invites
  FOR SELECT TO authenticated
  USING (email = (SELECT vonix_affiliate_private.confirmed_current_email()));
