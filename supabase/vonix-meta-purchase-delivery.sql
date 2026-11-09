-- Vonix Hair: durable deduplication of VERIFIED Meta CAPI Purchase delivery.
-- Apply ONLY to an authorized staging database after the snapshots and order
-- outbox migrations. No production schema is changed by building this project.
-- The table contains only order IDs and delivery state, never customer PII.

create table if not exists public.vonix_meta_purchase_delivery (
  order_id bigint primary key references public.vonix_order_snapshots(order_id),
  status text not null default 'pending'
    check (status in ('pending', 'leased', 'sent')),
  claim_token uuid,
  claimed_until timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vonix_meta_purchase_delivery enable row level security;
revoke all on public.vonix_meta_purchase_delivery from public, anon, authenticated;
grant select, insert, update on public.vonix_meta_purchase_delivery to service_role;

-- Concurrent workers cannot send the same confirmed purchase simultaneously.
-- If the previous worker crashed, its claim may be retried after five minutes,
-- always using the same deterministic Meta event_id (purchase-ORDER_ID).
create or replace function public.vonix_claim_meta_purchase(p_order_id bigint)
returns jsonb language plpgsql security definer
set search_path = ''
as $$
declare
  row_state public.vonix_meta_purchase_delivery%rowtype;
begin
  if p_order_id is null or p_order_id <= 0 then
    raise exception 'invalid order ID';
  end if;
  -- Never create an event for an order that did not enter this storefront.
  if not exists (
    select 1 from public.vonix_order_outbox o
    where o.order_id = p_order_id
  ) then
    raise exception 'order is not enrolled in outbox';
  end if;
  -- A paid order is not permission to send marketing. Historical snapshots
  -- without explicit v1 acceptance do not create or acquire delivery leases.
  if not exists (
    select 1 from public.vonix_order_snapshots s
    where s.order_id = p_order_id
      and s.payload #>> '{marketingConsent,accepted}' = 'true'
      and s.payload #>> '{marketingConsent,policyVersion}' = 'v1'
  ) then
    return jsonb_build_object('claimed', false, 'claimToken', null);
  end if;
  insert into public.vonix_meta_purchase_delivery(order_id)
    values (p_order_id)
    on conflict (order_id) do nothing;
  select * into row_state
    from public.vonix_meta_purchase_delivery
    where order_id = p_order_id for update;
  if row_state.status = 'sent' or
     (row_state.status = 'leased' and row_state.claimed_until > now()) then
    return jsonb_build_object('claimed', false, 'claimToken', null);
  end if;
  update public.vonix_meta_purchase_delivery
    set status = 'leased',
        claim_token = gen_random_uuid(),
        claimed_until = now() + interval '5 minutes',
        attempts = attempts + 1,
        updated_at = now()
    where order_id = p_order_id
    returning * into row_state;
  return jsonb_build_object('claimed', true, 'claimToken', row_state.claim_token);
end;
$$;
revoke execute on function public.vonix_claim_meta_purchase(bigint) from public, anon, authenticated;
grant execute on function public.vonix_claim_meta_purchase(bigint) to service_role;

-- Complete only while holding a live lease. A stale worker cannot mark an
-- event delivered after a newer worker has claimed it.
create or replace function public.vonix_ack_meta_purchase(
  p_order_id bigint, p_claim_token uuid
)
returns boolean language plpgsql security definer
set search_path = ''
as $$
declare changed integer;
begin
  if p_order_id is null or p_order_id <= 0 or p_claim_token is null then
    raise exception 'invalid purchase-delivery acknowledgement';
  end if;
  update public.vonix_meta_purchase_delivery
    set status = 'sent',
        claim_token = null,
        claimed_until = null,
        sent_at = now(),
        updated_at = now()
    where order_id = p_order_id
      and status = 'leased'
      and claim_token = p_claim_token
      and claimed_until > now();
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke execute on function public.vonix_ack_meta_purchase(bigint,uuid) from public, anon, authenticated;
grant execute on function public.vonix_ack_meta_purchase(bigint,uuid) to service_role;

-- Recover paid conversions even if the Bling/order outbox is already completed.
-- Calls are bounded and time-gated. We query Appmax again before sending Meta.
alter table public.vonix_meta_purchase_delivery
  add column if not exists next_check_at timestamptz not null default now();
create index if not exists vonix_meta_purchase_due
  on public.vonix_meta_purchase_delivery(status, next_check_at, created_at);

create or replace function public.vonix_meta_recovery_candidates(max_count integer default 3)
returns table(order_id bigint)
language plpgsql security definer set search_path = ''
as $$
declare max_rows integer := least(greatest(coalesce(max_count, 3), 1), 5);
begin
  -- Seed a small batch of missing delivery records from our own order outbox.
  -- A lost webhook or a completed ERP export does not erase this opportunity.
  insert into public.vonix_meta_purchase_delivery(order_id)
  select o.order_id
  from public.vonix_order_outbox o
  where o.created_at >= now() - interval '6 days'
    and o.created_at <= now() - interval '2 minutes'
    -- Exclude legacy/refused orders before scheduling any Appmax polling.
    and exists (
      select 1 from public.vonix_order_snapshots s
      where s.order_id = o.order_id
        and s.payload #>> '{marketingConsent,accepted}' = 'true'
        and s.payload #>> '{marketingConsent,policyVersion}' = 'v1'
    )
    and not exists (
      select 1 from public.vonix_meta_purchase_delivery m
      where m.order_id = o.order_id
    )
  order by o.created_at, o.order_id
  limit max_rows
  on conflict on constraint vonix_meta_purchase_delivery_pkey do nothing;

  return query
  select m.order_id
  from public.vonix_meta_purchase_delivery m
  join public.vonix_order_outbox o on o.order_id = m.order_id
  join public.vonix_order_snapshots s on s.order_id = m.order_id
  where o.created_at >= now() - interval '6 days'
    and o.created_at <= now() - interval '2 minutes'
    and s.payload #>> '{marketingConsent,accepted}' = 'true'
    and s.payload #>> '{marketingConsent,policyVersion}' = 'v1'
    and m.status <> 'sent'
    and m.next_check_at <= now()
    and (m.status <> 'leased' or m.claimed_until is null or m.claimed_until < now())
  order by m.next_check_at, m.created_at, m.order_id
  limit max_rows;
end;
$$;
revoke execute on function public.vonix_meta_recovery_candidates(integer)
  from public, anon, authenticated;
grant execute on function public.vonix_meta_recovery_candidates(integer)
  to service_role;

-- Defer nonpaid/failed verification without disabling the normal outbox.
-- No browser role may call this function. No payment mutations occur here.
create or replace function public.vonix_defer_meta_recovery(
  p_order_id bigint, p_delay_minutes integer default 60
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare changed integer;
begin
  if p_order_id is null or p_order_id <= 0 or
     p_delay_minutes is null or p_delay_minutes < 5 or p_delay_minutes > 1440 then
    raise exception 'invalid recovery deferral';
  end if;
  update public.vonix_meta_purchase_delivery
    set next_check_at = greatest(next_check_at, now() + make_interval(mins => p_delay_minutes)),
        updated_at = now()
    where order_id = p_order_id and status <> 'sent';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke execute on function public.vonix_defer_meta_recovery(bigint,integer)
  from public, anon, authenticated;
grant execute on function public.vonix_defer_meta_recovery(bigint,integer)
  to service_role;
