import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Globe,
  Pencil,
  Plus,
  Trash2,
  Newspaper,
  FolderTree,
  FileText,
  ChevronRight,
  ExternalLink,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImagePicker } from "@/components/image-picker";
import { ConfirmDelete } from "@/components/confirm-delete";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui-bits";
import { Delta, LiveDot, Sparkline } from "@/components/metric-bits";
import { useStore } from "@/lib/store";
import {
  daysAgo,
  fmtInt,
  iso,
  propertyIdFor,
  useBlogProperties,
  useGa4Summaries,
} from "@/lib/use-ga4";
import {
  BLOG_COLORS,
  STATUS_LABEL,
  siteUrl,
  wpAdminUrl,
  type Blog,
  type PostStatus,
} from "@/lib/types";

export const Route = createFileRoute("/blogs")({
  head: () => ({
    meta: [
      { title: "Blogs — PostFlow" },
      { name: "description", content: "Cadastre, edite e alterne entre os seus blogs." },
      { property: "og:title", content: "Blogs — PostFlow" },
      {
        property: "og:description",
        content: "Gerencie nome, domínio, descrição e logo de cada blog.",
      },
    ],
  }),
  component: BlogsPage,
});

interface Draft {
  name: string;
  url: string;
  description: string;
  logo?: string | undefined;
  color: string;
}

const emptyDraft: Draft = { name: "", url: "", description: "", color: BLOG_COLORS[0]! };

