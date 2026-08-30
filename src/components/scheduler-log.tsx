/**
 * Log de erros da fila do agendador: falhas, artigos travados e etapas
 * incompletas nos últimos dias, com opção de reiniciar o registro.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui-bits";
import { STEP_TIMEOUT_MIN, type SchedulerRunRow } from "@/lib/scheduler";
import { useSchedulerIssues, useResetRun } from "@/lib/use-scheduler";
import { cn } from "@/lib/utils";

type Kind = "falha" | "travado" | "incompleto";

interface Issue {
  run: SchedulerRunRow;
  kind: Kind;
  message: string;
  lastStep: string;
}

const kindMeta: Record<Kind, { label: string; className: string }> = {
  falha: { label: "Falhou", className: "text-destructive" },
  travado: { label: "Travado", className: "text-warning" },
  incompleto: { label: "Incompleto", className: "text-warning" },
};

const fmt = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso))
    : "—";

function classify(run: SchedulerRunRow, todayISO: string): Issue | null {
  const lastStep = run.article_at
    ? "Artigo Aguardando Revisão"
    : run.sections_at
      ? "Sessões Completas"
      : run.structure_at
        ? "Estrutura gerada"
        : "Nenhuma etapa concluída";

  if (run.state === "falhou")
    return {
      run,
      kind: "falha",
      message: run.error ?? "Falha sem mensagem registrada",
      lastStep,
    };

  if (run.state === "executando") {
    const started = run.started_at ?? run.updated_at;
    const min = Math.round((Date.now() - new Date(started).getTime()) / 60_000);
    if (min >= STEP_TIMEOUT_MIN)
      return {
        run,
        kind: "travado",
        message: `Em execução há ${min} min (limite de ${STEP_TIMEOUT_MIN} min) — provável interrupção no meio da geração`,
        lastStep,
      };
    return null;
  }

  if (run.state !== "concluido" && run.run_date < todayISO)
    return {
      run,
      kind: "incompleto",
      message: "A data passou e o artigo não chegou em Aguardando Revisão",
      lastStep,
    };

  return null;
}

export function SchedulerLog({ todayISO }: { todayISO: string }) {
  const { data, isLoading, isFetching, refetch } = useSchedulerIssues();
  const reset = useResetRun();
  const [resetting, setResetting] = useState<string | null>(null);

  const issues = useMemo(
    () =>
      (data ?? [])
        .map((r) => classify(r, todayISO))
        .filter((i): i is Issue => i !== null)
        .slice(0, 50),
    [data, todayISO],
  );

  return (
    <section className="surface mt-6 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 text-warning" />
            Logs de erro da fila
          </h2>
          <p className="text-xs text-muted-foreground">
            Falhas, artigos travados e execuções incompletas dos últimos 14 dias.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando logs…
        </div>
      ) : issues.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="size-7" />}
          title="Nenhum erro registrado"
          description="Todos os artigos processados nos últimos 14 dias concluíram o ciclo sem falhas."
        />
      ) : (
        <ul className="grid gap-2">
          {issues.map(({ run, kind, message, lastStep }) => (
            <li key={run.id} className="rounded-lg border border-border/70 px-3 py-2">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={cn("font-semibold uppercase tracking-wide", kindMeta[kind].className)}>
                      {kindMeta[kind].label}
                    </span>
                    <span className="text-muted-foreground">{run.run_date}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{run.blog_name}</span>
                  </div>
                  <div className="truncate text-sm font-medium">{run.post_title || "(sem título)"}</div>
                  <p className="mt-0.5 break-words text-xs text-destructive">{message}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" /> início {fmt(run.started_at)} · atualizado {fmt(run.updated_at)}
                    </span>
                    <span>última etapa: {lastStep}</span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  disabled={resetting !== null}
                  onClick={async () => {
                    setResetting(run.id);
                    try {
                      await reset.mutateAsync(run.id);
                    } finally {
                      setResetting(null);
                    }
                  }}
                >
                  {resetting === run.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  Reiniciar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
