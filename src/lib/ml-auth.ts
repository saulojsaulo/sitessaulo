import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase";

/** Cliente com sessão de login, usado só no módulo privado "Afiliados ML". */
export const mlDb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
    storageKey: "postflow-ml-auth",
  },
});

export const ML_MAX_PRODUCTS = 50;

export interface WpSite {
  id: string;
  name: string;
  url: string;
  site_key: string;
  webhook_url: string;
  last_seen: string | null;
  plugin_version: string;
  created_at: string;
}

export interface WpProduct {
  id: string;
  site_id: string;
  title: string;
  image_url: string;
  affiliate_link: string;
  price: string;
  badge: string;
  keywords: string;
  weight: number;
  active: boolean;
  created_at: string;
}

export interface WpStat {
  site_id: string;
  day: string;
  product_id: string;
  placement: string;
  post_type: string;
  impressions: number;
  clicks: number;
}

/** Quantos produtos ainda cabem no site (limite de 50). */
export const remainingSlots = (current: number) => Math.max(0, ML_MAX_PRODUCTS - current);

export const ctr = (impressions: number, clicks: number) =>
  impressions > 0 ? (clicks / impressions) * 100 : 0;

export function toCsv(rows: (string | number)[][]) {
  return (
    "\ufeff" +
    rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n")
  );
}
