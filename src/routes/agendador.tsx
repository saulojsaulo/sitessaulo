import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui-bits";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { runPostPipeline } from "@/lib/scheduler.functions";
import { CYCLES, planForDate, toISODate, todayInSP, type CycleKey } from "@/lib/scheduler";
import { cn } from "@/lib/utils";

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
  const { blogs, categories, posts } = useStore();
  const todayISO = todayInSP();
  const [date, setDate] = useState<Date>(() => new Date());
  const [cycle, setCycle] = useState<CycleKey>("manha");
  const dateISO = toISODate(date);
  const [busy, setBusy] = useState<string | null>(null);
  const runPost = useServerFn(runPostPipeline);

  /** Só postagens com imagem de capa entram na fila. */
  const coversQuery = useQuery({
    queryKey: ["posts-with-cover"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id")
        .not("cover", "is", null)
        .neq("cover", "");
      if (error) throw new Error(error.message);
      return ((data ?? []) as { id: string }[]).map((r) => r.id);
    },
    staleTime: 60_000,
  });
  const withCover = useMemo(() => new Set(coversQuery.data ?? []), [coversQuery.data]);

  const cycleIndex = CYCLES.findIndex((c) => c.key === cycle);

  const items = useMemo(() => {
    if (!coversQuery.data) return [];
    return planForDate({
      blogs,
      categories,
      posts,
      dateISO,
      todayISO,
      withCover,
      cycle: cycleIndex < 0 ? 0 : cycleIndex,
      cyclesPerDay: CYCLES.length,
      includeAllStatuses: true,
    });
  }, [coversQuery.data, withCover, blogs, categories, posts, dateISO, todayISO, cycleIndex]);

  const postById = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);
  const catName = (id?: string) => categories.find((c) => c.id === id)?.name ?? "Sem categoria";

  const openPost = (postId: string) => {
    void navigate({ to: "/postagens", search: { post: postId } });
  };

  const processItem = async (postId: string, title: string) => {
    setBusy(postId);
    try {
      const res = await runPost({ data: { postId } });
      if (res.done) toast.success(`"${title}" chegou em Artigo Aguardando Revisão`);
      else toast.info(`"${title}": ${res.steps} etapa(s) concluída(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar o artigo");
    } finally {
      setBusy(null);
    }
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
              {items.map((item) => {
                const post = postById.get(item.postId);
                const status = post?.status;
                return (
                  <div
                    key={`${item.blogId}-${item.postId}`}
                    className={cn(
                      "surface flex flex-wrap items-center gap-3 border-l-4 px-4 py-2.5",
                      status === "publicado" && "border-l-success bg-success/10",
                      status === "agendado" && "border-l-warning bg-warning/10",
                      status !== "publicado" && status !== "agendado" && "border-l-transparent",
                    )}
                  >
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
                      {busy === item.postId ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      Processar
                    </Button>
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
