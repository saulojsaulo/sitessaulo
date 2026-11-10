-- ============================================================================
-- PostFlow — melhorias de banco. Seguro rodar mais de uma vez.
-- Rode no SQL Editor do Supabase.
-- ============================================================================

-- 1) Uso de IA: post_id era uuid, mas os IDs das postagens são texto.
--    Sem isto, o consumo de IA de várias postagens não era registrado.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_usage'
      and column_name = 'post_id' and data_type = 'uuid'
  ) then
    alter table public.ai_usage alter column post_id type text using post_id::text;
  end if;
end $$;

-- 2) Índices nas colunas mais filtradas (listas de postagens, fila, agendador).
create index if not exists posts_blog_idx            on public.posts (blog_id);
create index if not exists posts_status_idx          on public.posts (status);
create index if not exists posts_blog_status_idx     on public.posts (blog_id, status);
create index if not exists categories_blog_idx       on public.categories (blog_id);
create index if not exists wp_publications_status_idx on public.wp_publications (status);
create index if not exists ai_usage_post_idx         on public.ai_usage (post_id);
