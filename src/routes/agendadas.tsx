import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDelete } from "@/components/confirm-delete";
import { EmptyState, PageHeader } from "@/components/ui-bits";
import { useStore } from "@/lib/store";
import { publishWpPost } from "@/lib/wp.functions";
import {
  usePublicationMutations,
  useWpConnections,
  useWpPublications,
} from "@/lib/use-wp";
import {
  articleToHtml,
  slugify,
  WP_STATUS_LABEL,
  type WpPublicationStatus,
} from "@/lib/wp-types";
import { parseWorkspace } from "@/lib/content-workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agendadas")({
  head: () => ({
    meta: [
      { title: "Postagens Agendadas — PostFlow" },
      {
        name: "description",
        content:
          "Acompanhe, por blog WordPress, a fila de postagens agendadas, publicadas e com falha de envio.",
      },
      { property: "og:title", content: "Postagens Agendadas — PostFlow" },
      {
        property: "og:description",
        content: "Fila de publicação multi-blog com reenvio manual em caso de falha.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScheduledPage,
});

const tone: Record<WpPublicationStatus, string> = {
  agendado: "bg-warning/15 text-warning border-warning/30",
  publicado: "bg-success/15 text-success border-success/30",
  rascunho: "bg-muted text-muted-foreground border-border",
  falhou: "bg-destructive/15 text-destructive border-destructive/30",
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

function ScheduledPage() {
  const publications = useWpPublications();
  const connections = useWpConnections();
  const { save, remove } = usePublicationMutations();
  const { posts, loadCover } = useStore();
  const publish = useServerFn(publishWpPost);

  const [connFilter, setConnFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [retrying, setRetrying] = useState<string | null>(null);

  const rows = publications.data ?? [];
  const conns = connections.data ?? [];
  const connName = (id: string) => conns.find((c) => c.id === id)?.name ?? "Conexão removida";

  const filtered = useMemo(
    () =>
      rows.filter(
        (p) =>
          (connFilter === "all" || p.connection_id === connFilter) &&
          (statusFilter === "all" || p.status === statusFilter),
      ),
    [rows, connFilter, statusFilter],
  );

  const counts = (id: string) => {
    const list = rows.filter((p) => p.connection_id === id);
    return {
      publicado: list.filter((p) => p.status === "publicado").length,
      agendado: list.filter((p) => p.status === "agendado").length,
      rascunho: list.filter((p) => p.status === "rascunho").length,
      falhou: list.filter((p) => p.status === "falhou").length,
    };
  };

  const retry = async (pubId: string, postId: string, connectionId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) {
      toast.error("Postagem original não encontrada no PostFlow");
      return;
    }
    setRetrying(pubId);
    try {
      const article = parseWorkspace(post.content).article.trim();
      if (!article) {
        toast.error("O Artigo Pronto desta postagem está vazio");
        return;
      }
      const cover = post.cover ?? (await loadCover(post.id));
      const pub = rows.find((p) => p.id === pubId);
      const scheduled = pub?.scheduled_at ?? null;
      const isFuture = Boolean(scheduled && new Date(scheduled).getTime() > Date.now());
      const res = await publish({
        data: {
          connectionId,
          title: post.title,
          content: articleToHtml(article),
          status: isFuture ? "future" : "draft",
          ...(isFuture && scheduled ? { date: scheduled.slice(0, 16) } : {}),
          slug: slugify(post.title),
          ...(cover ? { cover, coverFileName: slugify(post.title) || "capa" } : {}),
        },
      });
      await save.mutateAsync({
        post_id: postId,
        connection_id: connectionId,
        title: post.title,
        wp_post_id: res.wpPostId ?? null,
        wp_link: res.link ?? null,
        status: res.ok ? (res.status ?? "rascunho") : "falhou",
        scheduled_at: scheduled,
        error: res.ok ? null : (res.error ?? "Erro desconhecido"),
      });
      if (res.ok) toast.success("Reenviado com sucesso");
      else toast.error(res.error ?? "Falha no reenvio");
    } finally {
      setRetrying(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Postagens Agendadas"
        subtitle={`${filtered.length} envio(s) na fila de ${conns.length} blog(s)`}
      />

      {conns.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {conns.map((c) => {
            const n = counts(c.id);
            return (
              <div key={c.id} className="surface p-3 text-sm">
                <div className="truncate font-semibold">{c.name}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="text-success">{n.publicado} publicados</span>
                  <span className="text-warning">{n.agendado} agendados</span>
                  <span>{n.rascunho} rascunhos</span>
                  {n.falhou > 0 && <span className="text-destructive">{n.falhou} falhas</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="surface mb-6 grid gap-3 p-4 sm:grid-cols-2">
        <Select value={connFilter} onValueChange={setConnFilter}>
          <SelectTrigger aria-label="Filtrar por blog">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os blogs</SelectItem>
            {conns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filtrar por status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(WP_STATUS_LABEL) as WpPublicationStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {WP_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-7" />}
          title="Nenhum envio registrado"
          description="Ao publicar ou agendar uma postagem em um site WordPress conectado, o envio aparece aqui."
          action={
            <Button asChild className="mt-2">
              <Link to="/conexoes">Ver conexões WordPress</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2">
          {filtered.map((p) => (
            <div key={p.id} className="surface flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{p.title}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs font-medium",
                      tone[p.status],
                    )}
                  >
                    {WP_STATUS_LABEL[p.status]}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {connName(p.connection_id)} ·{" "}
                  {p.scheduled_at ? `agendado para ${fmt(p.scheduled_at)}` : `enviado ${fmt(p.updated_at)}`}
                  {p.error ? ` · ${p.error}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {p.wp_link && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={p.wp_link} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  disabled={retrying === p.id}
                  onClick={() => void retry(p.id, p.post_id, p.connection_id)}
                >
                  {retrying === p.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Reenviar
                </Button>
                <ConfirmDelete
                  trigger={
                    <Button variant="ghost" size="sm" className="text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  }
                  title="Remover registro de envio?"
                  description="O registro sai da fila do PostFlow. O post no WordPress não é alterado."
                  onConfirm={() => {
                    void remove.mutateAsync(p.id).then(() => toast.success("Registro removido"));
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
