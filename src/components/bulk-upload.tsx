import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/lib/store";

interface Row {
  title: string;
  blog: string;
  category: string;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const pick = (obj: Record<string, unknown>, keys: string[]) => {
  for (const k of Object.keys(obj)) {
    if (keys.includes(norm(k))) return String(obj[k] ?? "").trim();
  }
  return "";
};

export function BulkUploadPosts({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { blogs, categories, activeBlogId, addBlog, addCategory, addPost } = useStore();
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [createMissing, setCreateMissing] = useState(true);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const resolved = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        blogMatch: blogs.find((b) => norm(b.name) === norm(r.blog)) ?? null,
        categoryMatch:
          categories.find(
            (c) =>
              norm(c.name) === norm(r.category) &&
              norm(blogs.find((b) => b.id === c.blogId)?.name ?? "") === norm(r.blog),
          ) ?? null,
      })),
    [rows, blogs, categories],
  );

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName = wb.SheetNames[0];
      const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
      if (!sheet) throw new Error("Planilha vazia");
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed = json
        .map((o) => ({
          title: pick(o, ["titulo", "title", "titulo do post", "postagem"]),
          blog: pick(o, ["blog", "site"]),
          category: pick(o, ["categoria", "category"]),
        }))
        .filter((r) => r.title);
      if (!parsed.length) {
        toast.error("Nenhuma linha válida encontrada", {
          description: 'Verifique as colunas "Título", "Blog" e "Categoria".',
        });
        return;
      }
      setRows(parsed);
      setFileName(file.name);
    } catch (e) {
      toast.error("Não foi possível ler o arquivo", {
        description: e instanceof Error ? e.message : "Envie um .xlsx válido.",
      });
    } finally {
      setBusy(false);
    }
  };

  const importAll = () => {
    setBusy(true);
    try {
      const blogMap = new Map(blogs.map((b) => [norm(b.name), b]));
      const catMap = new Map(categories.map((c) => [`${c.blogId}|${norm(c.name)}`, c]));
      let created = 0;
      let skipped = 0;
      const today = new Date().toISOString().slice(0, 10);

      for (const r of rows) {
        let blog = r.blog ? blogMap.get(norm(r.blog)) : undefined;
        if (!blog && r.blog && createMissing) {
          blog = addBlog({ name: r.blog, url: "", description: "" });
          blogMap.set(norm(r.blog), blog);
        }
        const blogId = blog?.id ?? activeBlogId ?? blogs[0]?.id;
        if (!blogId) {
          skipped++;
          continue;
        }

        let categoryId: string | undefined;
        if (r.category) {
          const key = `${blogId}|${norm(r.category)}`;
          let cat = catMap.get(key);
          if (!cat && createMissing) {
            cat = addCategory({ blogId, name: r.category });
            catMap.set(key, cat);
          }
          categoryId = cat?.id;
        }

        addPost({
          blogId,
          ...(categoryId ? { categoryId } : {}),
          title: r.title,
          content: "",
          tags: [],
          status: "rascunho",
          publishDate: today,
        });
        created++;
      }

      toast.success(`${created} postagem(ns) criada(s)`, {
        description: skipped ? `${skipped} linha(s) ignorada(s) sem blog.` : "Status: Rascunho.",
      });
      reset();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload de novas postagens</DialogTitle>
          <DialogDescription>
            Envie um arquivo .xlsx com as colunas <strong>Título</strong>, <strong>Blog</strong> e{" "}
            <strong>Categoria</strong>. As postagens serão criadas como rascunho para você editar
            depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="bulk-file">Arquivo (.xlsx)</Label>
            <input
              ref={inputRef}
              id="bulk-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="mt-2 block w-full cursor-pointer rounded-md border border-input bg-background p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={createMissing}
              onCheckedChange={(v) => setCreateMissing(v === true)}
            />
            Criar blogs/categorias que não existirem
          </label>

          {rows.length > 0 && (
            <div className="rounded-lg border">
              <div className="flex items-center gap-2 border-b px-3 py-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="size-4" />
                {fileName} — {rows.length} linha(s)
              </div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Título</th>
                      <th className="px-3 py-2">Blog</th>
                      <th className="px-3 py-2">Categoria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolved.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5">{r.title}</td>
                        <td className="px-3 py-1.5">
                          {r.blog || "—"}
                          {r.blog && !r.blogMatch && (
                            <span className="ml-1 text-xs text-primary">(novo)</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {r.category || "—"}
                          {r.category && !r.categoryMatch && (
                            <span className="ml-1 text-xs text-primary">(nova)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={importAll} disabled={busy || rows.length === 0} className="gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Criar {rows.length || ""} postagem(ns)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
