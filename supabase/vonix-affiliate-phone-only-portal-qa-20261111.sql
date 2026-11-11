-- Isolated Postgres CI QA ONLY: never run against production or persistent data.
-- Mirrors the short form: no e-mail, no TikTok, no age or hair type.
INSERT INTO public.vonix_affiliate_applications
 (full_name, city, state, instagram_url, tiktok_url, questionnaire_encrypted, consent_at)
VALUES
 ('Vonix Synthetic Phone Only', 'Belo Horizonte', 'MG',
  'https://instagram.com/vonix_qa_phone_only_20261111', NULL, 'v3.qa.synthetic', now());

DO $qa$
DECLARE v_id uuid;
BEGIN
 SELECT id INTO v_id FROM public.vonix_affiliate_applications
 WHERE instagram_url='https://instagram.com/vonix_qa_phone_only_20261111';
 IF v_id IS NULL THEN RAISE EXCEPTION 'phone-only insert did not persist'; END IF;
 IF EXISTS(SELECT 1 FROM public.vonix_affiliate_portal_status WHERE application_id=v_id)
 THEN RAISE EXCEPTION 'phone-only application incorrectly got email portal status'; END IF;

 -- Owner triage must still work without a portal row for this application.
 UPDATE public.vonix_affiliate_applications
 SET status='aprovada', reviewed_at=now() WHERE id=v_id;
 IF NOT EXISTS(SELECT 1 FROM public.vonix_affiliate_applications
               WHERE id=v_id AND status='aprovada' AND reviewed_at IS NOT NULL)
 THEN RAISE EXCEPTION 'phone-only moderator decision failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.vonix_affiliate_portal_status WHERE application_id=v_id)
 THEN RAISE EXCEPTION 'phone-only review incorrectly got email portal status'; END IF;

 -- The two historic verified-email portal rows still exist after the hotfix.
 IF (SELECT count(*) FROM public.vonix_affiliate_portal_status) <> 2
 THEN RAISE EXCEPTION 'legacy verified-email portal rows lost'; END IF;
 IF EXISTS(SELECT 1 FROM public.vonix_affiliate_portal_status WHERE email IS NULL)
 THEN RAISE EXCEPTION 'email-less portal row detected'; END IF;
 IF has_table_privilege('anon','public.vonix_affiliate_applications','SELECT')
 OR has_table_privilege('anon','public.vonix_affiliate_portal_status','SELECT')
 THEN RAISE EXCEPTION 'public applicant data read privilege widened'; END IF;
END $qa$;
