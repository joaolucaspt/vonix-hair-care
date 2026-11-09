-- Vonix Hair | personal-data governance for affiliate applications
-- APPLY ONLY after an authorized database backup, in the correct Supabase project.
-- Requires supabase/vonix-affiliate-applications.sql first.
-- Never run the synthetic qa SQL in a production database.

create table if not exists public.vonix_affiliate_audit_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.vonix_affiliate_applications(id) on delete set null,
  event_type text not null check (event_type in ('aprovada', 'recusada', 'exclusao')),
  reason_category text not null default 'decisao' check
    (reason_category in ('decisao', 'solicitacao_titular', 'retencao', 'correcao')),
  created_at timestamptz not null default now()
);
create index if not exists vonix_affiliate_audit_events_created_idx
  on public.vonix_affiliate_audit_events (created_at desc);
-- Speeds up FK lookups when erasing a candidate; deployed separately on
-- 2026-11-09 as vonix_affiliate_audit_fk_index in the dedicated Supabase.
create index if not exists vonix_affiliate_audit_events_application_id_idx
  on public.vonix_affiliate_audit_events (application_id)
  where application_id is not null;
alter table public.vonix_affiliate_audit_events enable row level security;
revoke all on public.vonix_affiliate_audit_events from public, anon, authenticated;
grant select, insert on public.vonix_affiliate_audit_events to service_role;
grant delete on public.vonix_affiliate_applications to service_role;

-- Audit a single irreversible decision in the same transaction as the status change.
-- The shared admin password cannot establish individual operator identity.
create or replace function public.vonix_affiliate_audit_decision()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if old.status = 'pendente' and new.status in ('aprovada', 'recusada') then
    insert into public.vonix_affiliate_audit_events (application_id, event_type)
    values (new.id, new.status);
  end if;
  return new;
end;
$$;
drop trigger if exists vonix_affiliate_audit_decision_trigger
  on public.vonix_affiliate_applications;
create trigger vonix_affiliate_audit_decision_trigger
  after update of status on public.vonix_affiliate_applications
  for each row when (old.status is distinct from new.status)
  execute function public.vonix_affiliate_audit_decision();

-- A team member should validate the data-subject request OUTSIDE the website.
-- Confirm the candidate's e-mail again to avoid deleting an adjacent record.
-- Never erase an applicant while a mail worker has already claimed its message:
-- the external provider might still deliver that in-flight notification.
create or replace function public.vonix_affiliate_erase(
  p_id uuid, p_confirmation_email text, p_reason text
) returns boolean language plpgsql security invoker set search_path = ''
as $$
declare
  v_record record;
  v_mail_status text;
begin
  if p_id is null or p_confirmation_email is null
    or p_reason not in ('solicitacao_titular','retencao','correcao')
    or length(p_confirmation_email) > 180 then
    return false;
  end if;
  select id, email into v_record
    from public.vonix_affiliate_applications
   where id = p_id for update;
  if not found
    or v_record.email <> lower(trim(p_confirmation_email)) then
    return false;
  end if;
  select status into v_mail_status
    from public.vonix_affiliate_mail_outbox
   where application_id = p_id for update;
  if v_mail_status = 'processando' then
    return false;
  end if;
  insert into public.vonix_affiliate_audit_events
    (application_id, event_type, reason_category)
  values (p_id, 'exclusao', p_reason);
  delete from public.vonix_affiliate_applications where id = p_id;
  -- Cascading delete removes all queued messages, ciphertext, profile URLs,
  -- contact details and matching email receipts. The audit row survives but its
  -- application_id is SET NULL and contains no e-mail, CPF or other direct PII.
  return true;
end;
$$;

-- Read-only retention planning; no automatic deletion before policy sign-off.
-- Thresholds are explicit so a missing configuration never silently purges data.
create or replace function public.vonix_affiliate_retention_preview(
  p_pending_days integer, p_rejected_days integer
) returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_pending bigint;
  v_rejected bigint;
begin
  if p_pending_days is null or p_rejected_days is null
    or p_pending_days < 30 or p_pending_days > 3650
    or p_rejected_days < 30 or p_rejected_days > 3650 then
    raise exception 'Períodos de retenção inválidos';
  end if;
  select count(*) into v_pending
    from public.vonix_affiliate_applications a
   where a.status = 'pendente'
     and a.created_at < now() - make_interval(days => p_pending_days);
  select count(*) into v_rejected
    from public.vonix_affiliate_applications a
   where a.status = 'recusada'
     and a.reviewed_at < now() - make_interval(days => p_rejected_days)
     and not exists (
       select 1 from public.vonix_affiliate_mail_outbox m
        where m.application_id = a.id and m.status = 'processando'
     );
  return jsonb_build_object(
    'pending_eligible', v_pending,
    'rejected_eligible', v_rejected,
    'approved_preserved', true,
    'executed_deletions', 0
  );
end;
$$;

revoke all on function public.vonix_affiliate_erase(uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.vonix_affiliate_retention_preview(integer,integer)
  from public, anon, authenticated;
revoke all on function public.vonix_affiliate_audit_decision()
  from public, anon, authenticated;
grant execute on function public.vonix_affiliate_erase(uuid,text,text) to service_role;
grant execute on function public.vonix_affiliate_retention_preview(integer,integer) to service_role;
