import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { articleToHtml, slugify } from "@/lib/wp-types";
import { createWpTerm, publishWpPost } from "@/lib/wp.functions";
import { usePublicationMutations, useWpConnections } from "@/lib/use-wp";

interface Props {
  postId: string | null;
  title: string;
  article: string;
  cover?: string | undefined;
  tags?: string[] | undefined;
  onStatusChange?: (status: "agendado" | "publicado") => void;
}

const defaultDate = () =>
  new Date(Date.now() + 60 * 60 * 1000 - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

/** Publicar agora / agendar o Artigo Pronto direto nos sites conectados. */
export function QuickPublish({ postId, title, article, cover, tags }: Props) {
  const connections = useWpConnections();
  const { save } = usePublicationMutations();
  const publish = useServerFn(publishWpPost);
  const createTerm = useServerFn(createWpTerm);

  const [mode, setMode] = useState<"publish" | "future" | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(defaultDate());
  const [sending, setSending] = useState(false);

  const rows = connections.data ?? [];
  const ready = Boolean(article.trim());

  const openDialog = (next: "publish" | "future") => {
    if (!postId) {
      toast.error("Salve a postagem antes de publicar no WordPress");
      return;
    }
    if (!title.trim()) {
      toast.error("Informe o título da postagem");
      return;
    }
    if (!ready) {
      toast.error("O Artigo Pronto está vazio");
      return;
    }
    if (rows.length === 0) {
      toast.error("Cadastre uma conexão em “Conexões WordPress” primeiro");
      return;
    }
    setSelected((s) => (s.length ? s : rows[0] ? [rows[0].id] : []));
    setDate(defaultDate());
    setMode(next);
  };

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const send = async () => {
    if (!mode || !postId) return;
    if (selected.length === 0) {
      toast.error("Selecione ao menos um blog de destino");
      return;
    }
    if (mode === "future" && !date) {
      toast.error("Informe a data e hora do agendamento");
      return;
    }
    setSending(true);
    try {
      for (const id of selected) {
        const conn = rows.find((c) => c.id === id);
        if (!conn) continue;

        const tagIds: number[] = [];
        for (const name of tags ?? []) {
          const res = await createTerm({ data: { connectionId: id, kind: "tags", name } });
          if (res.ok && res.term) tagIds.push(res.term.id);
        }

        const res = await publish({
          data: {
            connectionId: id,
            title: title.trim(),
            content: articleToHtml(article.trim()),
            status: mode,
            slug: slugify(title),
            ...(mode === "future" ? { date } : {}),
            ...(tagIds.length ? { tags: tagIds } : {}),
            ...(cover ? { cover, coverFileName: `${slugify(title)}.webp` } : {}),
          },
        });

        await save.mutateAsync({
          post_id: postId,
          connection_id: id,
          title: title.trim(),
          wp_post_id: res.wpPostId ?? null,
          wp_link: res.link ?? null,
          status: res.ok ? (res.status ?? "rascunho") : "falhou",
          scheduled_at: mode === "future" ? new Date(date).toISOString() : null,
          error: res.ok ? null : (res.error ?? "Erro desconhecido"),
        });

        if (res.ok)
          toast.success(
            mode === "future"
              ? `${conn.name}: agendado para ${new Date(date).toLocaleString("pt-BR")}`
              : `${conn.name}: publicado com sucesso`,
          );
        else toast.error(`${conn.name}: ${res.error}`);
      }
      setMode(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        className="gap-2"
        disabled={!ready}
        onClick={() => openDialog("publish")}
      >
        <Send className="size-4" /> Publicar Agora
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="gap-2"
        disabled={!ready}
        onClick={() => openDialog("future")}
      >
        <CalendarClock className="size-4" /> Agendar Publicação
      </Button>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === "future" ? "Agendar publicação" : "Publicar agora"}
            </DialogTitle>
            <DialogDescription>
              O Artigo Pronto será enviado para os sites WordPress selecionados
              {mode === "future" ? " na data e hora escolhidas." : " imediatamente."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Blogs de destino</Label>
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
            </div>

            {mode === "future" && (
              <div className="space-y-2">
                <Label htmlFor="quick-date" className="text-xs">
                  Data e hora da publicação
                </Label>
                <Input
                  id="quick-date"
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setMode(null)} disabled={sending}>
              Cancelar
            </Button>
            <Button className="gap-2" disabled={sending} onClick={() => void send()}>
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : mode === "future" ? (
                <CalendarClock className="size-4" />
              ) : (
                <Send className="size-4" />
              )}
              {mode === "future" ? "Agendar" : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
