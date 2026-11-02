import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase";

/** Avisa o plugin do site (webhook) que os produtos mudaram. Falhas só são registradas. */
export const notifySite = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string; token: string }) => ({
    siteId: String(d.siteId).slice(0, 64),
    token: String(d.token).slice(0, 4000),
  }))
  .handler(async ({ data }) => {
    const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.token}` } },
    });
    // RLS garante que só um admin logado consegue ler o site.
    const { data: site } = await db
      .from("wp_sites")
      .select("id, site_key, webhook_url")
      .eq("id", data.siteId)
      .maybeSingle();
    if (!site) return { ok: false, message: "Site não encontrado" };
    if (!site.webhook_url) return { ok: false, message: "Sem webhook; o plugin sincroniza em até 15 min" };
    let ok = false;
    let status: number | null = null;
    let message = "";
    try {
      const r = await fetch(site.webhook_url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-site-key": site.site_key },
        body: JSON.stringify({ event: "products_updated", site_key: site.site_key }),
        signal: AbortSignal.timeout(10_000),
      });
      status = r.status;
      ok = r.ok;
      message = ok ? "Notificado" : `HTTP ${r.status}`;
    } catch (e) {
      message = e instanceof Error ? e.message : "Falha de rede";
    }
    await db.from("wp_notifications").insert({ site_id: site.id, ok, status, message: message.slice(0, 500) });
    return { ok, message };
  });