function BlogsPage() {
  const { blogs, categories, posts, addBlog, updateBlog, removeBlog, setActiveBlogId, activeBlog } =
    useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Blog | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"status" | "categoria">("status");

  const gaProps = useBlogProperties();
  const gaIds = (gaProps.data ?? [])
    .map((p) => p.ga4_property_id.trim())
    .filter((id) => id !== "");
  const gaSummaries = useGa4Summaries(gaIds, daysAgo(28), iso(new Date()));
  const statsFor = (blog: Blog) => {
    const pid = propertyIdFor(gaProps.data, blog);
    if (!pid) return null;
    const s = (gaSummaries.data ?? []).find((x) => x.propertyId === pid);
    return s?.ok ? s : null;
  };

  const startCreate = () => {
    setEditing(null);
    setDraft({ ...emptyDraft, color: BLOG_COLORS[blogs.length % BLOG_COLORS.length]! });
    setOpen(true);
  };

  const startEdit = (blog: Blog) => {
    setEditing(blog);
    setDraft({
      name: blog.name,
      url: blog.url,
      description: blog.description,
      logo: blog.logo,
      color: blog.color,
    });
    setOpen(true);
  };

  const save = () => {
    if (!draft.name.trim()) {
      toast.error("Informe o nome do blog");
      return;
    }
    if (editing) {
      updateBlog(editing.id, draft);
      toast.success("Blog atualizado");
    } else {
      addBlog(draft);
      toast.success("Blog criado");
    }
    setOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Blogs"
        subtitle={`${blogs.length} blog(s) cadastrado(s)`}
        action={
          <Button onClick={startCreate} className="gap-2">
            <Plus className="size-4" /> Novo blog
          </Button>
        }
      />

      {blogs.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="size-7" />}
          title="Nenhum blog cadastrado"
          description="Cadastre seu primeiro blog para começar a organizar categorias e postagens."
          action={
            <Button onClick={startCreate} className="mt-2 gap-2">
              <Plus className="size-4" /> Cadastrar blog
            </Button>
          }
        />
      ) : (
        <div className="surface divide-y overflow-hidden">
          {blogs.map((blog) => {
            const blogCats = categories.filter((c) => c.blogId === blog.id);
            const blogPosts = posts.filter((p) => p.blogId === blog.id);
            const isActive = activeBlog?.id === blog.id;
            const isOpen = expanded === blog.id;
            const site = siteUrl(blog.url);
            const wp = wpAdminUrl(blog.url);
            const groups: { key: string; label: string; status?: PostStatus; catId?: string }[] =
              groupBy === "status"
                ? (Object.keys(STATUS_LABEL) as PostStatus[]).map((s) => ({
                    key: s,
                    label: STATUS_LABEL[s],
                    status: s,
                  }))
                : [
                    ...blogCats.map((c) => ({ key: c.id, label: c.name, catId: c.id })),
                    { key: "none", label: "Sem categoria", catId: "none" },
                  ];
            return (
              <div key={blog.id} style={isActive ? { background: "var(--color-accent)" } : undefined}>
                <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : blog.id)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <ChevronRight
                      className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                    <span
                      className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg text-[11px] font-bold text-primary-foreground"
                      style={{ background: blog.color }}
                    >
                      {blog.logo ? (
                        <img src={blog.logo} alt="" className="size-full object-cover" />
                      ) : (
                        blog.name.slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{blog.name}</span>
                      <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Globe className="size-3" />
                        {blog.url || "sem domínio"}
                      </span>
                    </span>
                    <span className="hidden gap-3 text-xs text-muted-foreground sm:flex">
                      <span className="inline-flex items-center gap-1">
                        <FolderTree className="size-3.5" /> {blogCats.length}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FileText className="size-3.5" /> {blogPosts.length}
                      </span>
                    </span>
                    {(() => {
                      const s = statsFor(blog);
                      if (!s) return null;
                      return (
                        <span className="hidden items-center gap-3 text-xs md:flex">
                          <Sparkline values={s.timeseries.map((t) => t.sessions)} />
                          <span
                            className="tabular-nums font-medium"
                            title="Sessões nos últimos 28 dias"
                          >
                            {fmtInt(s.kpis.sessions)}
                          </span>
                          <Delta current={s.kpis.sessions} previous={s.prevKpis.sessions} />
                          <LiveDot users={s.activeNow} />
                        </span>
                      );
                    })()}
                  </button>
                  <div className="flex items-center gap-1.5">
                    {site ? (
                      <Button asChild size="sm" variant="secondary" className="gap-1.5 text-xs">
                        <a href={site} target="_blank" rel="noreferrer noopener">
                          <ExternalLink className="size-3.5" /> Visitar o Site
                        </a>
                      </Button>
                    ) : null}
                    {wp ? (
                      <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
                        <a href={wp} target="_blank" rel="noreferrer noopener">
                          <LogIn className="size-3.5" /> Fazer Login WP
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant={isActive ? "default" : "ghost"}
                      className="text-xs"
                      onClick={() => {
                        setActiveBlogId(blog.id);
                        toast.success(`${blog.name} selecionado`);
                      }}
                    >
                      {isActive ? "Selecionado" : "Selecionar"}
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => startEdit(blog)}>
                      <Pencil className="size-4" />
                    </Button>
                    <ConfirmDelete
                      title={`Excluir ${blog.name}?`}
                      description="As categorias e postagens deste blog também serão excluídas. Esta ação não pode ser desfeita."
                      onConfirm={() => {
                        removeBlog(blog.id);
                        toast.success("Blog excluído");
                      }}
                      trigger={
                        <Button size="icon" variant="ghost" className="size-8 text-destructive">
                          <Trash2 className="size-4" />
                        </Button>
                      }
                    />
                  </div>
                </div>

                {isOpen ? (
                  <div className="border-t bg-card/60 px-3 py-3">
                    <div className="mb-3 flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Agrupar por:</span>
                      {(["status", "categoria"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGroupBy(g)}
                          className={`rounded-md border px-2 py-0.5 capitalize transition-colors ${
                            groupBy === g
                              ? "border-primary/30 bg-primary/12 text-primary"
                              : "text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                      <Link
                        to="/postagens"
                        search={{ blog: blog.id }}
                        className="ml-auto text-primary hover:underline"
                      >
                        Ver todas as postagens
                      </Link>
                    </div>

                    {blogPosts.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        Nenhuma postagem neste blog ainda.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {groups.map((g) => {
                          const list = blogPosts.filter((p) =>
                            g.status
                              ? p.status === g.status
                              : g.catId === "none"
                                ? !p.categoryId
                                : p.categoryId === g.catId,
                          );
                          if (list.length === 0) return null;
                          return (
                            <div key={g.key} className="rounded-lg border">
                              <div className="flex items-center justify-between gap-2 border-b px-2.5 py-1.5">
                                {g.status ? (
                                  <StatusBadge status={g.status} />
                                ) : (
                                  <span className="text-xs font-medium">{g.label}</span>
                                )}
                                <Link
                                  to="/postagens"
                                  search={
                                    g.status
                                      ? { blog: blog.id, status: g.status }
                                      : { blog: blog.id, categoria: g.catId ?? "none" }
                                  }
                                  className="text-xs text-muted-foreground hover:text-primary"
                                >
                                  {list.length} postagem(ns) →
                                </Link>
                              </div>
                              <ul className="divide-y">
                                {list.slice(0, 8).map((p) => (
                                  <li
                                    key={p.id}
                                    className="flex items-center gap-3 px-2.5 py-1.5 text-xs"
                                  >
                                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                                    <span className="shrink-0 text-muted-foreground">
                                      {p.publishDate}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar blog" : "Novo blog"}</DialogTitle>
            <DialogDescription>
              Defina as informações principais que identificam este blog.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="blog-name">Nome</Label>
              <Input
                id="blog-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Meu blog de tecnologia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blog-url">URL / domínio</Label>
              <Input
                id="blog-url"
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                placeholder="meublog.com.br"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blog-desc">Descrição curta</Label>
              <Textarea
                id="blog-desc"
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Sobre o que este blog fala?"
              />
            </div>
            <div className="space-y-2">
              <Label>Logo / ícone</Label>
              <ImagePicker
                value={draft.logo}
                label="Logo"
                aspect="square"
                onChange={(logo) => setDraft({ ...draft, logo })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cor de identificação</Label>
              <div className="flex gap-2">
                {BLOG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    onClick={() => setDraft({ ...draft, color: c })}
                    className="size-8 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: c,
                      outline: draft.color === c ? "2px solid var(--color-ring)" : "none",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>{editing ? "Salvar alterações" : "Criar blog"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}