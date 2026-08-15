import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
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
import { ConfirmDelete } from "@/components/confirm-delete";
import { EmptyState, PageHeader } from "@/components/ui-bits";
import { ViewsBadge } from "@/components/metric-bits";
import { useStore } from "@/lib/store";
import {
  daysAgo,
  iso,
  matchPage,
  propertyIdFor,
  useBlogProperties,
  useGa4Summaries,
} from "@/lib/use-ga4";
import type { Category } from "@/lib/types";

export const Route = createFileRoute("/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — PostFlow" },
      {
        name: "description",
        content: "Crie e organize as categorias de cada blog e acompanhe a contagem de postagens.",
      },
      { property: "og:title", content: "Categorias — PostFlow" },
      {
        property: "og:description",
        content: "CRUD de categorias por blog com contagem de postagens.",
      },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { activeBlog, categories, posts, addCategory, updateCategory, removeCategory } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const list = categories.filter((c) => c.blogId === activeBlog?.id);

  const gaProps = useBlogProperties();
  const gaIds = (gaProps.data ?? [])
    .map((p) => p.ga4_property_id.trim())
    .filter((id) => id !== "");
  const gaSummaries = useGa4Summaries(gaIds, daysAgo(28), iso(new Date()));

  /** categoryId -> soma de visualizações (GA4, 28 dias) das postagens da categoria */
  const viewsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    const pid = propertyIdFor(gaProps.data, activeBlog);
    const summary = pid ? (gaSummaries.data ?? []).find((s) => s.propertyId === pid) : undefined;
    if (!summary?.ok || summary.topPages.length === 0) return map;
    for (const p of posts) {
      if (!p.categoryId || p.blogId !== activeBlog?.id) continue;
      const hit = matchPage(summary.topPages, p.title);
      if (hit) map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + hit.views);
    }
    return map;
  }, [posts, activeBlog, gaProps.data, gaSummaries.data]);

  const startCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setOpen(true);
  };

  const startEdit = (c: Category) => {
    setEditing(c);
    setName(c.name);
    setDescription(c.description ?? "");
    setOpen(true);
  };

  const save = () => {
    if (!name.trim()) {
      toast.error("Informe o nome da categoria");
      return;
    }
    if (!activeBlog) return;
    if (editing) {
      updateCategory(editing.id, { name: name.trim(), description });
      toast.success("Categoria atualizada");
    } else {
      addCategory({ blogId: activeBlog.id, name: name.trim(), description });
      toast.success("Categoria criada");
    }
    setOpen(false);
  };

  if (!activeBlog) {
    return (
      <>
        <PageHeader title="Categorias" subtitle="Selecione um blog para ver suas categorias" />
        <EmptyState
          icon={<FolderTree className="size-7" />}
          title="Nenhum blog selecionado"
          description="Cadastre ou selecione um blog para gerenciar suas categorias."
          action={
            <Button asChild className="mt-2">
              <Link to="/blogs">Ir para Blogs</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Categorias"
        subtitle={`${list.length} categoria(s) em ${activeBlog.name}`}
        action={
          <Button onClick={startCreate} className="gap-2">
            <Plus className="size-4" /> Nova categoria
          </Button>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<FolderTree className="size-7" />}
          title="Nenhuma categoria ainda"
          description="Categorias ajudam a organizar as postagens deste blog por tema."
          action={
            <Button onClick={startCreate} className="mt-2 gap-2">
              <Plus className="size-4" /> Criar categoria
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((c) => {
            const count = posts.filter((p) => p.categoryId === c.id).length;
            const views = viewsByCategory.get(c.id) ?? 0;
            return (
              <div
                key={c.id}
                className="surface flex items-center gap-3 p-3 transition-all duration-200 hover:shadow-lift"
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"
                  aria-hidden
                >
                  <FolderTree className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold">{c.name}</h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.description || "Sem descrição"}
                  </p>
                </div>
                <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">
                  {count}
                </span>
                {views > 0 ? <ViewsBadge views={views} /> : null}
                <Button size="icon" variant="ghost" className="size-8" onClick={() => startEdit(c)}>
                  <Pencil className="size-4" />
                </Button>
                <ConfirmDelete
                  title={`Excluir ${c.name}?`}
                  description="As postagens desta categoria ficarão sem categoria."
                  onConfirm={() => {
                    removeCategory(c.id);
                    toast.success("Categoria excluída");
                  }}
                  trigger={
                    <Button size="icon" variant="ghost" className="size-8 text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            <DialogDescription>Categoria do blog {activeBlog.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nome</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tutoriais"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Descrição</Label>
              <Textarea
                id="cat-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}