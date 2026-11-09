-- Vonix: apply manually to the authorized Supabase project BEFORE enabling webhooks.
-- Never run against a production DB without a reviewed backup and migration procedure.
create table if not exists public.vonix_order_outbox (
  order_id bigint primary key check (order_id > 0),
  status text not null default 'pending' check (status in ('pending','leased','completed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  claimed_until timestamptz,
  claim_token uuid,
  processed_at timestamptz,
  review_required boolean not null default false,
  review_event text,
  review_marked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Supports reapplying this migration after a previous outbox version.
alter table public.vonix_order_outbox add column if not exists review_required boolean not null default false;
alter table public.vonix_order_outbox add column if not exists review_event text;
alter table public.vonix_order_outbox add column if not exists review_marked_at timestamptz;

create index if not exists vonix_order_outbox_poll
  on public.vonix_order_outbox (status, next_attempt_at);

alter table public.vonix_order_outbox enable row level security;
revoke all on public.vonix_order_outbox from public, anon, authenticated;
grant select, insert, update on public.vonix_order_outbox to service_role;

-- SKIP LOCKED + lease permit simultaneous workers without processing the same job.
create or replace function public.vonix_claim_order_outbox(max_count integer default 3)
returns table(order_id bigint, claim_token uuid) language plpgsql security definer
set search_path = public
as $$
begin
  return query
  with selected as (
    select q.order_id
    from public.vonix_order_outbox q
    where q.next_attempt_at <= now()
      and (q.status = 'pending' or (q.status = 'leased' and q.claimed_until < now()))
    order by q.next_attempt_at, q.order_id
    for update skip locked
    limit least(greatest(coalesce(max_count, 3), 1), 5)
  ), updated as (
    update public.vonix_order_outbox q
    set status = 'leased',
        attempts = q.attempts + 1,
        claimed_until = now() + interval '5 minutes',
        claim_token = gen_random_uuid(),
        updated_at = now()
    from selected s
    where q.order_id = s.order_id
    returning q.order_id, q.claim_token
  )
  select u.order_id, u.claim_token from updated u;
end;
$$;

revoke execute on function public.vonix_claim_order_outbox(integer) from public, anon, authenticated;
grant execute on function public.vonix_claim_order_outbox(integer) to service_role;

-- An incoming newer event wakes pending work immediately while never reopens done orders.
-- Remove legacy one-argument overload before creating the event-aware RPC.
drop function if exists public.vonix_enqueue_order(bigint);
create or replace function public.vonix_enqueue_order(p_order_id bigint, p_event text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_order_id is null or p_order_id <= 0 then raise exception 'invalid order id'; end if;
  -- The Appmax webhook is unsigned. Only locally created orders may be enqueued.
  -- Missing snapshots should fail and be retried instead of exporting foreign IDs.
  if not exists (select 1 from public.vonix_order_snapshots s where s.order_id = p_order_id) then
    raise exception 'order snapshot absent' using errcode = '23503';
  end if;
  insert into public.vonix_order_outbox(order_id) values (p_order_id)
  on conflict (order_id) do update
    set next_attempt_at = case
          when public.vonix_order_outbox.status = 'pending'
          then least(public.vonix_order_outbox.next_attempt_at, now())
          else public.vonix_order_outbox.next_attempt_at
        end,
        -- Never re-export a completed order because a later refund/chargeback arrived.
        -- Preserve it and raise a human-review flag instead (no automatic refunds).
        review_required = public.vonix_order_outbox.review_required or
          (public.vonix_order_outbox.status = 'completed'
           and p_event in ('order_refund', 'order_partial_refund',
                           'order_chargeback_in_treatment', 'order_refused_by_risk',
                           'order_cancelled', 'order_canceled')),
        review_event = case
          when public.vonix_order_outbox.status = 'completed'
           and p_event in ('order_refund', 'order_partial_refund',
                           'order_chargeback_in_treatment', 'order_refused_by_risk',
                           'order_cancelled', 'order_canceled')
          then p_event else public.vonix_order_outbox.review_event
        end,
        review_marked_at = case
          when public.vonix_order_outbox.status = 'completed'
           and p_event in ('order_refund', 'order_partial_refund',
                           'order_chargeback_in_treatment', 'order_refused_by_risk',
                           'order_cancelled', 'order_canceled')
          then now() else public.vonix_order_outbox.review_marked_at
        end,
        updated_at = now()
  where public.vonix_order_outbox.status = 'pending'
     or (public.vonix_order_outbox.status = 'completed'
         and p_event in ('order_refund', 'order_partial_refund',
                         'order_chargeback_in_treatment', 'order_refused_by_risk',
                         'order_cancelled', 'order_canceled'));
end;
$$;
revoke execute on function public.vonix_enqueue_order(bigint, text) from public, anon, authenticated;
grant execute on function public.vonix_enqueue_order(bigint, text) to service_role;

-- Recovery path for webhooks that Appmax dropped after the maximum four attempts.
-- Recover only locally created, old-enough, not-yet-enqueued orders. Never reopen
-- completed ones or shorten backoffs of pending/leased work. Scheduled workers
-- will re-check the real Appmax status before any export.
create or replace function public.vonix_reconcile_order_outbox(max_count integer default 10)
returns integer language plpgsql security definer set search_path = public
as $$
declare
  inserted_count integer;
begin
  with missing as (
    select s.order_id
    from public.vonix_order_snapshots s
    where s.created_at < now() - interval '2 minutes'
      and s.created_at >= now() - interval '90 days'
      and not exists (
        select 1 from public.vonix_order_outbox o where o.order_id = s.order_id
      )
    order by s.created_at, s.order_id
    limit least(greatest(coalesce(max_count, 10), 1), 20)
  ), added as (
    insert into public.vonix_order_outbox(order_id)
    select order_id from missing
    on conflict (order_id) do nothing
    returning order_id
  )
  select count(*)::integer into inserted_count from added;
  return inserted_count;
end;
$$;

revoke execute on function public.vonix_reconcile_order_outbox(integer) from public, anon, authenticated;
grant execute on function public.vonix_reconcile_order_outbox(integer) to service_role;

-- Read-only aggregate for administrators. No customer details, IDs or payloads.
-- Requires the outbox table and is deliberately inaccessible to browser roles.
create or replace function public.vonix_order_health_summary()
returns jsonb language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'pending', count(*) filter (where status = 'pending'),
    'leased', count(*) filter (where status = 'leased'),
    'completed', count(*) filter (where status = 'completed'),
    'awaitingReview', count(*) filter (where review_required),
    'readyToRetry', count(*) filter (where status = 'pending' and next_attempt_at <= now()),
    'expiredLeases', count(*) filter (where status = 'leased' and claimed_until < now()),
    'multipleAttempts', count(*) filter (where attempts >= 3 and status <> 'completed'),
    'completedLast24h', count(*) filter (where status = 'completed' and processed_at >= now() - interval '24 hours'),
    'oldestPendingMinutes', coalesce(
      greatest(0, floor(extract(epoch from (now() - min(created_at)
        filter (where status = 'pending'))) / 60)), 0
    )
  ) from public.vonix_order_outbox;
$$;
revoke execute on function public.vonix_order_health_summary() from public, anon, authenticated;
grant execute on function public.vonix_order_health_summary() to service_role;
