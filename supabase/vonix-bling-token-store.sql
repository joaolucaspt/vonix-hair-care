-- Apply to the authorized Supabase project with reviewed migrations; no secrets in this file.
-- Critical: service_role only, NEVER grant anon/authenticated read/execute privileges.
create table if not exists public.vonix_bling_refresh_tokens (
  id smallint primary key default 1 check (id = 1),
  refresh_token text not null check (length(refresh_token) >= 20),
  updated_at timestamptz not null default now()
);
alter table public.vonix_bling_refresh_tokens enable row level security;
revoke all on public.vonix_bling_refresh_tokens from public, anon, authenticated;
grant select, insert, update on public.vonix_bling_refresh_tokens to service_role;

create or replace function public.vonix_read_bling_refresh_token()
returns text language sql security definer set search_path = public
as $$
  select refresh_token from public.vonix_bling_refresh_tokens where id = 1;
$$;
revoke execute on function public.vonix_read_bling_refresh_token() from public, anon, authenticated;
grant execute on function public.vonix_read_bling_refresh_token() to service_role;

-- Compare-and-swap protects multiple worker processes rotating the refresh token.
create or replace function public.vonix_rotate_bling_refresh_token(current_token text, new_token text)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  if new_token is null or length(new_token) < 20 then return false; end if;
  if current_token is null then
    insert into public.vonix_bling_refresh_tokens(id, refresh_token) values (1, new_token)
    on conflict (id) do nothing;
  else
    update public.vonix_bling_refresh_tokens
      set refresh_token = new_token, updated_at = now()
      where id = 1 and refresh_token = current_token;
  end if;
  return found;
end;
$$;
revoke execute on function public.vonix_rotate_bling_refresh_token(text, text) from public, anon, authenticated;
grant execute on function public.vonix_rotate_bling_refresh_token(text, text) to service_role;
