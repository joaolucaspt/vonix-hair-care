-- Vonix affiliate-only reapplication and private decision reasons. 2026-11-11.
-- Existing approved/pending applications remain unique; rejected history is preserved.
BEGIN;
ALTER TABLE public.vonix_affiliate_applications
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS status_token_hash text;
ALTER TABLE public.vonix_affiliate_portal_status
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Restrict reasons to approved, non-PII standardized categories.
DO $qa$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vonix_affiliate_rejection_reason_check'
    AND conrelid = 'public.vonix_affiliate_applications'::regclass) THEN
    ALTER TABLE public.vonix_affiliate_applications
      ADD CONSTRAINT vonix_affiliate_rejection_reason_check CHECK
      (rejection_reason IS NULL OR (
        status='recusada' AND rejection_reason IN
        ('seguidores_insuficientes','perfil_privado','conteudo_incompativel',
         'engajamento_insuficiente','dados_incompletos','outros_criterios')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vonix_affiliate_status_token_hash_check'
    AND conrelid = 'public.vonix_affiliate_applications'::regclass) THEN
    ALTER TABLE public.vonix_affiliate_applications
      ADD CONSTRAINT vonix_affiliate_status_token_hash_check CHECK
      (status_token_hash IS NULL OR status_token_hash ~ '^[a-f0-9]{64}$');
  END IF;
END $qa$;

CREATE UNIQUE INDEX IF NOT EXISTS vonix_affiliate_status_token_hash_unique
  ON public.vonix_affiliate_applications(status_token_hash)
  WHERE status_token_hash IS NOT NULL;

-- New active-only indexes are constructed BEFORE dropping old global indexes.
CREATE UNIQUE INDEX IF NOT EXISTS vonix_affiliate_instagram_active_unique
  ON public.vonix_affiliate_applications(lower(instagram_url))
  WHERE status IN ('pendente','aprovada');
CREATE UNIQUE INDEX IF NOT EXISTS vonix_affiliate_tiktok_active_unique
  ON public.vonix_affiliate_applications(lower(tiktok_url))
  WHERE tiktok_url IS NOT NULL AND status IN ('pendente','aprovada');
DROP INDEX IF EXISTS public.vonix_affiliate_instagram_unique;
DROP INDEX IF EXISTS public.vonix_affiliate_tiktok_unique;

-- Only a privileged reviewer can use this SQL function, via existing authenticated
-- owner review endpoint. Old 2-argument calls can still approve, but cannot
-- reject without a reason.
CREATE OR REPLACE FUNCTION public.vonix_affiliate_decide(
  p_id uuid, p_decision text, p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE v_changed uuid;
BEGIN
  IF p_decision NOT IN ('aprovada','recusada') THEN
    RAISE EXCEPTION 'Decisão inválida';
  END IF;
  IF (p_decision='recusada' AND
    (p_reason IS NULL OR p_reason NOT IN (
     'seguidores_insuficientes','perfil_privado','conteudo_incompativel',
     'engajamento_insuficiente','dados_incompletos','outros_criterios')))
    OR (p_decision='aprovada' AND p_reason IS NOT NULL) THEN
    RETURN false;
  END IF;
  UPDATE public.vonix_affiliate_applications
     SET status = p_decision,
         rejection_reason = CASE WHEN p_decision='recusada' THEN p_reason ELSE NULL END,
         reviewed_at = now()
   WHERE id = p_id AND status = 'pendente'
   RETURNING id INTO v_changed;
  IF v_changed IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.vonix_affiliate_applications
             WHERE id=v_changed AND email IS NOT NULL) THEN
    INSERT INTO public.vonix_affiliate_mail_outbox(application_id, decision)
    VALUES(v_changed,p_decision);
  END IF;
  RETURN true;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.vonix_affiliate_decide(
  p_id uuid, p_decision text
) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT CASE WHEN p_decision='recusada' THEN false
              ELSE public.vonix_affiliate_decide(p_id,p_decision,NULL::text) END;
$fn$;
REVOKE ALL ON FUNCTION public.vonix_affiliate_decide(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vonix_affiliate_decide(uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.vonix_affiliate_decide(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vonix_affiliate_decide(uuid,text) TO service_role;

-- The legacy verified-email candidate portal is still protected by its RLS.
CREATE OR REPLACE FUNCTION public.vonix_affiliate_sync_portal_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NEW.email IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.vonix_affiliate_portal_status
    (application_id,email,status,submitted_at,reviewed_at,updated_at,rejection_reason)
  VALUES (NEW.id,lower(NEW.email),NEW.status,NEW.created_at,NEW.reviewed_at,now(),NEW.rejection_reason)
  ON CONFLICT(application_id) DO UPDATE
    SET email=excluded.email,status=excluded.status,
        submitted_at=excluded.submitted_at,reviewed_at=excluded.reviewed_at,
        rejection_reason=excluded.rejection_reason,updated_at=now();
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.vonix_affiliate_sync_portal_status() FROM PUBLIC,anon,authenticated;
UPDATE public.vonix_affiliate_portal_status p
   SET rejection_reason=a.rejection_reason
  FROM public.vonix_affiliate_applications a
 WHERE p.application_id=a.id
   AND p.rejection_reason IS DISTINCT FROM a.rejection_reason;
-- Update the restricted admin search projection without exposing token hashes.
create or replace function public.vonix_affiliate_search(
  p_status text, p_query text, p_offset integer, p_limit integer, p_mail_status text default null
) returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_query text := trim(coalesce(p_query, ''));
  -- Escape LIKE wildcard metacharacters; user search must be literal, not a pattern.
  v_pattern text := replace(replace(replace(trim(coalesce(p_query, '')), chr(92),
    chr(92) || chr(92)), '%', chr(92) || '%'), '_', chr(92) || '_');
begin
  if p_status not in ('pendente', 'aprovada', 'recusada', 'todas')
    or (p_mail_status is not null and p_mail_status not in ('pendente', 'processando', 'enviado', 'falhou', 'incerto'))
    or length(v_query) > 70
    or p_offset is null or p_offset < 0 or p_offset > 2000000
    or p_limit is null or p_limit < 1 or p_limit > 40 then
    raise exception 'Consulta inválida';
  end if;

  return (
    with filtered as (
      select a.id, a.full_name, a.age, a.city, a.state, a.hair_type, a.email,
             a.instagram_url, a.tiktok_url, a.motivation, a.questionnaire_encrypted,
             a.status, a.rejection_reason, a.created_at, a.reviewed_at
      from public.vonix_affiliate_applications a
      where (a.status = p_status or (p_status = 'todas' and a.status <> 'pendente'))
        and (p_mail_status is null or exists (
          select 1 from public.vonix_affiliate_mail_outbox m
           where m.application_id = a.id and m.status = p_mail_status
        ))
        and (v_query = ''
          or a.full_name ilike '%' || v_pattern || '%' escape chr(92)
          or a.email ilike '%' || v_pattern || '%' escape chr(92))
    ), paged as (
      select f.*, m.status as mail_status, m.sent_at as mail_sent_at, m.id as mail_id
      from filtered f
      left join public.vonix_affiliate_mail_outbox m on m.application_id = f.id
      order by f.created_at desc, f.id desc
      limit p_limit offset p_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'applications', coalesce(
        (select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'age', p.age,
          'city', p.city,
          'state', p.state,
          'hair_type', p.hair_type,
          'email', p.email,
          'instagram_url', p.instagram_url,
          'tiktok_url', p.tiktok_url,
          'motivation', p.motivation,
          'questionnaire_encrypted', p.questionnaire_encrypted,
          'status', p.status,
          'rejection_reason', p.rejection_reason,
          'created_at', p.created_at,
          'reviewed_at', p.reviewed_at,
          'vonix_affiliate_mail_outbox',
            case when p.mail_id is null then '[]'::jsonb
              else jsonb_build_array(jsonb_build_object('status', p.mail_status, 'sent_at', p.mail_sent_at)) end
        ) order by p.created_at desc, p.id desc) from paged p),
        '[]'::jsonb
      )
    )
  );
end;
$$;


COMMIT;
