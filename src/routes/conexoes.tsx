import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  HelpCircle,
  KeyRound,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/confirm-delete";
import { EmptyState, PageHeader } from "@/components/ui-bits";
import { testWpConnection, testWpCredentials } from "@/lib/wp.functions";
import {
  useConnectionMutations,
  useWpConnections,
  useWpPublications,
} from "@/lib/use-wp";
import { WP_CONNECTION_LABEL, type WpConnectionRow, type WpConnectionStatus } from "@/lib/wp-types";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conexoes")({
  head: () => ({
    meta: [
      { title: "Conexões WordPress — PostFlow" },
      {
        name: "description",
        content:
          "Cadastre e teste as credenciais dos seus sites WordPress via REST API e Application Passwords.",
      },
      { property: "og:title", content: "Conexões WordPress — PostFlow" },
      {
        property: "og:description",
        content: "Gerencie até 10 sites WordPress e publique direto do PostFlow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConnectionsPage,
});

const statusTone: Record<WpConnectionStatus, string> = {
  conectado: "bg-success/15 text-success border-success/30",
  erro: "bg-destructive/15 text-destructive border-destructive/30",
  nao_testado: "bg-muted text-muted-foreground border-border",
};

function StatusPill({ status }: { status: WpConnectionStatus }) {
  const Icon = status === "conectado" ? CheckCircle2 : status === "erro" ? XCircle : AlertTriangle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusTone[status],
      )}
    >
      <Icon className="size-3.5" /> {WP_CONNECTION_LABEL[status]}
    </span>
  );
}

interface Draft {
  blogId: string;
  name: string;
  site_url: string;
  username: string;
  app_password: string;
}

const emptyDraft: Draft = { blogId: "", name: "", site_url: "", username: "", app_password: "" };

const normalizeUrl = (url: string) => {
  const clean = url.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
};

