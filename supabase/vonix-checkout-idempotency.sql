-- Vonix checkout attempts — server-side duplicate-charge prevention.
-- Apply only after reviewed backup in authorized staging, NEVER during build.
-- Requires Supabase/PostgREST, pgcrypto and service_role-only RPC access.
-- Fingerprints are HMAC-SHA256 values; no CPF, address or card data is stored.
create table if not exists public.vonix_checkout_intents (
  fingerprint text primary key check (fingerprint ~ '^[a-f0-9]{64}$'),
  phase text not null default 'reserved' check (
    phase in ('reserved','creating_order','order_created','charging','submitted','completed','cancelled')
  ),
  claim_token uuid not null default gen_random_uuid(),
  order_id bigint unique check (order_id > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vonix_checkout_intents_phase
  on public.vonix_checkout_intents (phase, updated_at);
alter table public.vonix_checkout_intents enable row level security;
revoke all on public.vonix_checkout_intents from public, anon, authenticated;
grant select, insert, update on public.vonix_checkout_intents to service_role;

-- An advisory transaction lock serializes concurrent claims for the SAME
-- fingerprint; a genuine unrelated fingerprint is unaffected.
create or replace function public.vonix_checkout_claim(p_fingerprint text)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
declare
  current_intent public.vonix_checkout_intents%rowtype;
begin
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid checkout fingerprint';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_fingerprint, 0));
  select * into current_intent from public.vonix_checkout_intents
    where fingerprint = p_fingerprint for update;
  if not found then
    insert into public.vonix_checkout_intents(fingerprint)
      values (p_fingerprint) returning * into current_intent;
    return jsonb_build_object(
      'claimed', true, 'phase', current_intent.phase,
      'orderId', current_intent.order_id, 'claimToken', current_intent.claim_token
    );
  end if;
  -- After an authenticated Appmax cancellation the customer may retry.
  -- A genuinely completed purchase can be repeated after 24 hours.
  -- Unknown outcomes (creating_order/charging/submitted) NEVER reset automatically.
  if current_intent.phase = 'cancelled' or (
     current_intent.phase = 'completed'
     and current_intent.updated_at < now() - interval '24 hours'
  ) then
    update public.vonix_checkout_intents
      set phase = 'reserved', claim_token = gen_random_uuid(),
          order_id = null, created_at = now(), updated_at = now()
      where fingerprint = p_fingerprint
      returning * into current_intent;
    return jsonb_build_object(
      'claimed', true, 'phase', current_intent.phase,
      'orderId', current_intent.order_id, 'claimToken', current_intent.claim_token
    );
  end if;
  return jsonb_build_object(
    'claimed', false, 'phase', current_intent.phase,
    'orderId', current_intent.order_id, 'claimToken', null
  );
end;
$$;
revoke execute on function public.vonix_checkout_claim(text) from public, anon, authenticated;
grant execute on function public.vonix_checkout_claim(text) to service_role;

-- A fenced state machine: no duplicate or stale handler may submit a charge.
create or replace function public.vonix_checkout_advance(
  p_fingerprint text, p_token uuid, p_expected text, p_next text, p_order_id bigint default null
)
returns boolean language plpgsql security definer
set search_path = ''
as $$
declare changed integer;
begin
  if not (
    (p_expected = 'reserved' and p_next = 'creating_order' and p_order_id is null) or
    (p_expected = 'creating_order' and p_next = 'order_created' and p_order_id > 0) or
    (p_expected = 'order_created' and p_next = 'charging' and p_order_id is null) or
    (p_expected = 'charging' and p_next = 'submitted' and p_order_id is null)
  ) then
    raise exception 'invalid checkout transition';
  end if;
  update public.vonix_checkout_intents
    set phase = p_next,
        order_id = coalesce(p_order_id, order_id),
        updated_at = now()
    where fingerprint = p_fingerprint and claim_token = p_token and phase = p_expected;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke execute on function public.vonix_checkout_advance(text,uuid,text,text,bigint) from public, anon, authenticated;
grant execute on function public.vonix_checkout_advance(text,uuid,text,text,bigint) to service_role;

-- Only backend code that ALREADY verified authenticated Appmax status calls this.
-- Do not trust unsigned webhook status or a client's browser state.
create or replace function public.vonix_checkout_finalize(p_order_id bigint, p_outcome text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare changed integer;
begin
  if p_order_id is null or p_order_id <= 0 or
     p_outcome not in ('completed','cancelled') then
    raise exception 'invalid finalization';
  end if;
  update public.vonix_checkout_intents
    set phase = p_outcome, updated_at = now()
    where order_id = p_order_id
      and phase in ('order_created','charging','submitted',p_outcome);
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke execute on function public.vonix_checkout_finalize(bigint,text) from public, anon, authenticated;
grant execute on function public.vonix_checkout_finalize(bigint,text) to service_role;
