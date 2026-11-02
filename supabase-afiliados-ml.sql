-- Módulo "Afiliados Mercado Livre". Rode no SQL Editor do seu Supabase (pode rodar mais de uma vez).
create extension if not exists pgcrypto;

-- Administradores do módulo (adicione seu usuário no final deste arquivo).
create table if not exists public.ml_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
grant select on public.ml_admins to authenticated;
grant all on public.ml_admins to service_role;
alter table public.ml_admins enable row level security;
drop policy if exists "admin reads self" on public.ml_admins;
create policy "admin reads self" on public.ml_admins for select to authenticated using (user_id = auth.uid());

create or replace function public.ml_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ml_admins where user_id = auth.uid());
$$;
grant execute on function public.ml_is_admin() to authenticated;

create table if not exists public.wp_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null default '',
  site_key text not null unique default encode(gen_random_bytes(24), 'hex'),
  webhook_url text not null default '',
  last_seen timestamptz,
  plugin_version text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.wp_products (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.wp_sites(id) on delete cascade,
  title text not null,
  image_url text not null default '',
  affiliate_link text not null default '',
  price text not null default '',
  badge text not null default '',
  keywords text not null default '',
  weight int not null default 3 check (weight between 1 and 5),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists wp_products_site_idx on public.wp_products(site_id);

create or replace function public.wp_products_limit() returns trigger
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.site_id::text));
  if (select count(*) from public.wp_products where site_id = new.site_id and id <> new.id) >= 50 then
    raise exception 'Limite de 50 produtos por site atingido';
  end if;
  return new;
end $$;
drop trigger if exists wp_products_limit_trg on public.wp_products;
create trigger wp_products_limit_trg before insert or update of site_id on public.wp_products
  for each row execute function public.wp_products_limit();

create table if not exists public.wp_stats (
  site_id uuid not null references public.wp_sites(id) on delete cascade,
  day date not null,
  product_id text not null,
  placement text not null default '',
  post_type text not null default '',
  impressions int not null default 0,
  clicks int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (site_id, day, product_id, placement, post_type)
);

create table if not exists public.wp_product_titles (
  site_id uuid not null references public.wp_sites(id) on delete cascade,
  product_id text not null,
  title text not null,
  primary key (site_id, product_id)
);

create table if not exists public.wp_notifications (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.wp_sites(id) on delete cascade,
  ok boolean not null,
  status int,
  message text not null default '',
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['wp_sites','wp_products','wp_stats','wp_product_titles','wp_notifications'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format('create policy "admin all" on public.%I for all to authenticated using (public.ml_is_admin()) with check (public.ml_is_admin())', t);
  end loop;
end $$;

-- Sincronização do plugin (chamada pelo servidor do app, autenticada pela site_key).
create or replace function public.wp_sync_pull(
  p_site_key text, p_site_url text, p_site_name text, p_webhook_url text, p_plugin_version text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.wp_sites;
begin
  select * into s from public.wp_sites where site_key = p_site_key;
  if not found then return null; end if;
  update public.wp_sites set
    last_seen = now(),
    url = coalesce(nullif(p_site_url, ''), url),
    webhook_url = coalesce(nullif(p_webhook_url, ''), webhook_url),
    plugin_version = coalesce(nullif(p_plugin_version, ''), plugin_version)
  where id = s.id;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'title', title, 'image', image_url, 'image_url', image_url,
      'link', affiliate_link, 'affiliate_link', affiliate_link, 'price', price,
      'badge', badge, 'keywords', keywords, 'weight', weight, 'active', active
    ) order by weight desc, created_at)
    from (select * from public.wp_products where site_id = s.id order by created_at limit 50) p
  ), '[]'::jsonb);
end $$;

create or replace function public.wp_sync_push(p_site_key text, p_stats jsonb, p_titles jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  select id into sid from public.wp_sites where site_key = p_site_key;
  if sid is null then return false; end if;
  update public.wp_sites set last_seen = now() where id = sid;
  insert into public.wp_stats (site_id, day, product_id, placement, post_type, impressions, clicks, updated_at)
  select sid, (e->>'day')::date, e->>'product_id', coalesce(e->>'placement', ''), coalesce(e->>'post_type', ''),
         greatest(coalesce((e->>'impressions')::int, 0), 0), greatest(coalesce((e->>'clicks')::int, 0), 0), now()
  from jsonb_array_elements(coalesce(p_stats, '[]'::jsonb)) e
  where e->>'day' is not null and e->>'product_id' is not null
  on conflict (site_id, day, product_id, placement, post_type)
  do update set impressions = excluded.impressions, clicks = excluded.clicks, updated_at = now();
  insert into public.wp_product_titles (site_id, product_id, title)
  select sid, k, v from jsonb_each_text(coalesce(p_titles, '{}'::jsonb)) as t(k, v)
  where k <> '' and v <> ''
  on conflict (site_id, product_id) do update set title = excluded.title;
  return true;
end $$;

revoke all on function public.wp_sync_pull(text,text,text,text,text) from public;
revoke all on function public.wp_sync_push(text,jsonb,jsonb) from public;
grant execute on function public.wp_sync_pull(text,text,text,text,text) to anon, authenticated;
grant execute on function public.wp_sync_push(text,jsonb,jsonb) to anon, authenticated;

-- Imagens dos produtos (bucket público para leitura; envio só por admin).
insert into storage.buckets (id, name, public) values ('ml-products', 'ml-products', true)
on conflict (id) do nothing;
drop policy if exists "ml admin upload" on storage.objects;
create policy "ml admin upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'ml-products' and public.ml_is_admin());

-- DEPOIS de criar sua conta na tela "Afiliados ML", rode trocando o e-mail:
-- insert into public.ml_admins (user_id) select id from auth.users where email = 'SEU-EMAIL@exemplo.com' on conflict do nothing;
