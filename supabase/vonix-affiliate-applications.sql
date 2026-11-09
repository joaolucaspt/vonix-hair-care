-- Vonix Hair | inscrições, decisões e fila de e-mails.
-- Aplicar manualmente no Supabase/Lovable Cloud correto após validação.
-- Acesso: SOMENTE service_role no servidor. Nenhum acesso público via REST.
create table if not exists public.vonix_affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 3 and 120),
  age integer not null check (age between 18 and 100),
  city text not null check (length(trim(city)) between 2 and 90),
  state char(2) not null,
  hair_type text not null check (hair_type in ('Liso', 'Ondulado', 'Cacheado', 'Crespo', 'Misto / em transição', 'Outro')),
  email text not null unique check (email = lower(trim(email))),
  instagram_url text not null,
  tiktok_url text not null,
  motivation text not null check (length(trim(motivation)) between 30 and 3000),
  consent_at timestamptz not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint vonix_affiliate_review_consistency check (
    (status = 'pendente' and reviewed_at is null)
    or (status <> 'pendente' and reviewed_at is not null)
  )
);
create index if not exists vonix_affiliate_status_created_idx
  on public.vonix_affiliate_applications (status, created_at desc, id desc);

create unique index if not exists vonix_affiliate_instagram_unique on public.vonix_affiliate_applications (lower(instagram_url));
create unique index if not exists vonix_affiliate_tiktok_unique on public.vonix_affiliate_applications (lower(tiktok_url));

-- 15-minute quota per pseudonymous network address, retained only for abuse prevention.
create table if not exists public.vonix_affiliate_throttles (
  scope text not null check (scope in ('submit', 'admin')),
  fingerprint char(64) not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  bucket_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (scope, fingerprint, bucket_start)
);
create index if not exists vonix_affiliate_throttle_expiry_idx
  on public.vonix_affiliate_throttles (bucket_start);

