import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, ChevronDown, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui-bits";
import { WpPublishPanel } from "@/components/wp-publish";
import { useStore } from "@/lib/store";
import type { PostStatus } from "@/lib/types";
import { runPostPipeline, getPlanForDate, getPostsProgress } from "@/lib/scheduler.functions";
import { CYCLES, toISODate, type CycleKey } from "@/lib/scheduler";
import { cn } from "@/lib/utils";

interface Progress {
  postId: string;
  hasRaw: boolean;
  sections: number;
  sectionsDone: number;
  hasArticle: boolean;
  hasPublished: boolean;
}

type StopTone = "vazio" | "andando" | "ok";

interface Stop {
  label: string;
  tone: StopTone;
  detail?: string | undefined;
}

/** Paradas da linha do tempo, derivadas do conteúdo salvo da postagem. */
function stopsFor(p: Progress | undefined, running: boolean): Stop[] {
  const raw = p?.hasRaw ?? false;
  const total = p?.sections ?? 0;
  const done = p?.sectionsDone ?? 0;
  const article = p?.hasArticle ?? false;
  const published = p?.hasPublished ?? false;
  const mark = (ok: boolean, active: boolean): StopTone =>
    ok ? "ok" : active && running ? "andando" : "vazio";

  return [
    { label: "Estrutura Bruta", tone: mark(raw, true) },
    { label: "Estruturas Individuais", tone: mark(total > 0, raw) },
    {
      label: "Sessões com IA",
      tone: mark(total > 0 && done >= total, total > 0),
      detail: total > 0 ? `${done}/${total}` : undefined,
    },
    { label: "Artigo Prompt", tone: mark(article && total > 0 && done >= total, done > 0) },
    { label: "Artigo Publicação", tone: mark(published, article) },
  ];
}

