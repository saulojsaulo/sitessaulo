import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  ArrowUpDown,
  Sparkles,
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
import { RichTextEditor } from "@/components/rich-text-editor";
import { TagInput } from "@/components/tag-input";
import { ImagePicker } from "@/components/image-picker";
import { ConfirmDelete } from "@/components/confirm-delete";
import { EmptyState, PageHeader, StatusBadge, TagChip } from "@/components/ui-bits";
import { useStore } from "@/lib/store";
import { STATUS_LABEL, type Post, type PostStatus } from "@/lib/types";

export const Route = createFileRoute("/postagens")({
  head: () => ({
    meta: [
      { title: "Postagens — PostFlow" },
      {
        name: "description",
        content: "Cadastre postagens com editor rico, tags, capa, status e data de publicação.",
      },
      { property: "og:title", content: "Postagens — PostFlow" },
      {
        property: "og:description",
        content: "Liste, filtre e ordene todas as postagens dos seus blogs.",
      },
    ],
  }),
  component: PostsPage,
});

interface Draft {
  blogId: string;
  categoryId?: string | undefined;
  title: string;
  content: string;
  tags: string[];
  status: PostStatus;
  publishDate: string;
  cover?: string | undefined;
}

const today = () => new Date().toISOString().slice(0, 10);

const buildStructurePrompt = (title: string) =>
  `Gere uma outline (estrutura de artigo para blog) com a palavra-chave "${title}".\n\nPara cada seção da estrutura (título + subtítulos), enumere cada seção, título é "1" por exemplo e Subtítulo "1.1". Adicione acima do título da sessão o seguinte prompt — lembre-se, o prompt abaixo vai acima do título da sessão, e não dos subtítulos:\n"Gere o texto para a seção do blog (na frente do Título adicione "##" e na frente de cada subtítulo adicione "###":"`;

