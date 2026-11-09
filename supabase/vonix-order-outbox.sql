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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
create or replace function public.vonix_enqueue_order(p_order_id bigint)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_order_id is null or p_order_id <= 0 then raise exception 'invalid order id'; end if;
  insert into public.vonix_order_outbox(order_id) values (p_order_id)
  on conflict (order_id) do update
    set next_attempt_at = least(public.vonix_order_outbox.next_attempt_at, now()),
        updated_at = now()
  where public.vonix_order_outbox.status = 'pending';
end;
$$;
revoke execute on function public.vonix_enqueue_order(bigint) from public, anon, authenticated;
grant execute on function public.vonix_enqueue_order(bigint) to service_role;
