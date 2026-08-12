-- Execute este SQL no SQL Editor do seu projeto Supabase externo.
create table if not exists public.blogs (
  id text primary key,
  name text not null,
  url text not null default '',
  description text default '',
  logo text,
  color text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  blog_id text not null references public.blogs(id) on delete cascade,
  name text not null,
  description text default ''
);

create table if not exists public.posts (
  id text primary key,
  blog_id text not null references public.blogs(id) on delete cascade,
  category_id text references public.categories(id) on delete set null,
  title text not null,
  content text not null default '',
  tags text[] not null default '{}',
  status text not null default 'rascunho',
  publish_date text not null default '',
  cover text,
  created_at timestamptz not null default now()
);

-- Data API grants (app sem login -> role anon).
grant select, insert, update, delete on public.blogs to anon, authenticated;
grant select, insert, update, delete on public.categories to anon, authenticated;
grant select, insert, update, delete on public.posts to anon, authenticated;
grant all on public.blogs to service_role;
grant all on public.categories to service_role;
grant all on public.posts to service_role;

alter table public.blogs enable row level security;
alter table public.categories enable row level security;
alter table public.posts enable row level security;

-- ATENCAO: app sem autenticacao => acesso publico total a estas tabelas.
create policy "public access blogs" on public.blogs for all using (true) with check (true);
create policy "public access categories" on public.categories for all using (true) with check (true);
create policy "public access posts" on public.posts for all using (true) with check (true);