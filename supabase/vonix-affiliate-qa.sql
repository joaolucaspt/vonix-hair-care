-- ONLY FOR AN EPHEMERAL LOCAL POSTGRES TEST DATABASE.
-- DO NOT APPLY TO LOVABLE/SUPABASE PRODUCTION.
begin;
set local role service_role;

do $test$
declare
  ix integer;
  permitted boolean;
  id_approved uuid;
  id_uncertain uuid;
  notification record;
  updated boolean;
  count_rows integer;
  statuses jsonb;
begin
  for ix in 1..9 loop
    select public.vonix_affiliate_consume_rate_limit('submit', repeat('a',64)) into permitted;
    if permitted <> (ix <= 8) then
      raise exception 'Submission quota failure at attempt %', ix;
    end if;
  end loop;
  if public.vonix_affiliate_rate_limit_allowed('submit', repeat('a',64)) then
    raise exception 'Submission rate lockout not active';
  end if;
  if not public.vonix_affiliate_rate_limit_allowed('submit', repeat('b',64)) then
    raise exception 'Different applicant IP wrongly locked out';
  end if;

  for ix in 1..13 loop
    select public.vonix_affiliate_consume_rate_limit('admin', repeat('c',64)) into permitted;
    if permitted <> (ix <= 12) then raise exception 'Admin quota failure at %', ix; end if;
  end loop;
  if public.vonix_affiliate_rate_limit_allowed('admin', repeat('c',64)) then
    raise exception 'Admin lockout not active';
  end if;
  if public.vonix_affiliate_consume_rate_limit('invalid-scope',repeat('a',64)) then
    raise exception 'Invalid rate limit scope was accepted';
  end if;
  if public.vonix_affiliate_consume_rate_limit('submit','short') then
    raise exception 'Invalid fingerprint was accepted';
  end if;

  insert into public.vonix_affiliate_applications (
    full_name, age, city, state, hair_type, email, instagram_url, tiktok_url,
    motivation, consent_at
  ) values (
    'Teste Vonix Aprovação', 28, 'Belo Horizonte', 'MG', 'Cacheado',
    'aprovada-qa@example.invalid', 'https://instagram.com/approvedqa',
    'https://tiktok.com/@approvedqa',
    'Esta é uma candidatura sintética para testar o processamento de seleção.', now()
  ) returning id into id_approved;

  select public.vonix_affiliate_decide(id_approved, 'aprovada') into updated;
  if not updated then raise exception 'First approval should succeed'; end if;
  select public.vonix_affiliate_decide(id_approved, 'recusada') into updated;
  if updated then raise exception 'Second decision must be rejected'; end if;
  select count(*) into count_rows
    from public.vonix_affiliate_mail_outbox where application_id = id_approved;
  if count_rows <> 1 then raise exception 'Outbox must contain exactly one email'; end if;

  select * into notification from public.vonix_affiliate_claim_mail(id_approved);
  if notification.mail_id is null or notification.recipient <> 'aprovada-qa@example.invalid'
     or notification.decision <> 'aprovada' or notification.attempt <> 1 then
    raise exception 'Claim did not produce the intended email';
  end if;
  select public.vonix_affiliate_finish_mail(notification.mail_id, 1, true, 'resend-qa', false, false) into updated;
  if not updated then raise exception 'Successful send not recorded'; end if;
  if (select status from public.vonix_affiliate_mail_outbox where application_id=id_approved) <> 'enviado' then
    raise exception 'Outbox not marked sent';
  end if;
  select public.vonix_affiliate_finish_mail(notification.mail_id, 1, true, 'resend-qa', false, false) into updated;
  if updated then raise exception 'Finishing twice must fail'; end if;
  if exists (select 1 from public.vonix_affiliate_claim_mail(id_approved)) then
    raise exception 'Sent email reclaimed';
  end if;

  insert into public.vonix_affiliate_applications (
    full_name, age, city, state, hair_type, email, instagram_url, tiktok_url,
    motivation, consent_at
  ) values (
    'Teste Vonix Incerto', 28, 'Belo Horizonte', 'MG', 'Cacheado',
    'incerta-qa@example.invalid', 'https://instagram.com/uncertainqa',
    'https://tiktok.com/@uncertainqa',
    'Esta é outra candidatura sintética para verificar tratamento de timeout.', now()
  ) returning id into id_uncertain;

  select public.vonix_affiliate_decide(id_uncertain, 'recusada') into updated;
  if not updated then raise exception 'Rejection should succeed'; end if;
  select * into notification from public.vonix_affiliate_claim_mail(id_uncertain);
  if notification.decision <> 'recusada' then raise exception 'Wrong rejection email'; end if;
  select public.vonix_affiliate_finish_mail(notification.mail_id, 1, false, null, true, true) into updated;
  if not updated then raise exception 'Failed uncertain status not persisted'; end if;
  if (select status from public.vonix_affiliate_mail_outbox where application_id=id_uncertain) <> 'incerto' then
    raise exception 'Ambiguous provider response must not be reported as failure or sent';
  end if;
  if exists (select 1 from public.vonix_affiliate_claim_mail(id_uncertain)) then
    raise exception 'Uncertain email automatically requeued';
  end if;
  if (public.vonix_affiliate_search('aprovada', 'aprovada-qa@example.invalid', 0, 40)->>'total')::integer <> 1 then
    raise exception 'Complete email search failed';
  end if;
  if jsonb_array_length(public.vonix_affiliate_search('recusada', 'Incerto', 0, 40)->'applications') <> 1 then
    raise exception 'Name search failed';
  end if;
  if (public.vonix_affiliate_search('aprovada', 'missing@example.invalid', 0, 40)->>'total')::integer <> 0 then
    raise exception 'Search returned unrelated candidate';
  end if;
  if (public.vonix_affiliate_search('aprovada', '%', 0, 40)->>'total')::integer <> 0
     or (public.vonix_affiliate_search('aprovada', '_', 0, 40)->>'total')::integer <> 0
     or (public.vonix_affiliate_search('aprovada', chr(92), 0, 40)->>'total')::integer <> 0 then
    raise exception 'Search wildcards were incorrectly interpreted as patterns';
  end if;
  -- Cross-decision mail triage must not be constrained to one status tab.
  if (public.vonix_affiliate_search('todas', '', 0, 40, null)->>'total')::integer <> 2 then
    raise exception 'Global decisions list should show both reviewed candidates';
  end if;
  if (public.vonix_affiliate_search('todas', '', 0, 40, 'incerto')->>'total')::integer <> 1
     or (public.vonix_affiliate_search('todas', '', 0, 40, 'enviado')->>'total')::integer <> 1
     or (public.vonix_affiliate_search('todas', '', 0, 40, 'falhou')->>'total')::integer <> 0 then
    raise exception 'Mail triage filters returned wrong counts';
  end if;
  if (public.vonix_affiliate_search('aprovada', '', 0, 40, 'incerto')->>'total')::integer <> 0
     or (public.vonix_affiliate_search('recusada', '', 0, 40, 'incerto')->>'total')::integer <> 1 then
    raise exception 'Mail triage filter did not respect the selected decision status';
  end if;
  -- The five-step questionnaire is retained only as ciphertext.
  -- These strings are synthetic fixtures, never actual documents or contacts.
  update public.vonix_affiliate_applications
     set questionnaire_encrypted = 'v2.qa-ciphertext-fixture',
         tiktok_url = null, motivation = null
   where id = id_approved;
  if (select questionnaire_encrypted from public.vonix_affiliate_applications
       where id = id_approved) <> 'v2.qa-ciphertext-fixture' then
    raise exception 'Encrypted questionnaire column was not stored';
  end if;
  if (public.vonix_affiliate_search('aprovada', 'aprovada-qa', 0, 40)->'applications'->0->>'questionnaire_encrypted')
       <> 'v2.qa-ciphertext-fixture' then
    raise exception 'Service-role search did not return encrypted questionnaire';
  end if;
  if (select count(*) from public.vonix_affiliate_applications
       where id = id_approved and tiktok_url is null and motivation is null) <> 1 then
    raise exception 'Optional social and free-text fields were not migrated';
  end if;

  select public.vonix_affiliate_stats() into statuses;
  if (statuses->>'aprovada')::integer <>
      (select count(*) from public.vonix_affiliate_applications where status = 'aprovada')
    or (statuses->>'recusada')::integer <>
      (select count(*) from public.vonix_affiliate_applications where status = 'recusada') then
    raise exception 'Dashboard status counts are wrong';
  end if;
  if (statuses->>'email_enviado')::integer <>
      (select count(*) from public.vonix_affiliate_mail_outbox where status = 'enviado')
    or (statuses->>'email_incerto')::integer <>
      (select count(*) from public.vonix_affiliate_mail_outbox where status = 'incerto')
    or (statuses->>'email_pendente')::integer <>
      (select count(*) from public.vonix_affiliate_mail_outbox where status = 'pendente') then
    raise exception 'Email queue dashboard counters are wrong';
  end if;
  raise notice 'SQL QA PASS: quotas, private search, wildcard escapes, concurrent decisions, email status counters';
end;
$test$;

reset role;
do $test$
begin
  if has_table_privilege('anon','public.vonix_affiliate_applications','SELECT') then
    raise exception 'Anonymous applicants can directly read sensitive data';
  end if;
  if has_table_privilege('authenticated','public.vonix_affiliate_mail_outbox','SELECT') then
    raise exception 'Authenticated customers can directly read mail records';
  end if;
  if has_function_privilege('anon','public.vonix_affiliate_search(text,text,integer,integer,text)','EXECUTE') then
    raise exception 'Anonymous users can search private applications';
  end if;
  if has_function_privilege('anon','public.vonix_affiliate_decide(uuid,text)','EXECUTE') then
    raise exception 'Anonymous users can approve candidates';
  end if;
  if has_function_privilege('authenticated','public.vonix_affiliate_consume_rate_limit(text,text)','EXECUTE') then
    raise exception 'Authenticated users can bypass rate limiting';
  end if;
  raise notice 'SQL QA PASS: no direct access for anon/authenticated';
end;
$test$;
rollback;
