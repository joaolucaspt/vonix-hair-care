-- QA ONLY. Uses entirely synthetic e-mails and UUIDs in disposable Postgres.
-- Assert unverified and stale JWT claims NEVER reveal private application status.
INSERT INTO auth.users (id,email,email_confirmed_at,encrypted_password)
VALUES
 ('11111111-1111-4111-8111-111111111111','verified@example.invalid',now(),'test-hash-placeholder'),
 ('22222222-2222-4222-8222-222222222222','unverified@example.invalid',NULL,'test-hash-placeholder');

INSERT INTO public.vonix_affiliate_applications
(full_name,age,city,state,hair_type,email,instagram_url,consent_at)
VALUES
 ('Synthetic Verified',25,'Cidade Teste','MG','Ondulado','verified@example.invalid','https://instagram.com/verified-synthetic-vonix',now()),
 ('Synthetic Unverified',25,'Cidade Teste','MG','Ondulado','unverified@example.invalid','https://instagram.com/unverified-synthetic-vonix',now());

INSERT INTO public.vonix_affiliate_admin_invites (email,role)
VALUES ('verified@example.invalid','reviewer'), ('unverified@example.invalid','reviewer');

DO $qa$
BEGIN
 IF (SELECT count(*) FROM public.vonix_affiliate_portal_status) <> 2 THEN
   RAISE EXCEPTION 'Synchronous portal status trigger failed';
 END IF;
 IF has_table_privilege('anon','public.vonix_affiliate_portal_status','SELECT')
 OR has_table_privilege('anon','public.vonix_affiliate_admin_invites','SELECT')
 OR has_table_privilege('authenticated','auth.users','SELECT') THEN
   RAISE EXCEPTION 'Forbidden direct Auth/portal table grant';
 END IF;
END $qa$;

SET ROLE authenticated;

-- A JWT with a matching email but NO existing Auth identity has zero access.
SET request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
SET request.jwt.claims = '{"email":"verified@example.invalid","role":"authenticated"}';
DO $qa$
BEGIN
 IF (SELECT count(*) FROM public.vonix_affiliate_portal_status) <> 0
 OR (SELECT count(*) FROM public.vonix_affiliate_admin_invites) <> 0 THEN
  RAISE EXCEPTION 'Forged identity can access applicant or reviewer';
 END IF;
END $qa$;

-- A real Auth user with an UNCONFIRMED email is still not authorized.
SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
SET request.jwt.claims = '{"email":"unverified@example.invalid","role":"authenticated"}';
DO $qa$
BEGIN
 IF (SELECT count(*) FROM public.vonix_affiliate_portal_status) <> 0
 OR (SELECT count(*) FROM public.vonix_affiliate_admin_invites) <> 0
 OR (SELECT vonix_affiliate_private.confirmed_current_email()) IS NOT NULL THEN
  RAISE EXCEPTION 'Unverified email can access applicant or reviewer';
 END IF;
END $qa$;

-- A verified Auth user sees precisely its own candidate and invitation.
SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
SET request.jwt.claims = '{"email":"verified@example.invalid","role":"authenticated"}';
DO $qa$
BEGIN
 IF (SELECT count(*) FROM public.vonix_affiliate_portal_status) <> 1
 OR (SELECT count(*) FROM public.vonix_affiliate_admin_invites) <> 1
 OR (SELECT count(*) FROM public.vonix_affiliate_portal_status
       WHERE email='unverified@example.invalid') <> 0 THEN
  RAISE EXCEPTION 'Verified own-email RLS did not isolate rows';
 END IF;
END $qa$;

-- Changing JWT email claim cannot switch a user's row authorization.
SET request.jwt.claims = '{"email":"unverified@example.invalid","role":"authenticated"}';
DO $qa$
BEGIN
 IF (SELECT count(*) FROM public.vonix_affiliate_portal_status
       WHERE email='verified@example.invalid') <> 1
 OR (SELECT count(*) FROM public.vonix_affiliate_portal_status
       WHERE email='unverified@example.invalid') <> 0 THEN
  RAISE EXCEPTION 'Untrusted JWT email claim changed authorization';
 END IF;
END $qa$;
RESET ROLE;
RESET request.jwt.claim.sub;
RESET request.jwt.claims;
