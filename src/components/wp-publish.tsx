import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, Loader2, Send, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { parseWorkspace } from "@/lib/content-workspace";
import { articleToHtml, slugify, type WpConnectionRow } from "@/lib/wp-types";
import { createWpTerm, publishWpPost } from "@/lib/wp.functions";
import {
  usePublicationMutations,
  useWpConnections,
  useWpPublications,
  useWpSiteMeta,
} from "@/lib/use-wp";

type WpStatus = "draft" | "publish" | "future";

interface Target {
  categoryIds: number[];
  slug: string;
  slugTouched?: boolean;
  metaDescription: string;
  authorId: string;
  status: WpStatus;
  date: string;
}

const norm = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const defaultTarget = (title: string): Target => ({
  categoryIds: [],
  slug: slugify(title),
  metaDescription: "",
  authorId: "",
  status: "draft",
  date: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
});

/** Configuração + envio para um site WordPress específico. */
function TargetCard({
  connection,
  title,
  target,
  onChange,
  categoryName,
}: {
  connection: WpConnectionRow;
  title: string;
  target: Target;
  onChange: (t: Target) => void;
  categoryName?: string | undefined;
}) {
  const meta = useWpSiteMeta(connection.id);
  const autoCat = useRef(false);

  // Autopreenche a categoria do site com a categoria escolhida na postagem.
  useEffect(() => {
    if (autoCat.current || !categoryName) return;
    const list = meta.data?.categories ?? [];
    if (list.length === 0) return;
    autoCat.current = true;
    if (target.categoryIds.length > 0) return;
    const match = list.find((c) => norm(c.name) === norm(categoryName));
    if (match) onChange({ ...target, categoryIds: [match.id] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.data?.categories, categoryName]);
  const [newCat, setNewCat] = useState("");
  const createTerm = useServerFn(createWpTerm);
  const [creating, setCreating] = useState(false);

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await createTerm({
        data: { connectionId: connection.id, kind: "categories", name },
      });
      if (!res.ok || !res.term) {
        toast.error(res.error ?? "Não foi possível criar a categoria");
        return;
      }
      onChange({ ...target, categoryIds: [...target.categoryIds, res.term.id] });
      await meta.refetch();
      setNewCat("");
      toast.success(`Categoria "${res.term.name}" disponível em ${connection.name}`);
    } finally {
      setCreating(false);
    }
  };

  const toggleCat = (id: number) =>
    onChange({
      ...target,
      categoryIds: target.categoryIds.includes(id)
        ? target.categoryIds.filter((c) => c !== id)
        : [...target.categoryIds, id],
    });

  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Plug className="size-4 text-primary" /> {connection.name}
        {meta.isFetching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      </div>

      {meta.data?.error && (
        <p className="mb-2 text-xs text-destructive">{meta.data.error}</p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs">Categorias do site</Label>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
            {(meta.data?.categories ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma categoria encontrada.</p>
            )}
            {(meta.data?.categories ?? []).map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={target.categoryIds.includes(c.id)}
                  onCheckedChange={() => toggleCat(c.id)}
                />
                <span className="truncate">
                  {c.name}
                  {typeof c.count === "number" ? ` (${c.count})` : ""}
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="Nova categoria"
              className="h-8 text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={creating || !newCat.trim()}
              onClick={() => void addCategory()}
            >
              Criar
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Slug</Label>
            <Input
              value={target.slug}
              onChange={(e) => onChange({ ...target, slug: e.target.value, slugTouched: true })}
              placeholder={slugify(title)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Meta description (SEO)</Label>
            <Textarea
              value={target.metaDescription}
              onChange={(e) => onChange({ ...target, metaDescription: e.target.value })}
              rows={2}
              className="text-xs"
              placeholder="Resumo de até 160 caracteres (Yoast/RankMath)"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Autor</Label>
              <Select
                value={target.authorId || "default"}
                onValueChange={(v) => onChange({ ...target, authorId: v === "default" ? "" : v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Usuário da conexão</SelectItem>
                  {(meta.data?.authors ?? []).map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status no WordPress</Label>
              <Select
                value={target.status}
                onValueChange={(v) => onChange({ ...target, status: v as WpStatus })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="publish">Publicar agora</SelectItem>
                  <SelectItem value="future">Agendar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {target.status === "future" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Data e hora do agendamento</Label>
              <Input
                type="datetime-local"
                value={target.date}
                onChange={(e) => onChange({ ...target, date: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WpPublishPanel({
  postId,
  title,
  content,
  cover,
  tags,
  blogName,
  categoryName,
  onPublished,
}: {
  postId: string | null;
  title: string;
  content: string;
  cover?: string | undefined;
  tags: string[];
  blogName?: string | undefined;
  categoryName?: string | undefined;
  /** Avisa quando o envio deu certo, com o status escolhido no WordPress. */
  onPublished?: ((info: { wpStatus: WpStatus; date?: string | undefined }) => void) | undefined;
}) {
  const connections = useWpConnections();
  const publications = useWpPublications();
  const { save } = usePublicationMutations();
  const publish = useServerFn(publishWpPost);
  const createTerm = useServerFn(createWpTerm);

  const [selected, setSelected] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [sending, setSending] = useState(false);

  const rows = (connections.data ?? []).filter((c) => c.status !== "erro" || true);
  const autoBlog = useRef(false);

  // Autosseleciona a conexão do blog escolhido no topo do formulário.
  useEffect(() => {
    if (autoBlog.current || !blogName || rows.length === 0) return;
    autoBlog.current = true;
    if (selected.length > 0) return;
    const match =
      rows.find((c) => norm(c.name) === norm(blogName)) ??
      rows.find((c) => norm(c.name).includes(norm(blogName)));
    if (match) {
      setSelected([match.id]);
      setTargets((t) => (t[match.id] ? t : { ...t, [match.id]: defaultTarget(title) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, blogName]);
  // Enquanto o slug não for editado à mão, ele acompanha o título.
  useEffect(() => {
    const auto = slugify(title);
    setTargets((t) => {
      let changed = false;
      const next: Record<string, Target> = {};
      for (const [id, tg] of Object.entries(t)) {
        if (!tg.slugTouched && tg.slug !== auto) {
          next[id] = { ...tg, slug: auto };
          changed = true;
        } else next[id] = tg;
      }
      return changed ? next : t;
    });
  }, [title]);

  // O que vai para o WordPress é o "Artigo Publicação" (revisado pelo ChatGPT).
  const ws = parseWorkspace(content);
  const article = (ws.published.trim() || ws.article).trim();

  // O conteúdo em memória pode estar desatualizado (pipeline grava no servidor).
  const freshArticle = async () => {
    if (article) return article;
    if (!postId) return "";
    const { data } = await supabase.from("posts").select("content").eq("id", postId).maybeSingle();
    const raw = (data as { content?: string } | null)?.content ?? "";
    const w = parseWorkspace(raw);
    return (w.published.trim() || w.article).trim();
  };

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setTargets((t) => (t[id] ? t : { ...t, [id]: defaultTarget(title) }));
  };

  const resolveTags = async (connectionId: string) => {
    const ids: number[] = [];
    for (const name of tags) {
      const res = await createTerm({ data: { connectionId, kind: "tags", name } });
      if (res.ok && res.term) ids.push(res.term.id);
    }
    return ids;
  };

  const send = async () => {
    if (!postId) {
      toast.error("Salve a postagem antes de enviar ao WordPress");
      return;
    }
    if (!title.trim()) {
      toast.error("Informe o título da postagem");
      return;
    }
    if (selected.length === 0) {
      toast.error("Selecione ao menos um blog de destino");
      return;
    }
    setSending(true);
    const body = await freshArticle();
    if (!body) {
      setSending(false);
      toast.error("O Artigo Publicação está vazio — gere o conteúdo antes de publicar");
      return;
    }
    try {
      for (const id of selected) {
        const conn = rows.find((c) => c.id === id);
        const target = targets[id] ?? defaultTarget(title);
        if (!conn) continue;
        const tagIds = await resolveTags(id);
        const res = await publish({
          data: {
            connectionId: id,
            title: title.trim(),
            content: articleToHtml(article),
            status: target.status,
            ...(target.status === "future" ? { date: target.date } : {}),
            ...(target.slug ? { slug: slugify(target.slug) } : {}),
            ...(target.metaDescription ? { metaDescription: target.metaDescription } : {}),
            ...(target.categoryIds.length ? { categories: target.categoryIds } : {}),
            ...(tagIds.length ? { tags: tagIds } : {}),
            ...(target.authorId ? { authorId: Number(target.authorId) } : {}),
            ...(cover ? { cover, coverFileName: slugify(title) || "capa" } : {}),
          },
        });

        await save.mutateAsync({
          post_id: postId,
          connection_id: id,
          title: title.trim(),
          wp_post_id: res.wpPostId ?? null,
          wp_link: res.link ?? null,
          status: res.ok ? (res.status ?? "rascunho") : "falhou",
          scheduled_at:
            target.status === "future" ? new Date(target.date).toISOString() : null,
          error: res.ok ? null : (res.error ?? "Erro desconhecido"),
        });

        if (res.ok) {
          toast.success(`${conn.name}: enviado com sucesso`);
          onPublished?.({
            wpStatus: target.status,
            date: target.status === "future" ? target.date : undefined,
          });
        } else toast.error(`${conn.name}: ${res.error}`);
      }
    } finally {
      setSending(false);
    }
  };

  const existing = (publications.data ?? []).filter((p) => postId && p.post_id === postId);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
        Nenhuma conexão WordPress cadastrada. Cadastre seus sites em “Conexões WordPress”.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {rows.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              selected.includes(c.id)
                ? "border-primary bg-primary/10 text-primary"
                : "hover:bg-accent",
            )}
          >
            <Checkbox checked={selected.includes(c.id)} className="pointer-events-none" />
            {c.name}
          </button>
        ))}
      </div>

      {selected.map((id) => {
        const conn = rows.find((c) => c.id === id);
        if (!conn) return null;
        return (
          <TargetCard
            key={id}
            connection={conn}
            title={title}
            target={targets[id] ?? defaultTarget(title)}
            categoryName={categoryName}
            onChange={(t) => setTargets((prev) => ({ ...prev, [id]: t }))}
          />
        );
      })}

      {existing.length > 0 && (
        <div className="space-y-1 text-xs text-muted-foreground">
          {existing.map((p) => {
            const conn = rows.find((c) => c.id === p.connection_id);
            return (
              <div key={p.id} className="flex items-center gap-2">
                <span className="font-medium">{conn?.name ?? "Conexão removida"}:</span>
                <span>{p.status}</span>
                {p.wp_link && (
                  <a
                    href={p.wp_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline"
                  >
                    ver no site <ExternalLink className="size-3" />
                  </a>
                )}
                {p.error && <span className="text-destructive">{p.error}</span>}
              </div>
            );
          })}
        </div>
      )}

      <Button
        type="button"
        className="gap-2"
        disabled={sending || selected.length === 0}
        onClick={() => void send()}
      >
        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Enviar para o WordPress
      </Button>
      {!postId && (
        <p className="text-xs text-muted-foreground">
          Salve a postagem primeiro para habilitar o envio e o histórico.
        </p>
      )}
    </div>
  );
}
