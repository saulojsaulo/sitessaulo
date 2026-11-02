import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase";

const str = (max: number) => z.string().max(max).optional().default("");
const Body = z.object({
  action: z.enum(["pull", "push_stats"]),
  site_key: z.string().max(200).optional(),
  site_url: str(500),
  site_name: str(300),
  webhook_url: str(1000),
  plugin_version: str(50),
  stats: z
    .array(
      z.object({
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        product_id: z.string().min(1).max(200),
        placement: z.string().max(50).optional().default(""),
        post_type: z.string().max(50).optional().default(""),
        impressions: z.coerce.number().int().min(0).max(100_000_000),
        clicks: z.coerce.number().int().min(0).max(100_000_000),
      }),
    )
    .max(5000)
    .optional()
    .default([]),
  titles: z.record(z.string().max(500)).optional().default({}),
});

const json = (body: unknown, status = 200) => Response.json(body, { status });

export const Route = createFileRoute("/api/public/wp-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ ok: false, error: "JSON inválido" }, 400);
        }
        const parsed = Body.safeParse(raw);
        if (!parsed.success) return json({ ok: false, error: "Dados inválidos" }, 400);
        const b = parsed.data;
        const key = (request.headers.get("x-site-key") || b.site_key || "").trim();
        if (!key) return json({ ok: false, error: "site_key inválida" }, 401);

        const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        if (b.action === "pull") {
          const { data, error } = await db.rpc("wp_sync_pull", {
            p_site_key: key,
            p_site_url: b.site_url,
            p_site_name: b.site_name,
            p_webhook_url: b.webhook_url,
            p_plugin_version: b.plugin_version,
          });
          if (error) return json({ ok: false, error: "Erro no servidor central" }, 500);
          if (data == null) return json({ ok: false, error: "site_key inválida" }, 401);
          return json({ ok: true, products: data });
        }

        const { data, error } = await db.rpc("wp_sync_push", {
          p_site_key: key,
          p_stats: b.stats,
          p_titles: b.titles,
        });
        if (error) return json({ ok: false, error: "Erro no servidor central" }, 500);
        if (!data) return json({ ok: false, error: "site_key inválida" }, 401);
        return json({ ok: true });
      },
    },
  },
});
