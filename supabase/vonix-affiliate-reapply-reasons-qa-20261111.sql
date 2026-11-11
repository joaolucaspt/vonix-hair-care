-- Disposable PostgreSQL regression: rejection reasons + reapplication flow.
-- Never execute this QA file on production because it inserts synthetic rows.
DO $qa$
DECLARE
  v_old uuid;
  v_new uuid;
  v_existing_legacy integer;
  v_active_conflict boolean := false;
  v_json jsonb;
BEGIN
  SELECT count(*) INTO v_existing_legacy FROM public.vonix_affiliate_portal_status;
  INSERT INTO public.vonix_affiliate_applications
    (full_name,city,state,instagram_url,tiktok_url,questionnaire_encrypted,
     consent_at,status_token_hash)
  VALUES
    ('Vonix Synthetic First', 'Belo Horizonte', 'MG',
     'https://instagram.com/vonix_qa_regrowth_20261111',NULL,
     'v3.fake-ciphertext',now(),repeat('a',64))
  RETURNING id INTO v_old;
  IF NOT public.vonix_affiliate_decide(v_old,'recusada','seguidores_insuficientes')
  THEN RAISE EXCEPTION 'Reasoned rejection failed'; END IF;
  IF (SELECT rejection_reason FROM public.vonix_affiliate_applications
      WHERE id=v_old) IS DISTINCT FROM 'seguidores_insuficientes'
  THEN RAISE EXCEPTION 'Reason was not persisted'; END IF;

  -- Same Instagram can reapply after rejection; historical rejection remains.
  INSERT INTO public.vonix_affiliate_applications
    (full_name,city,state,instagram_url,tiktok_url,questionnaire_encrypted,
     consent_at,status_token_hash)
  VALUES
    ('Vonix Synthetic Again','Belo Horizonte','MG',
     'https://instagram.com/vonix_qa_regrowth_20261111',NULL,
     'v3.fake-ciphertext',now(),repeat('b',64))
  RETURNING id INTO v_new;
  IF v_new=v_old OR
     (SELECT count(*) FROM public.vonix_affiliate_applications
      WHERE instagram_url='https://instagram.com/vonix_qa_regrowth_20261111') <> 2
  THEN RAISE EXCEPTION 'Reapplication was not independently persisted'; END IF;

  -- No two active applications may exist for the same Instagram.
  BEGIN
    INSERT INTO public.vonix_affiliate_applications
      (full_name,city,state,instagram_url,consent_at)
    VALUES
      ('Vonix Synthetic Duplicate','Belo Horizonte','MG',
       'https://instagram.com/vonix_qa_regrowth_20261111',now());
  EXCEPTION WHEN unique_violation THEN
    v_active_conflict := true;
  END;
  IF NOT v_active_conflict THEN RAISE EXCEPTION 'Duplicate active Instagram allowed'; END IF;

  -- Historical two-argument RPC must NOT reject without a stated reason.
  IF public.vonix_affiliate_decide(v_new,'recusada')
  THEN RAISE EXCEPTION 'Unreasoned legacy rejection succeeded'; END IF;
  IF NOT public.vonix_affiliate_decide(v_new,'aprovada',NULL::text)
  THEN RAISE EXCEPTION 'Approval regressed'; END IF;
  IF (SELECT status FROM public.vonix_affiliate_applications WHERE id=v_new) <> 'aprovada'
  THEN RAISE EXCEPTION 'Approved state missing'; END IF;
  IF (SELECT count(*) FROM public.vonix_affiliate_portal_status) <> v_existing_legacy
  THEN RAISE EXCEPTION 'Phone-only candidate created email portal data'; END IF;

  v_json := public.vonix_affiliate_search('recusada','Vonix Synthetic',0,40,NULL);
  IF NOT (v_json::text LIKE '%seguidores_insuficientes%')
  THEN RAISE EXCEPTION 'Admin list did not include standardized reason'; END IF;
  IF v_json::text LIKE '%status_token_hash%'
  THEN RAISE EXCEPTION 'Admin list leaked private status hash'; END IF;

  IF has_function_privilege('anon','public.vonix_affiliate_decide(uuid,text,text)','EXECUTE')
    OR has_table_privilege('anon','public.vonix_affiliate_applications','SELECT')
  THEN RAISE EXCEPTION 'Public moderation or private candidate data access'; END IF;
END $qa$;
