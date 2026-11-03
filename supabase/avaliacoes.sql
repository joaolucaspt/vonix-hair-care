-- Tabela das avaliações enviadas pelo site (qualquer visitante, comprando ou não).
-- Rode uma vez no editor SQL do Supabase / Lovable Cloud.
create table if not exists public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  nome text not null,
  nota int not null check (nota between 1 and 5),
  comentario text not null,
  email text,
  -- aprovada: aparece no site na hora | pendente: a conferência automática segurou, só aparece se você liberar | oculta: escondida
  status text not null default 'pendente' check (status in ('aprovada', 'pendente', 'oculta')),
  ip_hash text,
  criado_em timestamptz not null default now()
);

create index if not exists avaliacoes_slug_status_idx on public.avaliacoes (slug, status, criado_em desc);
create index if not exists avaliacoes_ip_idx on public.avaliacoes (ip_hash, criado_em desc);

-- Ninguém lê nem escreve direto pelo navegador: só o servidor do site, com a chave de serviço (que ignora esta proteção).
alter table public.avaliacoes enable row level security;

-- Para esconder uma avaliação:   update public.avaliacoes set status = 'oculta'   where id = '...';
-- Para liberar uma pendente:     update public.avaliacoes set status = 'aprovada' where id = '...';
