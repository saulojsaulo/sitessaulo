import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, Loader2, PlayCircle, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { EmptyState, PageHeader } from "@/components/ui-bits";
import { useStore } from "@/lib/store";
import { runPostPipeline, runSchedulerNow } from "@/lib/scheduler.functions";
import { useSchedulerActions, useSchedulerRuns } from "@/lib/use-scheduler";
import {
  RUN_HOUR_SP,
  STEPS,
  STEP_TIMEOUT_MIN,
  nowHourSP,
  planForDate,
  stepTone,
  toISODate,
  todayInSP,
  type DotTone,
  type SchedulerRunRow,
  type StepKey,
} from "@/lib/scheduler";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agendador")({
  head: () => ({
    meta: [
      { title: "Agendador de Artigos — PostFlow" },
      {
        name: "description",
        content:
          "Fila automática de artigos por blog, todos os dias, com linha do tempo das etapas de geração com IA às 03:00.",
      },
      { property: "og:title", content: "Agendador de Artigos — PostFlow" },
      {
        property: "og:description",
        content: "1 artigo por blog por dia, com etapas Estrutura, Sessões e Aguardando Revisão.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SchedulerPage,
});

const dotClass: Record<DotTone, string> = {
  ok: "bg-success shadow-[0_0_0_3px_hsl(var(--success)/0.18)]",
  atraso: "bg-warning shadow-[0_0_0_3px_hsl(var(--warning)/0.18)]",
  falha: "bg-destructive shadow-[0_0_0_3px_hsl(var(--destructive)/0.18)]",
  pendente: "bg-muted-foreground/35",
};

const toneLabel: Record<DotTone, string> = {
  ok: "concluída",
  atraso: "em atraso",
  falha: "falhou",
  pendente: "aguardando",
};

interface Item {
  key: string;
  runId: string | null;
  postId: string;
  postTitle: string;
  blogName: string;
  position: number;
  run: SchedulerRunRow | null;
}

function SchedulerPage() {
  const navigate = useNavigate();
  const { blogs, categories, posts } = useStore();
  const todayISO = todayInSP();
  const [date, setDate] = useState<Date>(() => new Date());
  const dateISO = toISODate(date);

  const runsQuery = useSchedulerRuns(dateISO);
  const { reset, invalidate } = useSchedulerActions(dateISO);
  const runNow = useServerFn(runSchedulerNow);
  const runPost = useServerFn(runPostPipeline);
  const [busy, setBusy] = useState<string | null>(null);

  const items = useMemo<Item[]>(() => {
    const runs = runsQuery.data ?? [];
    if (runs.length > 0)
      return runs.map((r) => ({
        key: r.id,
        runId: r.id,
        postId: r.post_id,
        postTitle: r.post_title || "(sem título)",
        blogName: r.blog_name,
        position: r.position,
        run: r,
      }));
    return planForDate({ blogs, categories, posts, dateISO, todayISO }).map((i) => ({
      key: `${i.blogId}-${i.postId}`,
      runId: null,
      postId: i.postId,
      postTitle: i.postTitle,
      blogName: i.blogName,
      position: i.position,
      run: null,
    }));
  }, [runsQuery.data, blogs, categories, posts, dateISO, todayISO]);

  const openPost = (postId: string) => {
    void navigate({ to: "/postagens", search: { post: postId } });
  };

  const executeAll = async () => {
    setBusy("all");
    try {
      const res = await runNow({ data: { date: dateISO } });
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao executar o agendador");
    } finally {
      setBusy(null);
    }
  };

  const executeItem = async (item: Item) => {
    setBusy(item.key);
    try {
      await runPost({ data: { postId: item.postId, ...(item.runId ? { runId: item.runId } : {}) } });
      toast.success(`"${item.postTitle}" chegou em Artigo Aguardando Revisão`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar o artigo");
    } finally {
      setBusy(null);
    }
  };

  const hour = nowHourSP();

  return (
    <>
      <PageHeader
        title="Agendador"
        subtitle={`Ciclo automático às ${String(RUN_HOUR_SP).padStart(2, "0")}:00 (Brasília) · 1 artigo por blog por dia (todos os dias) · até ${STEP_TIMEOUT_MIN} min por artigo`}
        action={
          <Button className="gap-2" disabled={busy !== null} onClick={() => void executeAll()}>
            {busy === "all" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlayCircle className="size-4" />
            )}
            Executar fila agora
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="surface w-fit p-2">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => d && setDate(d)}
            weekStartsOn={1}
            className="rounded-md"
          />
          <p className="px-3 pb-2 text-xs text-muted-foreground">
            Publicações diárias — todos os dias da semana.
          </p>
        </div>

        <div className="min-w-0">
          {items.length === 0 ? (

            <EmptyState
              icon={<CalendarDays className="size-7" />}
              title="Nenhum artigo para esta data"
              description={
                dateISO < todayISO
                  ? "Não há registros de execução nesta data."
                  : "Não há postagens em Rascunho/Estrutura suficientes na fila dos blogs para esta data."
              }
            />
          ) : (
            <div className="grid gap-2">
              {items.map((item) => (
                <div key={item.key} className="surface px-4 py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {item.position + 1}. {item.blogName}
                      </div>
                      <div className="truncate font-medium">{item.postTitle}</div>
                      {item.run?.error ? (
                        <div className="mt-0.5 text-xs text-destructive">{item.run.error}</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        disabled={busy !== null}
                        onClick={() => void executeItem(item)}
                      >
                        {busy === item.key ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Sparkles className="size-4" />
                        )}
                        Processar
                      </Button>
                      {item.runId ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={reset.isPending}
                          onClick={() => void reset.mutateAsync(item.runId!)}
                          aria-label="Reiniciar etapa"
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2">
                    {STEPS.map((step, i) => {
                      const tone: DotTone = item.run
                        ? stepTone(item.run, step.key as StepKey, {
                            dateISO,
                            todayISO,
                            nowSPHour: hour,
                          })
                        : "pendente";
                      return (
                        <div key={step.key} className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openPost(item.postId)}
                            title={`${step.label} — ${toneLabel[tone]} (clique para abrir a postagem)`}
                            className="flex items-center gap-1.5 rounded-full px-1.5 py-1 text-xs transition-colors hover:bg-accent"
                          >
                            <span className={cn("size-2.5 rounded-full", dotClass[tone])} />
                            <span
                              className={cn(
                                "whitespace-nowrap",
                                tone === "ok" && "text-success",
                                tone === "atraso" && "text-warning",
                                tone === "falha" && "text-destructive",
                                tone === "pendente" && "text-muted-foreground",
                              )}
                            >
                              {step.label}
                            </span>
                          </button>
                          {i < STEPS.length - 1 ? (
                            <span className="h-px w-6 bg-border sm:w-10" aria-hidden />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