function Timeline({ stops }: { stops: Stop[] }) {
  return (
    <ol className="mt-2 flex w-full flex-wrap items-start gap-x-1 gap-y-3">
      {stops.map((s, i) => (
        <li key={s.label} className="flex min-w-0 flex-1 basis-28 items-start gap-1">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-center">
              <span className={cn("h-px flex-1", i === 0 ? "bg-transparent" : "bg-border")} />
              <span
                className={cn(
                  "grid size-3 shrink-0 place-items-center rounded-full border-2",
                  s.tone === "ok" && "border-success bg-success",
                  s.tone === "andando" && "animate-pulse border-primary bg-primary",
                  s.tone === "vazio" && "border-border bg-background",
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "h-px flex-1",
                  i === stops.length - 1 ? "bg-transparent" : "bg-border",
                )}
              />
            </div>
            <span
              className={cn(
                "text-center text-[10px] leading-tight",
                s.tone === "vazio" ? "text-muted-foreground" : "font-medium",
                s.tone === "ok" && "text-success",
                s.tone === "andando" && "text-primary",
              )}
            >
              {s.label}
              {s.detail ? ` · ${s.detail}` : ""}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}


export const Route = createFileRoute("/agendador")({
  head: () => ({
    meta: [
      { title: "Agendador — Calendário de Publicações | PostFlow" },
      {
        name: "description",
        content:
          "Calendário de publicações com dois ciclos diários (Manhã e Tarde): veja blog, categoria e artigo previsto para cada data.",
      },
      { property: "og:title", content: "Agendador — Calendário de Publicações | PostFlow" },
      {
        property: "og:description",
        content: "Dois ciclos de postagem por dia, com blog, categoria e status de cada artigo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SchedulerPage,
});

function SchedulerPage() {
  const navigate = useNavigate();
  const { categories, posts, updatePost } = useStore();
  const [date, setDate] = useState<Date>(() => new Date());
  const [cycle, setCycle] = useState<CycleKey>("manha");
  const dateISO = toISODate(date);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [statusById, setStatusById] = useState<Record<string, PostStatus>>({});
  /** Postagem com o painel de publicação do WordPress aberto. */
  const [openWp, setOpenWp] = useState<string | null>(null);
  /** Artigos marcados para processamento em lote. */
  const [selected, setSelected] = useState<string[]>([]);
  const [batch, setBatch] = useState(false);
  const runPost = useServerFn(runPostPipeline);
  const loadPlan = useServerFn(getPlanForDate);
  const loadProgress = useServerFn(getPostsProgress);

  const cycleIndex = CYCLES.findIndex((c) => c.key === cycle);

  /** Plano gravado no banco: a atribuição de cada artigo à data não muda. */
  const planQuery = useQuery({
    queryKey: ["scheduler_plan", dateISO],
    queryFn: () => loadPlan({ data: { date: dateISO } }),
    staleTime: 30_000,
  });

  const items = useMemo(() => {
    const idx = cycleIndex < 0 ? 0 : cycleIndex;
    return (planQuery.data?.rows ?? [])
      .filter((r) => r.cycle === idx)
      .map((r) => ({
        postId: r.post_id,
        postTitle: r.post_title,
        blogId: r.blog_id,
        blogName: r.blog_name,
        categoryId: r.category_id ?? undefined,
        position: r.position,
      }));
  }, [planQuery.data, cycleIndex]);

  const postIds = useMemo(() => items.map((i) => i.postId), [items]);

  const refreshProgress = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      try {
        const res = await loadProgress({ data: { postIds: ids } });
        setProgress((prev) => {
          const next = { ...prev };
          for (const row of res.rows) next[row.postId] = row;
          return next;
        });
        setStatusById((prev) => {
          const next = { ...prev };
          for (const row of res.rows) next[row.postId] = row.status;
          return next;
        });
      } catch {
        /* a linha do tempo volta a atualizar na próxima tentativa */
      }
    },
    [loadProgress],
  );

  /** Linha do tempo ao abrir a data (e sempre que o plano muda). */
  useQuery({
    queryKey: ["scheduler_progress", dateISO, cycleIndex, postIds.join(",")],
    queryFn: async () => {
      await refreshProgress(postIds);
      return true;
    },
    enabled: postIds.length > 0,
    staleTime: 10_000,
  });

  const postById = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);
  const catName = (id?: string) => categories.find((c) => c.id === id)?.name ?? "Sem categoria";

  const openPost = (postId: string) => {
    void navigate({ to: "/postagens", search: { post: postId } });
  };

  /**
   * Roteiro completo: estrutura → estruturas individuais → sessões com IA →
   * artigo prompt → revisão → artigo publicação. Cada chamada avança o que
   * cabe no tempo do servidor; aqui repetimos até concluir, atualizando a
   * linha do tempo em tempo real.
   */
  const processItem = async (postId: string, title: string) => {
    setBusy(postId);
    try {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const res = await runPost({ data: { postId } });
        await refreshProgress([postId]);
        if (res.done) {
          toast.success(`"${title}" concluído — Artigo Completo pronto para publicação`);
          return true;
        }
      }
      toast.info(`"${title}": ainda em andamento, clique em Processar novamente.`);
      return false;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar o artigo");
      await refreshProgress([postId]);
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** Processa em fila todos os artigos marcados, um após o outro. */
  const processSelected = async () => {
    const queue = items.filter((i) => selected.includes(i.postId));
    if (queue.length === 0) return;
    setBatch(true);
    let ok = 0;
    for (const item of queue) {
      const done = await processItem(item.postId, item.postTitle);
      if (done) ok += 1;
    }
    setBatch(false);
    toast.success(`${ok} de ${queue.length} artigo(s) concluído(s)`);
  };

  return (
    <>
      <PageHeader
        title="Agendador"
        subtitle="Calendário de publicações · 2 ciclos por dia (Manhã e Tarde) · 1 artigo por blog em cada ciclo · somente artigos com imagem de capa"
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
            Publicações diárias em dois ciclos.
            <br />
            A geração com IA não é automática — use “Processar”.
          </p>
        </div>

        <div className="min-w-0 space-y-4">
          <Tabs value={cycle} onValueChange={(v) => setCycle(v as CycleKey)}>
            <TabsList>
              {CYCLES.map((c) => (
                <TabsTrigger key={c.key} value={c.key}>
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {items.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-7" />}
              title="Nenhum artigo para este ciclo"
              description="Não há postagens com imagem de capa disponíveis na fila dos blogs para esta data e ciclo."
            />
          ) : (
            <div className="grid gap-2">
              <div className="surface flex flex-wrap items-center gap-3 px-4 py-2.5">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <Checkbox
                    checked={selected.length === items.length && items.length > 0}
                    onCheckedChange={(v: boolean | "indeterminate") =>
                      setSelected(v === true ? items.map((i) => i.postId) : [])
                    }
                  />
                  Selecionar todos
                </label>
                <span className="text-xs text-muted-foreground">
                  {selected.length} selecionado(s)
                </span>
                <Button
                  size="sm"
                  className="ml-auto gap-1.5"
                  disabled={selected.length === 0 || busy !== null || batch}
                  onClick={() => void processSelected()}
                >
                  {batch ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Processar Selecionados
                </Button>
              </div>
              {items.map((item) => {
                const post = postById.get(item.postId);
                const status = statusById[item.postId] ?? post?.status;
                const running = busy === item.postId;
                return (
                  <div
                    key={`${item.blogId}-${item.postId}`}
                    className={cn(
                      "surface border-l-4 px-4 py-2.5",
                      status === "publicado" && "border-l-success bg-success/10",
                      status === "agendado" && "border-l-warning bg-warning/10",
                      status !== "publicado" && status !== "agendado" && "border-l-transparent",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openPost(item.postId)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {item.position + 1}. {item.blogName} · {catName(item.categoryId)}
                        </div>
                        <div className="truncate font-medium">{item.postTitle}</div>
                      </button>
                      {status ? <StatusBadge status={status} /> : null}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        disabled={busy !== null}
                        onClick={() => void processItem(item.postId, item.postTitle)}
                      >
                        {running ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Sparkles className="size-4" />
                        )}
                        Processar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() =>
                          setOpenWp((cur) => (cur === item.postId ? null : item.postId))
                        }
                      >
                        <Send className="size-4" />
                        Publicar no WordPress
                        <ChevronDown
                          className={cn(
                            "size-4 transition-transform",
                            openWp === item.postId && "rotate-180",
                          )}
                        />
                      </Button>
                    </div>
                    <Timeline stops={stopsFor(progress[item.postId], running)} />
                    {openWp === item.postId ? (
                      post ? (
                        <div className="mt-3 border-t pt-3">
                          <WpPublishPanel
                            postId={post.id}
                            title={post.title}
                            content={post.content}
                            cover={post.cover}
                            tags={post.tags}
                            blogName={item.blogName}
                            categoryName={catName(item.categoryId)}
                            onPublished={({ wpStatus, date: when }) => {
                              if (wpStatus === "draft") return;
                              const next: PostStatus =
                                wpStatus === "publish" ? "publicado" : "agendado";
                              updatePost(post.id, {
                                status: next,
                                ...(wpStatus === "future" && when
                                  ? { publishDate: new Date(when).toISOString() }
                                  : {}),
                              });
                              setStatusById((prev) => ({ ...prev, [post.id]: next }));
                              toast.success(
                                next === "publicado"
                                  ? `"${post.title}" marcado como Publicado`
                                  : `"${post.title}" marcado como Agendado`,
                              );
                            }}
                          />
                        </div>
                      ) : (
                        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                          Abra a postagem para carregar os dados de publicação.
                        </p>
                      )
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
