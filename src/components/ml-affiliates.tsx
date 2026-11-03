import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ML_MAX_PRODUCTS,
  ctr,
  mlDb,
  remainingSlots,
  toCsv,
  type WpProduct,
  type WpSite,
  type WpStat,
} from "@/lib/ml-auth";
import { notifySite } from "@/lib/ml-affiliates.functions";

const SYNC_URL =
  typeof window !== "undefined" ? `${window.location.origin}/api/public/wp-sync` : "/api/public/wp-sync";

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR") : "Nunca");
const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success("Copiado"));

function useSites() {
  const [sites, setSites] = useState<WpSite[]>([]);
  const load = useCallback(async () => {
    const { data, error } = await mlDb.from("wp_sites").select("*").order("name");
    if (error) toast.error(error.message);
    setSites((data as WpSite[]) ?? []);
  }, []);
  useEffect(() => void load(), [load]);
  return { sites, load };
}

function useNotify() {
  const run = useServerFn(notifySite);
  return async (siteId: string) => {
    const { data } = await mlDb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    try {
      await run({ data: { siteId, token } });
    } catch {
      // registrar falha não impede salvar
    }
  };
}

/* ------------------------------ Sites ------------------------------ */
export function MlSitesTab() {
  const { sites, load } = useSites();
  const [edit, setEdit] = useState<Partial<WpSite> | null>(null);

  const save = async () => {
    if (!edit?.name?.trim()) return void toast.error("Informe o nome");
    const row = { name: edit.name.trim(), url: edit.url ?? "", webhook_url: edit.webhook_url ?? "" };
    const { error } = edit.id
      ? await mlDb.from("wp_sites").update(row).eq("id", edit.id)
      : await mlDb.from("wp_sites").insert(row);
    if (error) return void toast.error(error.message);
    setEdit(null);
    toast.success("Site salvo");
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir este site e todos os seus produtos e métricas?")) return;
    const { error } = await mlDb.from("wp_sites").delete().eq("id", id);
    if (error) toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="rounded-lg border bg-card p-4 text-sm">
        <p className="font-medium">URL do endpoint central (cole no plugin de cada site)</p>
        <div className="mt-2 flex gap-2">
          <Input readOnly value={SYNC_URL} />
          <Button variant="outline" onClick={() => copy(SYNC_URL)}><Copy className="size-4" /></Button>
        </div>
      </div>
      <Button onClick={() => setEdit({})}><Plus className="size-4" /> Novo site</Button>
      <div className="grid gap-3">
        {sites.map((s) => {
          const online = s.last_seen && Date.now() - new Date(s.last_seen).getTime() < 30 * 60_000;
          return (
            <div key={s.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.url || "URL será preenchida na 1ª sincronização"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${online ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {online ? "Ativo" : "Sem contato recente"}
                  </span>
                  <Button size="icon" variant="ghost" onClick={() => setEdit(s)} aria-label="Editar"><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(s.id)} aria-label="Excluir"><Trash2 className="size-4" /></Button>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Input readOnly value={s.site_key} className="font-mono text-xs" />
                <Button variant="outline" onClick={() => copy(s.site_key)}><Copy className="size-4" /> Copiar chave</Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Última atividade: {fmtDate(s.last_seen)} {s.plugin_version && `· plugin ${s.plugin_version}`}
              </p>
            </div>
          );
        })}
        {sites.length === 0 && <p className="text-sm text-muted-foreground">Nenhum site cadastrado.</p>}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar site" : "Novo site"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Nome" value={edit?.name ?? ""} onChange={(v) => setEdit({ ...edit, name: v })} />
            <Field label="URL do site" value={edit?.url ?? ""} onChange={(v) => setEdit({ ...edit, url: v })} />
            <Field label="Webhook (opcional)" value={edit?.webhook_url ?? ""} onChange={(v) => setEdit({ ...edit, webhook_url: v })} />
          </div>
          <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SitePicker({ sites, value, onChange, all }: { sites: WpSite[]; value: string; onChange: (v: string) => void; all?: boolean }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-64"><SelectValue placeholder="Escolha o site" /></SelectTrigger>
      <SelectContent>
        {all && <SelectItem value="all">Todos os sites</SelectItem>}
        {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/* ----------------------------- Produtos ---------------------------- */
const blank = (): Partial<WpProduct> => ({ title: "", image_url: "", affiliate_link: "", price: "", badge: "", keywords: "", weight: 3, active: true });

export function MlProductsTab() {
  const { sites } = useSites();
  const notify = useNotify();
  const [siteId, setSiteId] = useState("");
  const [products, setProducts] = useState<WpProduct[]>([]);
  const [edit, setEdit] = useState<Partial<WpProduct> | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [copyOpen, setCopyOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!siteId && sites[0]) setSiteId(sites[0].id);
  }, [sites, siteId]);

  const load = useCallback(async () => {
    if (!siteId) return;
    const { data, error } = await mlDb.from("wp_products").select("*").eq("site_id", siteId).order("created_at");
    if (error) toast.error(error.message);
    setProducts((data as WpProduct[]) ?? []);
    setSelected([]);
  }, [siteId]);
  useEffect(() => void load(), [load]);

  const changed = async (sid = siteId) => {
    await load();
    void notify(sid);
  };

  const save = async () => {
    if (!edit?.title?.trim()) return void toast.error("Informe o título");
    if (!edit.id && products.length >= ML_MAX_PRODUCTS) return void toast.error("Limite de 50 produtos neste site");
    const row = {
      title: edit.title.trim(),
      image_url: edit.image_url ?? "",
      affiliate_link: edit.affiliate_link ?? "",
      price: edit.price ?? "",
      badge: edit.badge ?? "",
      keywords: edit.keywords ?? "",
      weight: Math.min(5, Math.max(1, Number(edit.weight) || 3)),
      active: edit.active ?? true,
    };
    const { error } = edit.id
      ? await mlDb.from("wp_products").update(row).eq("id", edit.id)
      : await mlDb.from("wp_products").insert({ ...row, site_id: siteId });
    if (error) return void toast.error(error.message);
    setEdit(null);
    toast.success("Produto salvo");
    changed();
  };

  const toggle = async (p: WpProduct) => {
    const { error } = await mlDb.from("wp_products").update({ active: !p.active }).eq("id", p.id);
    if (error) return void toast.error(error.message);
    changed();
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await mlDb.from("wp_products").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    changed();
  };

  const upload = async (file: File) => {
    setUploading(true);
    const path = `${siteId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await mlDb.storage.from("ml-products").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) return void toast.error(error.message);
    const url = mlDb.storage.from("ml-products").getPublicUrl(path).data.publicUrl;
    setEdit((e) => ({ ...e, image_url: url }));
  };

  const copyTo = async () => {
    if (!target || target === siteId) return void toast.error("Escolha outro site");
    const { count } = await mlDb.from("wp_products").select("id", { count: "exact", head: true }).eq("site_id", target);
    const free = remainingSlots(count ?? 0);
    const items = products.filter((p) => selected.includes(p.id));
    if (items.length > free) return void toast.error(`O site de destino só tem espaço para ${free} produto(s)`);
    const rows = items.map(({ id: _id, created_at: _c, site_id: _s, ...rest }) => ({ ...rest, site_id: target }));
    const { error } = await mlDb.from("wp_products").insert(rows);
    if (error) return void toast.error(error.message);
    toast.success(`${rows.length} produto(s) copiado(s)`);
    setCopyOpen(false);
    void notify(target);
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <SitePicker sites={sites} value={siteId} onChange={setSiteId} />
        <span className="text-sm text-muted-foreground">{products.length}/{ML_MAX_PRODUCTS} produtos</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" disabled={selected.length === 0} onClick={() => setCopyOpen(true)}>
            <Copy className="size-4" /> Copiar produtos para outro site
          </Button>
          <Button disabled={!siteId || products.length >= ML_MAX_PRODUCTS} onClick={() => setEdit(blank())}>
            <Plus className="size-4" /> Novo produto
          </Button>
        </div>
      </div>
      {products.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={selected.length === products.length}
            onCheckedChange={(c) => setSelected(c === true ? products.map((p) => p.id) : [])}
          />
          Selecionar todos
        </label>
      )}
      <div className="grid gap-2">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <Checkbox
              checked={selected.includes(p.id)}
              onCheckedChange={(c) => setSelected((s) => (c === true ? [...s, p.id] : s.filter((x) => x !== p.id)))}
              aria-label={`Selecionar ${p.title}`}
            />
            {p.image_url ? <img src={p.image_url} alt="" className="size-12 rounded object-contain" /> : <div className="size-12 rounded bg-muted" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.title}</p>
              <p className="text-xs text-muted-foreground">{p.price} {p.badge && `· ${p.badge}`} · prioridade {p.weight}</p>
            </div>
            <Switch checked={p.active} onCheckedChange={() => toggle(p)} aria-label="Ativo" />
            <Button size="icon" variant="ghost" onClick={() => setEdit(p)} aria-label="Editar"><Pencil className="size-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(p.id)} aria-label="Excluir"><Trash2 className="size-4" /></Button>
          </div>
        ))}
        {siteId && products.length === 0 && <p className="text-sm text-muted-foreground">Nenhum produto neste site.</p>}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Título" value={edit?.title ?? ""} onChange={(v) => setEdit({ ...edit, title: v })} />
            <div className="space-y-1">
              <Label>Imagem (URL ou envio)</Label>
              <div className="flex gap-2">
                <Input value={edit?.image_url ?? ""} onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} />
                <Button asChild variant="outline" disabled={uploading}>
                  <label className="cursor-pointer">
                    <Upload className="size-4" />
                    <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                  </label>
                </Button>
              </div>
            </div>
            <Field label="Link de afiliado" value={edit?.affiliate_link ?? ""} onChange={(v) => setEdit({ ...edit, affiliate_link: v })} />
            <Field label="Preço" value={edit?.price ?? ""} onChange={(v) => setEdit({ ...edit, price: v })} />
            <Field label="Selo" value={edit?.badge ?? ""} onChange={(v) => setEdit({ ...edit, badge: v })} />
            <Field label="Palavras-chave" value={edit?.keywords ?? ""} onChange={(v) => setEdit({ ...edit, keywords: v })} />
            <Field label="Prioridade (1 a 5)" type="number" value={String(edit?.weight ?? 3)} onChange={(v) => setEdit({ ...edit, weight: Number(v) })} />
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={edit?.active ?? true} onCheckedChange={(c) => setEdit({ ...edit, active: c })} /> Ativo
            </label>
          </div>
          <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Copiar {selected.length} produto(s)</DialogTitle></DialogHeader>
          <SitePicker sites={sites.filter((s) => s.id !== siteId)} value={target} onChange={setTarget} />
          <DialogFooter><Button onClick={copyTo}>Copiar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------- Métricas ---------------------------- */
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export function MlMetricsTab() {
  const { sites } = useSites();
  const [siteId, setSiteId] = useState("all");
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(daysAgo(0));
  const [product, setProduct] = useState("all");
  const [placement, setPlacement] = useState("all");
  const [stats, setStats] = useState<WpStat[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const all: WpStat[] = [];
      for (let page = 0; page < 50; page++) {
        let q = mlDb.from("wp_stats").select("site_id,day,product_id,placement,post_type,impressions,clicks")
          .gte("day", from).lte("day", to).range(page * 1000, page * 1000 + 999);
        if (siteId !== "all") q = q.eq("site_id", siteId);
        const { data, error } = await q;
        if (error) { toast.error(error.message); break; }
        all.push(...((data as WpStat[]) ?? []));
        if (!data || data.length < 1000) break;
      }
      setStats(all);
      const [{ data: t }, { data: p }] = await Promise.all([
        mlDb.from("wp_product_titles").select("product_id,title"),
        mlDb.from("wp_products").select("id,title"),
      ]);
      const map: Record<string, string> = {};
      for (const r of (t as { product_id: string; title: string }[]) ?? []) map[r.product_id] = r.title;
      for (const r of (p as { id: string; title: string }[]) ?? []) map[r.id] = r.title;
      setTitles(map);
    })();
  }, [siteId, from, to]);

  const rows = useMemo(
    () => stats.filter((s) => (product === "all" || s.product_id === product) && (placement === "all" || s.placement === placement)),
    [stats, product, placement],
  );
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id;
  const prodName = (id: string) => titles[id] ?? id;
  const imp = rows.reduce((a, r) => a + r.impressions, 0);
  const clk = rows.reduce((a, r) => a + r.clicks, 0);

  const group = (key: (r: WpStat) => string) => {
    const m = new Map<string, { i: number; c: number }>();
    for (const r of rows) {
      const k = key(r);
      const g = m.get(k) ?? { i: 0, c: 0 };
      g.i += r.impressions; g.c += r.clicks;
      m.set(k, g);
    }
    return [...m.entries()].sort((a, b) => b[1].i - a[1].i);
  };
  const daily = group((r) => r.day).sort((a, b) => a[0].localeCompare(b[0])).map(([day, g]) => ({ day: day.slice(5), Impressões: g.i, Cliques: g.c }));
  const productIds = [...new Set(stats.map((s) => s.product_id))];
  const placements = [...new Set(stats.map((s) => s.placement))];

  const exportCsv = () => {
    const csv = toCsv([
      ["Dia", "Site", "Produto", "Posição", "Tipo de post", "Impressões", "Cliques", "CTR %"],
      ...rows.map((r) => [r.day, siteName(r.site_id), prodName(r.product_id), r.placement, r.post_type, r.impressions, r.clicks, ctr(r.impressions, r.clicks).toFixed(2)]),
    ]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `metricas-afiliados-${from}-a-${to}.csv`;
    a.click();
  };

  const Table = ({ title, data, name }: { title: string; data: [string, { i: number; c: number }][]; name: (k: string) => string }) => (
    <div className="rounded-lg border bg-card p-4">
      <p className="mb-2 font-medium">{title}</p>
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground"><tr><th>Nome</th><th className="text-right">Impr.</th><th className="text-right">Cliques</th><th className="text-right">CTR</th></tr></thead>
        <tbody>
          {data.map(([k, g]) => (
            <tr key={k} className="border-t"><td className="truncate py-1">{name(k) || "—"}</td><td className="text-right">{g.i}</td><td className="text-right">{g.c}</td><td className="text-right">{ctr(g.i, g.c).toFixed(2)}%</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-end gap-2">
        <SitePicker sites={sites} value={siteId} onChange={setSiteId} all />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="De" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="Até" />
        <Select value={product} onValueChange={setProduct}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            {productIds.map((id) => <SelectItem key={id} value={id}>{prodName(id)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={placement} onValueChange={setPlacement}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as posições</SelectItem>
            {placements.map((p) => <SelectItem key={p} value={p}>{p || "—"}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv} className="ml-auto"><Download className="size-4" /> Exportar CSV</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[["Impressões", imp.toLocaleString("pt-BR")], ["Cliques", clk.toLocaleString("pt-BR")], ["CTR", `${ctr(imp, clk).toFixed(2)}%`]].map(([l, v]) => (
          <div key={l} className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-bold">{v}</p></div>
        ))}
      </div>
      <div className="h-64 rounded-lg border bg-card p-4">
        <ResponsiveContainer>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="day" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Line dataKey="Impressões" stroke="var(--primary)" dot={false} />
            <Line dataKey="Cliques" stroke="var(--chart-2)" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Table title="Por site" data={group((r) => r.site_id)} name={siteName} />
        <Table title="Top 20 produtos (por cliques)" data={group((r) => r.product_id).sort((a, b) => b[1].c - a[1].c).slice(0, 20)} name={prodName} />
        <Table title="Por posição" data={group((r) => r.placement)} name={(k) => k} />
        <Table title="Por tipo de post" data={group((r) => r.post_type)} name={(k) => k} />
      </div>
    </div>
  );
}
