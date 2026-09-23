import { createClient } from "@supabase/supabase-js";

// Projeto Supabase externo (chave publishable — segura no cliente).
export const SUPABASE_URL = "https://rvuobfbobldfoqfjcphr.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_18MlzAl87-WoClOnoOJhWA_5ScAxyoj";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface BlogRow {
  id: string;
  name: string;
  url: string;
  description: string | null;
  logo: string | null;
  color: string;
  created_at: string;
}

export interface CategoryRow {
  id: string;
  blog_id: string;
  name: string;
  description: string | null;
}

export interface PostRow {
  id: string;
  blog_id: string;
  category_id: string | null;
  title: string;
  content: string;
  tags: string[] | null;
  status: string;
  publish_date: string;
  cover: string | null;
  created_at: string;
}

export interface BlogPropertyRow {
  id: string;
  blog_name: string;
  ga4_property_id: string;
  favicon_url: string | null;
  created_at: string;
}