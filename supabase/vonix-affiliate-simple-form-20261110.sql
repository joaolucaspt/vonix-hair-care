-- Vonix Haircare Showcase, affiliate applications ONLY.
-- Additive-compatible migration for the new short form.
-- Historic applications remain unchanged. No artificial age/e-mail values.
BEGIN;

ALTER TABLE public.vonix_affiliate_applications
  ALTER COLUMN age DROP NOT NULL,
  ALTER COLUMN hair_type DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL;

COMMENT ON COLUMN public.vonix_affiliate_applications.questionnaire_encrypted IS
  'Encrypted applicant private data. v2: historical full wizard; v3: short contact, full address and social follower counts.';

-- If an applicant did not provide an e-mail, a moderator can still decide
-- but we must not schedule a message with a NULL recipient.
CREATE OR REPLACE FUNCTION public.vonix_affiliate_decide(p_id uuid, p_decision text)
RETURNS boolean LANGUAGE plpgsql SET search_path = ''
AS $function$
DECLARE v_changed uuid;
BEGIN
  IF p_decision NOT IN ('aprovada', 'recusada') THEN
    RAISE EXCEPTION 'Decisão inválida';
  END IF;
  UPDATE public.vonix_affiliate_applications
     SET status = p_decision, reviewed_at = now()
   WHERE id = p_id AND status = 'pendente'
   RETURNING id INTO v_changed;
  IF v_changed IS NULL THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM public.vonix_affiliate_applications a
    WHERE a.id = v_changed AND a.email IS NOT NULL
  ) THEN
    INSERT INTO public.vonix_affiliate_mail_outbox(application_id, decision)
    VALUES (v_changed, p_decision);
  END IF;
  RETURN true;
END;
$function$;

-- Existing moderator-only delete action continues to require exact e-mail
-- confirmation for old records; new records without e-mail require exact
-- full-name confirmation instead. The server enforces admin role + same-origin.
CREATE OR REPLACE FUNCTION public.vonix_affiliate_erase(
  p_id uuid, p_confirmation_email text, p_reason text
)
RETURNS boolean LANGUAGE plpgsql SET search_path = ''
AS $function$
DECLARE v_record record;
DECLARE v_mail_status text;
BEGIN
  IF p_id IS NULL OR p_confirmation_email IS NULL
    OR p_reason NOT IN ('solicitacao_titular','retencao','correcao')
    OR length(p_confirmation_email) > 180 THEN
    RETURN false;
  END IF;
  SELECT id, email, full_name INTO v_record
    FROM public.vonix_affiliate_applications
    WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR
    (
      v_record.email IS NOT NULL
      AND v_record.email <> lower(trim(p_confirmation_email))
    ) OR
    (
      v_record.email IS NULL
      AND lower(trim(v_record.full_name)) <> lower(trim(p_confirmation_email))
    )
  THEN RETURN false; END IF;
  SELECT status INTO v_mail_status
    FROM public.vonix_affiliate_mail_outbox
    WHERE application_id = p_id FOR UPDATE;
  IF v_mail_status = 'processando' THEN RETURN false; END IF;
  INSERT INTO public.vonix_affiliate_audit_events
    (application_id, event_type, reason_category)
  VALUES (p_id, 'exclusao', p_reason);
  DELETE FROM public.vonix_affiliate_applications WHERE id = p_id;
  RETURN true;
END;
$function$;

COMMIT;
