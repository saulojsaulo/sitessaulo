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
-- ==========================================================
-- Analytics (GA4): de-para blog -> GA4 property id
-- ==========================================================
create table if not exists public.blog_properties (
  id uuid primary key default gen_random_uuid(),
  blog_name text not null,
  ga4_property_id text not null default '',
  favicon_url text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.blog_properties to anon, authenticated;
grant all on public.blog_properties to service_role;

alter table public.blog_properties enable row level security;
create policy "public access blog_properties" on public.blog_properties
  for all using (true) with check (true);

insert into public.blog_properties (blog_name, ga4_property_id, favicon_url)
select v.blog_name, '', 'https://www.google.com/s2/favicons?domain=' || v.blog_name || '&sz=64'
from (values
  ('ailovepdf.com.br'),
  ('smallpdf.com.br'),
  ('moneypress.com.br'),
  ('cnpjbusca.com'),
  ('valorfipe.com'),
  ('hinarioccb.com'),
  ('bibliaonlinecompleta.com.br'),
  ('curiosohein.com'),
  ('issoeincrivel.com'),
  ('todogostoso.com')
) as v(blog_name)
where not exists (
  select 1 from public.blog_properties p where p.blog_name = v.blog_name
);

-- ==========================================================
-- Integração WordPress multi-blog (REST API + Application Passwords)
-- ==========================================================
create table if not exists public.wp_connections (
  id text primary key,
  name text not null,
  site_url text not null,
  username text not null,
  app_password text not null,
  status text not null default 'nao_testado',
  last_error text,
  last_tested_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.wp_publications (
  id text primary key,
  post_id text not null references public.posts(id) on delete cascade,
  connection_id text not null references public.wp_connections(id) on delete cascade,
  title text not null default '',
  wp_post_id integer,
  wp_link text,
  status text not null default 'rascunho',
  scheduled_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists wp_publications_post_conn_idx
  on public.wp_publications (post_id, connection_id);

grant select, insert, update, delete on public.wp_connections to anon, authenticated;
grant select, insert, update, delete on public.wp_publications to anon, authenticated;
grant all on public.wp_connections to service_role;
grant all on public.wp_publications to service_role;

alter table public.wp_connections enable row level security;
alter table public.wp_publications enable row level security;

-- ATENCAO: app sem autenticacao => estas tabelas ficam publicas.
-- As Application Passwords ficam legiveis por quem tiver a chave publishable:
-- mantenha o projeto privado ou adicione login antes de publicar.
create policy "public access wp_connections" on public.wp_connections
  for all using (true) with check (true);
create policy "public access wp_publications" on public.wp_publications
  for all using (true) with check (true);

-- ============================================================
-- Uso de IA (painel de consumo do Gemini)
-- ============================================================
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null default 'outro',
  post_id uuid,
  post_title text,
  model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated boolean not null default false,
  duration_ms integer not null default 0,
  ok boolean not null default true,
  error text
);

create index if not exists ai_usage_created_idx on public.ai_usage (created_at desc);

grant select, insert, update, delete on public.ai_usage to anon, authenticated;
grant all on public.ai_usage to service_role;

alter table public.ai_usage enable row level security;

create policy "public access ai_usage" on public.ai_usage
  for all using (true) with check (true);