create table if not exists public.vonix_affiliate_mail_outbox (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.vonix_affiliate_applications (id) on delete cascade,
  decision text not null check (decision in ('aprovada', 'recusada')),
  status text not null default 'pendente' check (status in ('pendente', 'processando', 'enviado', 'falhou', 'incerto')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_id text,
  uncertain boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists vonix_affiliate_mail_claim_idx
  on public.vonix_affiliate_mail_outbox (status, next_attempt_at, created_at);

alter table public.vonix_affiliate_applications enable row level security;
alter table public.vonix_affiliate_mail_outbox enable row level security;
alter table public.vonix_affiliate_throttles enable row level security;
revoke all on public.vonix_affiliate_applications from anon, authenticated;
revoke all on public.vonix_affiliate_mail_outbox from anon, authenticated;
revoke all on public.vonix_affiliate_throttles from anon, authenticated;
grant select, insert, update on public.vonix_affiliate_applications to service_role;
grant select, insert, update on public.vonix_affiliate_mail_outbox to service_role;
grant select, insert, update, delete on public.vonix_affiliate_throttles to service_role;

-- Sem aprovação repetida: UPDATE condicional + criação de e-mail na MESMA transação.
create or replace function public.vonix_affiliate_decide(p_id uuid, p_decision text)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_changed uuid;
begin
  if p_decision not in ('aprovada', 'recusada') then
    raise exception 'Decisão inválida';
  end if;
  update public.vonix_affiliate_applications
     set status = p_decision, reviewed_at = now()
   where id = p_id and status = 'pendente'
   returning id into v_changed;
  if v_changed is null then return false; end if;
  insert into public.vonix_affiliate_mail_outbox(application_id, decision)
  values (v_changed, p_decision);
  return true;
end;
$$;

create or replace function public.vonix_affiliate_stats()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'pendente', count(*) filter (where status = 'pendente'),
    'aprovada', count(*) filter (where status = 'aprovada'),
    'recusada', count(*) filter (where status = 'recusada'),
    'email_pendente', (select count(*) from public.vonix_affiliate_mail_outbox where status = 'pendente'),
    'email_processando', (select count(*) from public.vonix_affiliate_mail_outbox where status = 'processando'),
    'email_enviado', (select count(*) from public.vonix_affiliate_mail_outbox where status = 'enviado'),
    'email_falhou', (select count(*) from public.vonix_affiliate_mail_outbox where status = 'falhou'),
    'email_incerto', (select count(*) from public.vonix_affiliate_mail_outbox where status = 'incerto')
  ) from public.vonix_affiliate_applications;
$$;

-- Safe, parameterized pagination/search; no client string is interpreted as PostgREST syntax.
create or replace function public.vonix_affiliate_search(
  p_status text, p_query text, p_offset integer, p_limit integer
) returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_query text := trim(coalesce(p_query, ''));
  -- Escape LIKE wildcard metacharacters; user search must be literal, not a pattern.
  v_pattern text := replace(replace(replace(trim(coalesce(p_query, '')), chr(92),
    chr(92) || chr(92)), '%', chr(92) || '%'), '_', chr(92) || '_');
begin
  if p_status not in ('pendente', 'aprovada', 'recusada')
    or length(v_query) > 70
    or p_offset is null or p_offset < 0 or p_offset > 2000000
    or p_limit is null or p_limit < 1 or p_limit > 40 then
    raise exception 'Consulta inválida';
  end if;

  return (
    with filtered as (
      select a.id, a.full_name, a.age, a.city, a.state, a.hair_type, a.email,
             a.instagram_url, a.tiktok_url, a.motivation, a.status, a.created_at, a.reviewed_at
      from public.vonix_affiliate_applications a
      where a.status = p_status
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
          'status', p.status,
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

-- Quotas are enforced atomically across parallel workers/server instances.
-- Only the server (service_role) may invoke these functions; client IPs are HMAC-hashed.
create or replace function public.vonix_affiliate_consume_rate_limit(
  p_scope text, p_fingerprint text
) returns boolean language plpgsql security invoker set search_path = ''
as $$
declare
  v_bucket timestamptz := date_bin('15 minutes', now(), '2000-01-01 00:00:00+00'::timestamptz);
  v_hits integer;
begin
  if p_scope not in ('submit', 'admin') or p_fingerprint !~ '^[a-f0-9]{64}$' then
    return false;
  end if;
  insert into public.vonix_affiliate_throttles (scope, fingerprint, bucket_start, hits)
    values (p_scope, p_fingerprint, v_bucket, 1)
  on conflict (scope, fingerprint, bucket_start) do update
    set hits = public.vonix_affiliate_throttles.hits + 1
  returning hits into v_hits;
  return v_hits <= case when p_scope = 'submit' then 8 else 12 end;
end;
$$;

-- A valid admin password does not increment the counter, but is blocked
-- after repeated failures from that same client network.
create or replace function public.vonix_affiliate_rate_limit_allowed(
  p_scope text, p_fingerprint text
) returns boolean language sql stable security invoker set search_path = ''
as $$
  select case
    when p_scope not in ('submit', 'admin') or p_fingerprint !~ '^[a-f0-9]{64}$'
      then false
    else coalesce((
      select hits < (case when p_scope = 'submit' then 8 else 12 end)
        from public.vonix_affiliate_throttles
       where scope = p_scope and fingerprint = p_fingerprint
         and bucket_start = date_bin('15 minutes', now(), '2000-01-01 00:00:00+00'::timestamptz)
    ), true)
  end;
$$;

-- Run daily by a privileged scheduler. At most two days of abuse counters remain.
create or replace function public.vonix_affiliate_purge_throttle()
returns bigint language sql security invoker set search_path = ''
as $$
  with deleted as (
    delete from public.vonix_affiliate_throttles
     where bucket_start < now() - interval '2 days'
    returning 1
  ) select count(*) from deleted;
$$;

-- Reenviar com a MESMA chave de idempotência até 20h; após isso, exige triagem
-- manual para nunca duplicar e-mail fora da janela de 24h do provedor.
create or replace function public.vonix_affiliate_claim_mail(p_application_id uuid default null)
returns table (mail_id uuid, application_id uuid, decision text, recipient text, attempt integer)
language plpgsql security invoker set search_path = ''
as $$
begin
  update public.vonix_affiliate_mail_outbox
     set status = 'incerto'
   where status = 'processando'
     and created_at <= now() - interval '20 hours'
     and last_attempt_at < now() - interval '10 minutes';

  update public.vonix_affiliate_mail_outbox
     set status = case when uncertain then 'incerto' else 'falhou' end
   where status = 'pendente'
     and (attempts >= 5 or created_at <= now() - interval '20 hours');

  return query
  with candidate as (
    select m.id
      from public.vonix_affiliate_mail_outbox m
     where (p_application_id is null or m.application_id = p_application_id)
       and m.attempts < 5
       and m.created_at > now() - interval '20 hours'
       and (
         (m.status = 'pendente' and m.next_attempt_at <= now())
         or (m.status = 'processando' and m.last_attempt_at < now() - interval '10 minutes')
       )
     order by m.created_at
     limit 1
     for update skip locked
  ), claimed as (
    update public.vonix_affiliate_mail_outbox m
       set status = 'processando', attempts = m.attempts + 1, last_attempt_at = now()
      from candidate
     where m.id = candidate.id
     returning m.id, m.application_id, m.decision, m.attempts
  )
  select c.id, c.application_id, c.decision, a.email, c.attempts
  from claimed c
  join public.vonix_affiliate_applications a on a.id = c.application_id;
end;
$$;

create or replace function public.vonix_affiliate_finish_mail(
  p_mail_id uuid, p_attempt integer, p_success boolean, p_provider_id text default null,
  p_unknown boolean default false, p_permanent boolean default false
) returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_changed uuid;
begin
  update public.vonix_affiliate_mail_outbox
     set status = case when p_success then 'enviado'
                       when p_permanent or attempts >= 5 or created_at <= now() - interval '20 hours'
                         then case when uncertain or p_unknown then 'incerto' else 'falhou' end
                       else 'pendente' end,
         uncertain = case when p_success then false else uncertain or p_unknown end,
         sent_at = case when p_success then now() else sent_at end,
         provider_id = case when p_success then p_provider_id else provider_id end,
         next_attempt_at = case when p_success then now() else now() + interval '5 minutes' end
   where id = p_mail_id and attempts = p_attempt and status = 'processando'
   returning id into v_changed;
  return v_changed is not null;
end;
$$;

revoke all on function public.vonix_affiliate_consume_rate_limit(text,text) from public, anon, authenticated;
revoke all on function public.vonix_affiliate_rate_limit_allowed(text,text) from public, anon, authenticated;
revoke all on function public.vonix_affiliate_purge_throttle() from public, anon, authenticated;
revoke all on function public.vonix_affiliate_search(text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.vonix_affiliate_decide(uuid,text) from public, anon, authenticated;
revoke all on function public.vonix_affiliate_stats() from public, anon, authenticated;
revoke all on function public.vonix_affiliate_claim_mail(uuid) from public, anon, authenticated;
revoke all on function public.vonix_affiliate_finish_mail(uuid,integer,boolean,text,boolean,boolean) from public, anon, authenticated;
grant execute on function public.vonix_affiliate_consume_rate_limit(text,text) to service_role;
grant execute on function public.vonix_affiliate_rate_limit_allowed(text,text) to service_role;
grant execute on function public.vonix_affiliate_purge_throttle() to service_role;
grant execute on function public.vonix_affiliate_search(text,text,integer,integer) to service_role;
grant execute on function public.vonix_affiliate_decide(uuid,text) to service_role;
grant execute on function public.vonix_affiliate_stats() to service_role;
grant execute on function public.vonix_affiliate_claim_mail(uuid) to service_role;
grant execute on function public.vonix_affiliate_finish_mail(uuid,integer,boolean,text,boolean,boolean) to service_role;
