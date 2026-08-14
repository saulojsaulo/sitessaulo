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
import { useStore } from "@/lib/store";
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {blogs.map((blog) => {
            const catCount = categories.filter((c) => c.blogId === blog.id).length;
            const postCount = posts.filter((p) => p.blogId === blog.id).length;
            const isActive = activeBlog?.id === blog.id;
            return (
              <article
                key={blog.id}
                className="surface group flex flex-col gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
                style={isActive ? { borderColor: "var(--color-primary)" } : undefined}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl text-sm font-bold text-primary-foreground"
                    style={{ background: blog.color }}
                  >
                    {blog.logo ? (
                      <img src={blog.logo} alt="" className="size-full object-cover" />
                    ) : (
                      blog.name.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold">{blog.name}</h2>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Globe className="size-3" />
                      {blog.url || "sem domínio"}
                    </p>
                  </div>
                </div>
                <p className="line-clamp-2 min-h-8 text-xs text-muted-foreground">
                  {blog.description || "Sem descrição."}
                </p>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <FolderTree className="size-3.5" /> {catCount} cat.
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FileText className="size-3.5" /> {postCount} posts
                  </span>
                </div>
                <div className="mt-auto flex items-center gap-2 border-t pt-2.5">
                  <Button
                    size="sm"
                    variant={isActive ? "default" : "secondary"}
                    className="flex-1 text-xs"
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
              </article>
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