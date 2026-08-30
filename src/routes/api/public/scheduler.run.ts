import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint chamado pelo cron (pg_cron/scheduler externo) a cada 5 minutos
 * a partir das 03:00 no fuso de São Paulo. Cada chamada processa 1 artigo.
 * Se CRON_SECRET estiver definido, exige o header `x-cron-key`.
 */
async function handle(request: Request) {
  const secret = process.env["CRON_SECRET"];
  if (secret && request.headers.get("x-cron-key") !== secret)
    return new Response("Unauthorized", { status: 401 });

  const { runScheduler } = await import("@/lib/scheduler.server");
  const { todayInSP, nowHourSP, RUN_HOUR_SP } = await import("@/lib/scheduler");

  if (nowHourSP() < RUN_HOUR_SP)
    return Response.json({ ok: true, message: "Fora da janela de execução (antes das 03:00)" });

  try {
    const result = await runScheduler(todayInSP());
    return Response.json(result, { status: result.ok ? 200 : 500 });
  } catch (e) {
    return Response.json(
      { ok: false, message: e instanceof Error ? e.message : "Falha inesperada" },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/public/scheduler/run")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
