-- Required before enabling the new checkout. Never run automatically during build.
-- Contains personal customer and shipping data. Apply only to an authorized,
-- access-controlled Supabase project after legal retention review and backup.
create table if not exists public.vonix_order_snapshots (
  order_id bigint primary key check (order_id > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

alter table public.vonix_order_snapshots enable row level security;
revoke all on public.vonix_order_snapshots from public, anon, authenticated;
grant select, insert on public.vonix_order_snapshots to service_role;

-- Note: service_role alone has access; no browser-key RLS policies.
-- Operational retention: remove data no longer needed for fulfillment and legal
-- recordkeeping through an approved, audited retention policy. Do not blindly
-- delete active shipments or invoices.
