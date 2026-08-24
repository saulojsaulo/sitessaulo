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

const adminUrl = (url: string) => `${normalizeUrl(url)}/wp-admin`;
const appPasswordsUrl = (url: string) =>
  `${normalizeUrl(url)}/wp-admin/profile.php#application-passwords`;

const GUIDE_KEY = "postflow.wpGuide.open";

const GUIDE_STEPS: { title: string; body: string }[] = [
  {
    title: "Abra o painel do blog como Administrador",
    body: "Acesse o wp-admin do site com um usuário que possa publicar posts (Administrador ou Editor).",
  },
  {
    title: "Confira os requisitos",
    body: "WordPress 5.6 ou superior, site em HTTPS e permalinks amigáveis (Configurações → Links permanentes, qualquer opção diferente de “Simples”).",
  },
  {
    title: "Vá em Usuários → Perfil → Senhas de aplicativo",
    body: "Role a página do perfil até a seção “Senhas de aplicativo” (Application Passwords).",
  },
  {
    title: "Crie a senha com o nome PostFlow",
    body: "Digite PostFlow no campo de nome e clique em “Adicionar nova senha de aplicativo”. Copie o valor gerado — ele aparece uma única vez.",
  },
  {
    title: "Copie o login do usuário",
    body: "Use o nome de usuário (login) do WordPress, não o e-mail nem o nome de exibição.",
  },
  {
    title: "Volte ao PostFlow e clique em Nova conexão",
    body: "Escolha o blog cadastrado (nome e URL vêm automaticamente) e cole usuário e Application Password.",
  },
  {
    title: "Teste e salve",
    body: "Clique em “Testar conexão”: o status vira Conectado quando as credenciais funcionam. Depois salve.",
  },
];

const GUIDE_TROUBLESHOOT: { problem: string; fix: string }[] = [
  {
    problem: "Não aparece a seção “Senhas de aplicativo”",
    fix: "Normalmente é site sem HTTPS ou um plugin de segurança (Wordfence, Solid/iThemes) bloqueando a REST API. Libere /wp-json/ e ative Application Passwords.",
  },
  {
    problem: "Erro rest_no_route",
    fix: "Permalinks estão em “Simples”. Troque em Configurações → Links permanentes e salve.",
  },
  {
    problem: "Credenciais inválidas",
    fix: "Confira o login (não o e-mail) e cole a Application Password, nunca a senha de login. Espaços na senha podem ser mantidos.",
  },
  {
    problem: "Sem permissão para publicar",
    fix: "O usuário precisa ser Administrador ou Editor no WordPress.",
  },
];

function SetupGuide({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return defaultOpen;
    const saved = window.localStorage.getItem(GUIDE_KEY);
    return saved === null ? defaultOpen : saved === "1";
  });

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (typeof window !== "undefined") window.localStorage.setItem(GUIDE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <div className="surface mb-5 overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold"
      >
        <HelpCircle className="size-4 text-primary" />
        Como conectar um blog (passo a passo)
        {open ? (
          <ChevronUp className="ml-auto size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-auto size-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-border px-4 py-4">
          <ol className="grid gap-3 sm:grid-cols-2">
            {GUIDE_STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Se algo der errado
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {GUIDE_TROUBLESHOOT.map((t) => (
                <li key={t.problem} className="text-xs">
                  <span className="font-medium">{t.problem}:</span>{" "}
                  <span className="text-muted-foreground">{t.fix}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}


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

  const startCreate = (blogId?: string) => {
    setEditing(null);
    const blog = blogId ? blogs.find((b) => b.id === blogId) : null;
    setDraft(
      blog
        ? { ...emptyDraft, blogId: blog.id, name: blog.name, site_url: normalizeUrl(blog.url) }
        : emptyDraft,
    );
    setOpen(true);
  };


  const blogFor = (c: WpConnectionRow) =>
    blogs.find((b) => normalizeUrl(b.url) === normalizeUrl(c.site_url) || b.name === c.name) ?? null;

  const connFor = (url: string) =>
    rows.find((c) => normalizeUrl(c.site_url) === normalizeUrl(url)) ?? null;


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
          <Button onClick={() => startCreate()} className="gap-2">
            <Plus className="size-4" /> Nova conexão
          </Button>
        }
      />

      <SetupGuide defaultOpen={rows.length === 0} />

      {blogs.length > 0 && (
        <div className="surface mb-5 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
            <KeyRound className="size-4 text-primary" />
            Progresso por blog
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {blogs.filter((b) => connFor(b.url)?.status === "conectado").length}/{blogs.length}{" "}
              conectados
            </span>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {blogs.map((b) => {
              const conn = connFor(b.url);
              return (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{b.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{b.url}</p>
                  </div>
                  {conn ? (
                    <StatusPill status={conn.status} />
                  ) : (
                    <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      Sem conexão
                    </span>
                  )}
                  <Button variant="ghost" size="sm" className="gap-1.5" asChild>
                    <a href={appPasswordsUrl(b.url)} target="_blank" rel="noreferrer">
                      <KeyRound className="size-4" />
                      <span className="hidden sm:inline">Senhas</span>
                    </a>
                  </Button>
                  {conn ? (
                    <Button variant="ghost" size="sm" onClick={() => startEdit(conn)}>
                      <Pencil className="size-4" />
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => startCreate(b.id)}>
                      Conectar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Plug className="size-7" />}
          title="Nenhum site WordPress conectado"
          description="Selecione um dos blogs já cadastrados no sistema e informe usuário e Application Password (WordPress 5.6+) para publicar e agendar direto daqui."
          action={
            <Button onClick={() => startCreate()} className="mt-2 gap-2">
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
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Site: {draft.site_url}</span>
                  <a
                    href={appPasswordsUrl(draft.site_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline"
                  >
                    <KeyRound className="size-3.5" /> abrir senhas de aplicativo neste site
                  </a>
                  <a
                    href={adminUrl(draft.site_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline"
                  >
                    <ExternalLink className="size-3.5" /> wp-admin
                  </a>
                </div>
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
                <p className="text-xs text-muted-foreground">
                  O login do WordPress, não o e-mail.
                </p>
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
                <p className="text-xs text-muted-foreground">
                  Pode colar com os espaços, como o WordPress mostra.
                </p>
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
