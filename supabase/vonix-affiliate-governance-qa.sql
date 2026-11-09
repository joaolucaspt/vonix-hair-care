-- Disposable PostgreSQL fixture ONLY. Never execute this test in production.
begin;
set local role service_role;

do $qa$
declare
  a uuid;
  b uuid;
  ok boolean;
  n integer;
  preview jsonb;
  status_before text;
begin
  insert into public.vonix_affiliate_applications(
    full_name, age, city, state, hair_type, email, instagram_url,
    questionnaire_encrypted, consent_at
  ) values (
    'Exemplo Exclusão Sintética', 28, 'Belo Horizonte', 'MG', 'Cacheado',
    'erase-qa@example.invalid', 'https://instagram.com/eraseqa',
    'v2.synthetic-not-valid-ciphertext', now()
  ) returning id into a;

  if public.vonix_affiliate_erase(a, 'wrong@example.invalid', 'solicitacao_titular') then
    raise exception 'Incorrect confirmation accepted';
  end if;
  if public.vonix_affiliate_erase(a, 'erase-qa@example.invalid', 'invalid') then
    raise exception 'Unapproved deletion reason accepted';
  end if;
  if public.vonix_affiliate_erase('00000000-0000-4000-8000-000000000001',
                                'erase-qa@example.invalid','solicitacao_titular') then
    raise exception 'Unknown applicant erroneously erased';
  end if;

  select public.vonix_affiliate_decide(a, 'aprovada') into ok;
  if not ok then raise exception 'Decision failed'; end if;
  select count(*) into n from public.vonix_affiliate_audit_events
    where application_id = a and event_type = 'aprovada';
  if n <> 1 then raise exception 'Decision audit was not created'; end if;

  if not public.vonix_affiliate_erase(a, 'ERASE-QA@EXAMPLE.INVALID', 'solicitacao_titular') then
    raise exception 'Verified erasure failed';
  end if;
  if exists(select 1 from public.vonix_affiliate_applications where id=a)
    or exists(select 1 from public.vonix_affiliate_mail_outbox where application_id=a) then
    raise exception 'Private applicant or queued message survived erasure';
  end if;
  select count(*) into n from public.vonix_affiliate_audit_events
    where application_id is null and event_type='exclusao'
      and reason_category='solicitacao_titular';
  if n <> 1 then raise exception 'Anonymized audit event missing after erasure'; end if;

  insert into public.vonix_affiliate_applications(
    full_name, age, city, state, hair_type, email, instagram_url,
    consent_at
  ) values (
    'Exemplo Envio Sintético', 30, 'Belo Horizonte', 'MG', 'Ondulado',
    'sending-qa@example.invalid', 'https://instagram.com/sendingqa', now()
  ) returning id into b;
  select public.vonix_affiliate_decide(b, 'recusada') into ok;
  if not ok then raise exception 'Second decision failed'; end if;
  perform public.vonix_affiliate_claim_mail(b);
  if public.vonix_affiliate_erase(b, 'sending-qa@example.invalid','correcao') then
    raise exception 'In-flight email was deleted';
  end if;
  select status into status_before
    from public.vonix_affiliate_mail_outbox where application_id=b;
  if status_before <> 'processando' then
    raise exception 'In-flight message was unexpectedly changed';
  end if;
  -- The processing worker is finished (synthetic failure), so erasure may proceed.
  update public.vonix_affiliate_mail_outbox set status='falhou'
   where application_id=b;
  if not public.vonix_affiliate_erase(b,'sending-qa@example.invalid','correcao') then
    raise exception 'Erasure after processing stopped failed';
  end if;

  preview := public.vonix_affiliate_retention_preview(90,180);
  if preview->>'executed_deletions' <> '0'
     or (preview->>'pending_eligible')::integer < 0
     or (preview->>'rejected_eligible')::integer < 0 then
    raise exception 'Retention preview has invalid results';
  end if;
  begin
    perform public.vonix_affiliate_retention_preview(0,180);
    raise exception 'Missing retention lower bound';
  exception when raise_exception then
    if SQLERRM = 'Missing retention lower bound' then raise; end if;
  end;
  raise notice 'GOVERNANCE QA PASS: decision audit, verified erasure, in-flight block, preview';
end;
$qa$;

reset role;
do $roles$
begin
  if not exists (
    select 1 from pg_indexes where schemaname='public'
      and indexname='vonix_affiliate_audit_events_application_id_idx'
  ) then
    raise exception 'Audit foreign-key index was not created';
  end if;
  if has_table_privilege('anon','public.vonix_affiliate_audit_events','SELECT')
     or has_table_privilege('authenticated','public.vonix_affiliate_audit_events','INSERT')
     or has_function_privilege('anon','public.vonix_affiliate_erase(uuid,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.vonix_affiliate_retention_preview(integer,integer)','EXECUTE') then
    raise exception 'Public/private permissions violated';
  end if;
  raise notice 'GOVERNANCE QA PASS: RLS and restricted RPC grants';
end;
$roles$;
rollback;