function PostsPage() {
  const {
    blogs,
    categories,
    posts,
    activeBlog,
    allTags,
    addPost,
    updatePost,
    removePost,
  } = useStore();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const [blogFilter, setBlogFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("date-desc");

  const blogName = (id: string) => blogs.find((b) => b.id === id)?.name ?? "—";
  const catName = (id?: string) => categories.find((c) => c.id === id)?.name ?? "Sem categoria";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = posts.filter((p) => {
      if (blogFilter !== "all" && p.blogId !== blogFilter) return false;
      if (catFilter !== "all" && p.categoryId !== catFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (tagFilter !== "all" && !p.tags.includes(tagFilter)) return false;
      if (q) {
        const hit =
          p.title.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      switch (sort) {
        case "date-asc":
          return a.publishDate.localeCompare(b.publishDate);
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        case "status":
          return a.status.localeCompare(b.status);
        default:
          return b.publishDate.localeCompare(a.publishDate);
      }
    });
  }, [posts, blogFilter, catFilter, statusFilter, tagFilter, query, sort]);

  const startCreate = () => {
    if (!activeBlog) {
      toast.error("Cadastre um blog primeiro");
      return;
    }
    setEditing(null);
    setDraft({
      blogId: activeBlog.id,
      title: "",
      content: "",
      tags: [],
      status: "rascunho",
      publishDate: today(),
    });
    setOpen(true);
  };

  const startEdit = (p: Post) => {
    setEditing(p);
    setDraft({
      blogId: p.blogId,
      categoryId: p.categoryId,
      title: p.title,
      content: p.content,
      tags: p.tags,
      status: p.status,
      publishDate: p.publishDate,
      cover: p.cover,
    });
    setOpen(true);
  };

  const save = () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      toast.error("Informe o título da postagem");
      return;
    }
    if (editing) {
      updatePost(editing.id, draft);
      toast.success("Postagem atualizada");
    } else {
      addPost(draft);
      toast.success("Postagem criada");
    }
    setOpen(false);
  };

  const draftCategories = categories.filter((c) => c.blogId === draft?.blogId);

  const generateStructurePrompt = async () => {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) {
      toast.error("Preencha o título antes de gerar o prompt");
      return;
    }
    const text = buildStructurePrompt(title);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Prompt copiado!");
    } catch {
      toast.error("Não foi possível copiar o prompt");
    }
    setDraft({ ...draft, status: "estrutura" });
    if (editing) {
      updatePost(editing.id, { status: "estrutura" });
      setEditing({ ...editing, status: "estrutura" });
    }
  };

  return (
    <>
      <PageHeader
        title="Postagens"
        subtitle={`${filtered.length} de ${posts.length} postagens`}
        action={
          <Button onClick={startCreate} className="gap-2">
            <Plus className="size-4" /> Nova postagem
          </Button>
        }
      />

      <div className="surface mb-6 grid gap-3 p-4 md:grid-cols-3 lg:grid-cols-5">
        <div className="relative md:col-span-3 lg:col-span-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título ou tag"
            className="pl-9"
            aria-label="Buscar postagens"
          />
        </div>
        <Select value={blogFilter} onValueChange={setBlogFilter}>
          <SelectTrigger aria-label="Filtrar por blog">
            <SelectValue placeholder="Blog" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os blogs</SelectItem>
            {blogs.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger aria-label="Filtrar por categoria">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories
              .filter((c) => blogFilter === "all" || c.blogId === blogFilter)
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(STATUS_LABEL) as PostStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger aria-label="Filtrar por palavra-chave">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tags</SelectItem>
              {allTags.map((t) => (
                <SelectItem key={t} value={t}>
                  #{t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger aria-label="Ordenar" className="w-11 px-0 [&>svg:last-child]:hidden">
              <ArrowUpDown className="mx-auto size-4" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="date-desc">Data (mais recente)</SelectItem>
              <SelectItem value="date-asc">Data (mais antiga)</SelectItem>
              <SelectItem value="title-asc">Título (A–Z)</SelectItem>
              <SelectItem value="title-desc">Título (Z–A)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-7" />}
          title="Nenhuma postagem cadastrada"
          description="Crie sua primeira postagem com título, conteúdo, capa e palavras-chave."
          action={
            blogs.length === 0 ? (
              <Button asChild className="mt-2">
                <Link to="/blogs">Cadastrar um blog</Link>
              </Button>
            ) : (
              <Button onClick={startCreate} className="mt-2 gap-2">
                <Plus className="size-4" /> Nova postagem
              </Button>
            )
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="size-7" />}
          title="Nada encontrado"
          description="Ajuste os filtros ou a busca para encontrar suas postagens."
        />
      ) : (
        <div className="grid gap-2">
          {filtered.map((p) => (
            <article
              key={p.id}
              onClick={() => startEdit(p)}
              className="surface group flex cursor-pointer items-center gap-3 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-semibold">{p.title}</h2>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{blogName(p.blogId)}</span>
                  <span>·</span>
                  <span>{catName(p.categoryId)}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {new Date(`${p.publishDate}T00:00:00`).toLocaleDateString("pt-BR")}
                  </span>
                </p>
                {p.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {p.tags.slice(0, 4).map((t) => (
                      <TagChip key={t} label={t} />
                    ))}
                    {p.tags.length > 4 && (
                      <span className="self-center text-xs text-muted-foreground">
                        +{p.tags.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div
                className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <Button size="icon" variant="ghost" onClick={() => startEdit(p)}>
                  <Pencil className="size-4" />
                </Button>
                <ConfirmDelete
                  title={`Excluir "${p.title}"?`}
                  description="Esta ação não pode ser desfeita."
                  onConfirm={() => {
                    removePost(p.id);
                    toast.success("Postagem excluída");
                  }}
                  trigger={
                    <Button size="icon" variant="ghost" className="text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  }
                />
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar postagem" : "Nova postagem"}</DialogTitle>
            <DialogDescription>
              Preencha o conteúdo e os metadados da publicação.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="post-title">Título</Label>
                <Input
                  id="post-title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Como escrever melhores títulos"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-1 w-full gap-2 sm:w-auto"
                  disabled={!draft.title.trim()}
                  onClick={generateStructurePrompt}
                >
                  <Sparkles className="size-4" /> Gerar Prompt de Estrutura
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Blog</Label>
                  <Select
                    value={draft.blogId}
                    onValueChange={(v) => setDraft({ ...draft, blogId: v, categoryId: undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {blogs.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={draft.categoryId ?? "none"}
                    onValueChange={(v) =>
                      setDraft({ ...draft, categoryId: v === "none" ? undefined : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {draftCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={draft.status}
                    onValueChange={(v) => setDraft({ ...draft, status: v as PostStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABEL) as PostStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post-date">Data de publicação</Label>
                  <Input
                    id="post-date"
                    type="date"
                    value={draft.publishDate}
                    onChange={(e) => setDraft({ ...draft, publishDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Imagem de capa</Label>
                <ImagePicker
                  value={draft.cover}
                  label="capa"
                  onChange={(cover) => setDraft({ ...draft, cover })}
                />
              </div>
              <div className="space-y-2">
                <Label>Palavras-chave</Label>
                <TagInput
                  value={draft.tags}
                  suggestions={allTags}
                  onChange={(tags) => setDraft({ ...draft, tags })}
                />
              </div>
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <RichTextEditor
                  value={draft.content}
                  onChange={(content) => setDraft({ ...draft, content })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>{editing ? "Salvar alterações" : "Criar postagem"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}