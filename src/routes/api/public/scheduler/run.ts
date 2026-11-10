import { createFileRoute } from "@tanstack/react-router";

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Comparação em tempo constante, para não vazar o segredo por diferença de tempo. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Gatilho do agendador automático (chamado pelo pg_cron/pg_net, ver supabase-schema.sql).
 * Exige o segredo CRON_SECRET em `Authorization: Bearer <segredo>` (ou `x-cron-secret`).
 * Sem o segredo configurado no servidor, a rota fica FECHADA (503) — nunca aberta.
 */
export const Route = createFileRoute("/api/public/scheduler/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"]?.trim();
        if (!secret)
          return json({ ok: false, error: "CRON_SECRET não configurada no servidor" }, 503);

        const bearer =
          request.headers
            .get("authorization")
            ?.replace(/^Bearer\s+/i, "")
            .trim() ?? "";
        const header = request.headers.get("x-cron-secret")?.trim() ?? "";
        if (!safeEqual(bearer, secret) && !safeEqual(header, secret))
          return json({ ok: false, error: "Não autorizado" }, 401);

        let date: string | undefined;
        try {
          const body = (await request.json()) as { date?: unknown };
          if (typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date))
            date = body.date;
        } catch {
          /* corpo vazio: usa a data de hoje (America/Sao_Paulo) */
        }

        try {
          const { runScheduler } = await import("@/lib/scheduler.server");
          const result = await runScheduler(date);
          return json(result, result.ok ? 200 : 500);
        } catch (e) {
          console.error("[scheduler/run]", e);
          return json(
            { ok: false, error: e instanceof Error ? e.message : "Falha desconhecida" },
            500,
          );
        }
      },
    },
  },
});
