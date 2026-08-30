import { createServerFn } from "@tanstack/react-start";

/** Processa um artigo da fila do dia (execução manual pelo Publisher). */
export const runSchedulerNow = createServerFn({ method: "POST" })
  .inputValidator((input?: { date?: string }) => ({
    date: input?.date ? String(input.date).slice(0, 10) : undefined,
  }))
  .handler(async ({ data }) => {
    const { runScheduler } = await import("./scheduler.server");
    return runScheduler(data.date);
  });

/** Roda o ciclo completo de um artigo específico. */
export const runPostPipeline = createServerFn({ method: "POST" })
  .inputValidator((input: { postId: string; runId?: string }) => {
    const postId = String(input?.postId ?? "").trim();
    if (!postId) throw new Error("postId obrigatório");
    return { postId, runId: input.runId ? String(input.runId) : undefined };
  })
  .handler(async ({ data }) => {
    const { runPipeline } = await import("./scheduler.server");
    return runPipeline(data.postId, data.runId);
  });


/** Garante que os registros de uma data existem e devolve a lista. */
export const ensureSchedulerRuns = createServerFn({ method: "POST" })
  .inputValidator((input: { date: string }) => ({ date: String(input?.date ?? "").slice(0, 10) }))
  .handler(async ({ data }) => {
    const { ensureRuns } = await import("./scheduler.server");
    return { runs: await ensureRuns(data.date) };
  });