function ConnectionsPage() {
  const { blogs } = useStore();
  const connections = useWpConnections();
  const publications = useWpPublications();
  const { create, update, remove } = useConnectionMutations();
  const testCreds = useServerFn(testWpCredentials);
  const testSaved = useServerFn(testWpConnection);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WpConnectionRow | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [testing, setTesting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const rows = connections.data ?? [];
  const pubs = publications.data ?? [];
  const scheduledFor = (id: string) =>
    pubs.filter((p) => p.connection_id === id && p.status === "agendado").length;

  const startCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setOpen(true);
  };

  const blogFor = (c: WpConnectionRow) =>
    blogs.find((b) => normalizeUrl(b.url) === normalizeUrl(c.site_url) || b.name === c.name) ?? null;

  const startEdit = (c: WpConnectionRow) => {
    setEditing(c);
    setDraft({
      blogId: blogFor(c)?.id ?? "",
      name: c.name,
      site_url: c.site_url,
      username: c.username,
      app_password: c.app_password,
    });
    setOpen(true);
  };

  /** Blogs cadastrados que ainda não possuem conexão WordPress. */
  const availableBlogs = blogs.filter(
    (b) => !rows.some((c) => c.id !== editing?.id && normalizeUrl(c.site_url) === normalizeUrl(b.url)),
  );

  const pickBlog = (blogId: string) => {
    const blog = blogs.find((b) => b.id === blogId);
    if (!blog) return;
    setDraft((d) => ({ ...d, blogId, name: blog.name, site_url: normalizeUrl(blog.url) }));
  };

  const runTest = async (): Promise<WpConnectionStatus> => {
    if (!draft.site_url.trim() || !draft.username.trim() || !draft.app_password.trim()) {
      toast.error("Preencha URL, usuário e Application Password");
      return "nao_testado";
    }
    setTesting(true);
    try {
      const res = await testCreds({
        data: {
          siteUrl: draft.site_url.trim(),
          username: draft.username.trim(),
          appPassword: draft.app_password,
        },
      });
      if (res.ok) {
        toast.success(`Conectado como ${res.user}`);
        return "conectado";
      }
      toast.error(res.error ?? "Falha na conexão");
      return "erro";
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    if (!draft.blogId || !draft.site_url.trim()) {
      toast.error("Selecione o blog cadastrado no sistema");
      return;
    }
    const status = await runTest();
    const payload = {
      name: draft.name.trim(),
      site_url: normalizeUrl(draft.site_url),
      username: draft.username.trim(),
      app_password: draft.app_password.trim(),
      status,
      last_error: status === "erro" ? "Falha no último teste de conexão" : null,
      last_tested_at: status === "nao_testado" ? null : new Date().toISOString(),
    };
    if (editing) {
      await update.mutateAsync({ id: editing.id, patch: payload });
      toast.success("Conexão atualizada");
    } else {
      await create.mutateAsync(payload);
      toast.success("Conexão cadastrada");
    }
    setOpen(false);
  };

  const retest = async (c: WpConnectionRow) => {
    setTestingId(c.id);
    try {
      const res = await testSaved({ data: { connectionId: c.id } });
      await update.mutateAsync({
        id: c.id,
        patch: {
          status: res.ok ? "conectado" : "erro",
          last_error: res.ok ? null : (res.error ?? "Erro desconhecido"),
          last_tested_at: new Date().toISOString(),
        },
      });
      if (res.ok) toast.success(`${c.name}: conectado como ${res.user}`);
      else toast.error(`${c.name}: ${res.error}`);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Conexões WordPress"
        subtitle={`${rows.length} site(s) conectado(s) via REST API`}
        action={
          <Button onClick={startCreate} className="gap-2">
            <Plus className="size-4" /> Nova conexão
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Plug className="size-7" />}
          title="Nenhum site WordPress conectado"
          description="Selecione um dos blogs já cadastrados no sistema e informe usuário e Application Password (WordPress 5.6+) para publicar e agendar direto daqui."
          action={
            <Button onClick={startCreate} className="mt-2 gap-2">
              <Plus className="size-4" /> Nova conexão
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((c) => (
            <div
              key={c.id}
              className="surface flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold">{c.name}</span>
                  <StatusPill status={c.status} />
                  {scheduledFor(c.id) > 0 && (
                    <span className="rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                      {scheduledFor(c.id)} agendada(s)
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {c.site_url} · usuário {c.username}
                  {c.status === "erro" && c.last_error ? ` · ${c.last_error}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  disabled={testingId === c.id}
                  onClick={() => void retest(c)}
                >
                  <RefreshCw className={cn("size-4", testingId === c.id && "animate-spin")} />
                  Testar
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a href={`${c.site_url}/wp-admin`} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>
                  <Pencil className="size-4" />
                </Button>
                <ConfirmDelete
                  trigger={
                    <Button variant="ghost" size="sm" className="text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  }
                  title={`Excluir "${c.name}"?`}
                  description={
                    scheduledFor(c.id) > 0
                      ? `Atenção: existem ${scheduledFor(c.id)} postagem(ns) agendada(s) vinculada(s) a esta conexão. O histórico de agendamentos será removido do PostFlow (os posts já enviados continuam no WordPress).`
                      : "A conexão será removida. Posts já enviados continuam no WordPress."
                  }
                  onConfirm={() => {
                    void remove.mutateAsync(c.id).then(() => toast.success("Conexão excluída"));
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        As credenciais são usadas apenas no servidor do PostFlow para falar com a REST API
        (<code>/wp-json/wp/v2</code>). Veja as postagens enviadas em{" "}
        <Link to="/agendadas" className="text-primary underline">
          Postagens Agendadas
        </Link>
        .
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar conexão" : "Nova conexão WordPress"}</DialogTitle>
            <DialogDescription>
              Use uma Application Password (Usuários → Perfil → Application Passwords no
              WordPress). Nunca use a senha normal de login.
            </DialogDescription>
          </DialogHeader>
          {editing && scheduledFor(editing.id) > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              Existem {scheduledFor(editing.id)} postagem(ns) agendada(s) nesta conexão. Alterar as
              credenciais pode afetar reenvios.
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Blog cadastrado</Label>
              <Select value={draft.blogId} onValueChange={pickBlog}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um blog do sistema" />
                </SelectTrigger>
                <SelectContent>
                  {availableBlogs.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} — {b.url}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableBlogs.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Todos os blogs cadastrados já possuem conexão. Cadastre um novo blog em{" "}
                  <Link to="/blogs" className="text-primary underline">
                    Blogs
                  </Link>
                  .
                </p>
              )}
              {draft.site_url && (
                <p className="text-xs text-muted-foreground">Site: {draft.site_url}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wp-user">Usuário WordPress</Label>
                <Input
                  id="wp-user"
                  value={draft.username}
                  onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wp-pass">Application Password</Label>
                <Input
                  id="wp-pass"
                  type="password"
                  value={draft.app_password}
                  onChange={(e) => setDraft({ ...draft, app_password: e.target.value })}
                  placeholder="xxxx xxxx xxxx xxxx"
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="secondary"
              className="gap-2"
              disabled={testing}
              onClick={() => void runTest()}
            >
              <RefreshCw className={cn("size-4", testing && "animate-spin")} /> Testar conexão
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void save()} disabled={testing}>
                {editing ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
