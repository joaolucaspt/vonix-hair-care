-- Vonix Hair | sandbox-only order-event reconciliation ledger.
-- This is NOT a live commission/payments system: no external orders, payout rates,
-- customer data, payment gateway, revenue shares or real affiliate profiles.
-- A future separately reviewed migration is required before live event ingestion.
create table if not exists public.vonix_affiliate_sandbox_orders (
  source_order_id text primary key check (source_order_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  affiliate_ref text not null check (affiliate_ref ~ '^[a-z0-9-]{1,30}$'),
  amount_cents bigint not null check (amount_cents between 1 and 500000000),
  status text not null default 'pendente' check
    (status in ('pendente', 'pago', 'cancelado', 'estornado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vonix_affiliate_sandbox_order_status_idx
  on public.vonix_affiliate_sandbox_orders (status, created_at desc);
create table if not exists public.vonix_affiliate_sandbox_events (
  event_id text primary key check (event_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  source_order_id text not null references public.vonix_affiliate_sandbox_orders(source_order_id) on delete cascade,
  status text not null check (status in ('pendente','pago','cancelado','estornado')),
  recorded_at timestamptz not null default now()
);
create index if not exists vonix_affiliate_sandbox_events_order_idx
  on public.vonix_affiliate_sandbox_events (source_order_id, recorded_at desc);

alter table public.vonix_affiliate_sandbox_orders enable row level security;
alter table public.vonix_affiliate_sandbox_events enable row level security;
revoke all on public.vonix_affiliate_sandbox_orders from public, anon, authenticated;
revoke all on public.vonix_affiliate_sandbox_events from public, anon, authenticated;
grant select, insert, update on public.vonix_affiliate_sandbox_orders to service_role;
grant select, insert on public.vonix_affiliate_sandbox_events to service_role;

-- Atomic state transitions without arbitrary attribution changes.
-- "pago" only after known "pendente"; "estornado" only after "pago".
-- Replaying an event or state is idempotent; conflicting events are rejected.
create or replace function public.vonix_affiliate_sandbox_record(
  p_event_id text, p_order_id text, p_ref text, p_status text, p_amount_cents bigint default null
) returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  v_order public.vonix_affiliate_sandbox_orders%rowtype;
  v_event public.vonix_affiliate_sandbox_events%rowtype;
  v_inserted text;
  v_next boolean := false;
begin
  if p_event_id is null or p_event_id !~ '^[A-Za-z0-9_-]{1,64}$'
    or p_order_id is null or p_order_id !~ '^[A-Za-z0-9_-]{1,40}$'
    or p_ref is null or p_ref !~ '^[a-z0-9-]{1,30}$'
    or p_status is null or p_status not in ('pendente','pago','cancelado','estornado')
    or (p_amount_cents is not null and (p_amount_cents < 1 or p_amount_cents > 500000000)) then
    return jsonb_build_object('ok',false,'reason','invalid');
  end if;

  -- Check event ids before creating orders: a conflicting replay must never
  -- leave behind an orphaned pending row.
  select * into v_event from public.vonix_affiliate_sandbox_events
   where event_id = p_event_id;
  if found then
    select * into v_order from public.vonix_affiliate_sandbox_orders
      where source_order_id = p_order_id;
    if v_event.source_order_id = p_order_id
      and v_event.status = p_status
      and found
      and v_order.affiliate_ref = p_ref
      and (p_amount_cents is null or v_order.amount_cents = p_amount_cents) then
      return jsonb_build_object('ok',true,'duplicate',true,'status',v_order.status);
    end if;
    return jsonb_build_object('ok',false,'reason','event_conflict');
  end if;

  -- New orders are only established through a valid pending event with amount.
  if p_status = 'pendente' and p_amount_cents is not null then
    insert into public.vonix_affiliate_sandbox_orders
      (source_order_id, affiliate_ref, amount_cents)
    values (p_order_id, p_ref, p_amount_cents)
    on conflict (source_order_id) do nothing
    returning source_order_id into v_inserted;
  end if;

  select * into v_order from public.vonix_affiliate_sandbox_orders
    where source_order_id=p_order_id for update;
  if not found then return jsonb_build_object('ok',false,'reason','unknown_order'); end if;
  if v_order.affiliate_ref <> p_ref
    or (p_amount_cents is not null and p_amount_cents <> v_order.amount_cents) then
    return jsonb_build_object('ok',false,'reason','attribution_mismatch');
  end if;

  if v_inserted is not null then
    insert into public.vonix_affiliate_sandbox_events (event_id,source_order_id,status)
    values (p_event_id,p_order_id,'pendente');
    return jsonb_build_object('ok',true,'duplicate',false,'status','pendente');
  end if;

  if v_order.status = p_status then
    return jsonb_build_object('ok',true,'duplicate',true,'status',v_order.status);
  end if;
  v_next := (
    (v_order.status='pendente' and p_status in ('pago','cancelado'))
    or (v_order.status='pago' and p_status in ('estornado','cancelado'))
  );
  if not v_next then return jsonb_build_object('ok',false,'reason','invalid_transition'); end if;

  update public.vonix_affiliate_sandbox_orders
    set status=p_status, updated_at=now() where source_order_id=p_order_id;
  insert into public.vonix_affiliate_sandbox_events (event_id,source_order_id,status)
  values (p_event_id,p_order_id,p_status);
  return jsonb_build_object('ok',true,'duplicate',false,'status',p_status);
end;
$$;

-- No amount of accounting is payable: the report contains only synthetic gross
-- amount and aggregate counts. No percentage or bank details are stored.
create or replace function public.vonix_affiliate_sandbox_report()
returns jsonb language sql stable security invoker set search_path = ''
as $$
select jsonb_build_object(
  'orders', count(*),
  'pending', count(*) filter (where status='pendente'),
  'paid', count(*) filter (where status='pago'),
  'reversed', count(*) filter (where status in ('cancelado','estornado')),
  'paid_gross_cents', coalesce(sum(amount_cents) filter (where status='pago'),0),
  'simulated_only', true
) from public.vonix_affiliate_sandbox_orders;
$$;

revoke all on function public.vonix_affiliate_sandbox_record(text,text,text,text,bigint)
  from public, anon, authenticated;
revoke all on function public.vonix_affiliate_sandbox_report()
  from public, anon, authenticated;
grant execute on function public.vonix_affiliate_sandbox_record(text,text,text,text,bigint) to service_role;
grant execute on function public.vonix_affiliate_sandbox_report() to service_role;
