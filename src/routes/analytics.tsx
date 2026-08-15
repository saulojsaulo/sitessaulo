import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Clock,
  Eye,
  MousePointerClick,
  RefreshCw,
  Settings2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase, type BlogPropertyRow } from "@/lib/supabase";
import {
  getPropertiesSummary,
  getPropertyReport,
  type Ga4PropertyReport,
} from "@/lib/ga4.functions";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics GA4 — PostFlow" },
      {
        name: "description",
        content:
          "Tráfego dos seus blogs no Google Analytics 4: sessões, usuários, páginas mais acessadas e origens.",
      },
      { property: "og:title", content: "Analytics GA4 — PostFlow" },
      {
        property: "og:description",
        content: "Painel de tráfego GA4 por blog, com comparativo entre todas as propriedades.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

const FIVE_MIN = 5 * 60 * 1000;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};

const PRESETS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "custom", label: "Período personalizado" },
] as const;

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const fmtInt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtDur = (s: number) => {
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  return `${m}m ${String(total % 60).padStart(2, "0")}s`;
};
const fmtDay = (yyyymmdd: string) =>
  yyyymmdd.length === 8 ? `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}` : yyyymmdd;

function useBlogProperties() {
  return useQuery({
    queryKey: ["blog_properties"],
    staleTime: FIVE_MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_properties")
        .select("*")
        .order("blog_name");
      if (error) throw new Error(error.message);
      return (data ?? []) as BlogPropertyRow[];
    },
  });
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="surface flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="text-sm font-medium">Não foi possível carregar os dados desta propriedade.</p>
      <p className="max-w-xl text-xs text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="size-4" /> Tentar novamente
      </Button>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="surface space-y-3 p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

function BlockSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="surface p-4">
      <Skeleton className="mb-4 h-4 w-40" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="surface p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="grid size-6 place-items-center rounded-md bg-primary/12 text-primary">
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function SingleBlogView({
  propertyId,
  startDate,
  endDate,
}: {
  propertyId: string;
  startDate: string;
  endDate: string;
}) {
  const fetchReport = useServerFn(getPropertyReport);
  const query = useQuery<Ga4PropertyReport>({
    queryKey: ["ga4", "property", propertyId, startDate, endDate],
    staleTime: FIVE_MIN,
    gcTime: FIVE_MIN * 2,
    retry: false,
    queryFn: () => fetchReport({ data: { propertyId, startDate, endDate } }),
  });

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <KpiSkeleton />
        <BlockSkeleton height={280} />
        <div className="grid gap-4 lg:grid-cols-2">
          <BlockSkeleton />
          <BlockSkeleton />
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorBox
        message={query.error instanceof Error ? query.error.message : "Erro desconhecido"}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const d = query.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi icon={<MousePointerClick className="size-3.5" />} label="Sessões" value={fmtInt(d.kpis.sessions)} />
        <Kpi icon={<Users className="size-3.5" />} label="Usuários ativos" value={fmtInt(d.kpis.activeUsers)} />
        <Kpi icon={<Eye className="size-3.5" />} label="Visualizações" value={fmtInt(d.kpis.screenPageViews)} />
        <Kpi icon={<BarChart3 className="size-3.5" />} label="Taxa de engajamento" value={fmtPct(d.kpis.engagementRate)} />
        <Kpi icon={<Clock className="size-3.5" />} label="Duração média" value={fmtDur(d.kpis.averageSessionDuration)} />
      </div>

      <Card title="Sessões e usuários ao longo do tempo">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.timeseries.map((t) => ({ ...t, label: fmtDay(t.date) }))}>
              <defs>
                <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={40} />
              <ReTooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="sessions"
                name="Sessões"
                stroke="var(--chart-1)"
                fill="url(#gs)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="users"
                name="Usuários"
                stroke="var(--chart-2)"
                fill="url(#gu)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Páginas mais acessadas">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Página</th>
                <th className="py-2 pr-3 text-right font-medium">Visualizações</th>
                <th className="py-2 text-right font-medium">Duração média</th>
              </tr>
            </thead>
            <tbody>
              {d.pages.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-muted-foreground">
                    Sem dados no período.
                  </td>
                </tr>
              )}
              {d.pages.map((p) => (
                <tr key={p.pagePath} className="border-b last:border-0">
                  <td className="max-w-[420px] truncate py-2 pr-3">{p.pagePath}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtInt(p.views)}</td>
                  <td className="py-2 text-right tabular-nums">{fmtDur(p.avgDuration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Origem do tráfego">
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.channels} dataKey="sessions" nameKey="name" innerRadius={50} outerRadius={90}>
                  {d.channels.map((c, i) => (
                    <Cell key={c.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <ReTooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Dispositivos">
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.devices}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={40} />
                <ReTooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="sessions" name="Sessões" radius={[6, 6, 0, 0]} fill="var(--chart-1)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Localização (país)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">País</th>
                <th className="py-2 text-right font-medium">Sessões</th>
              </tr>
            </thead>
            <tbody>
              {d.countries.map((c) => (
                <tr key={c.name} className="border-b last:border-0">
                  <td className="py-2 pr-3">{c.name || "(não definido)"}</td>
                  <td className="py-2 text-right tabular-nums">{fmtInt(c.sessions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

type SortKey = "blog" | "sessions" | "activeUsers" | "screenPageViews" | "engagementRate";

function AllBlogsView({
  properties,
  startDate,
  endDate,
}: {
  properties: BlogPropertyRow[];
  startDate: string;
  endDate: string;
}) {
  const fetchSummary = useServerFn(getPropertiesSummary);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "sessions",
    desc: true,
  });
  const ids = properties.map((p) => p.ga4_property_id);

  const query = useQuery({
    queryKey: ["ga4", "summary", ids.join(","), startDate, endDate],
    staleTime: FIVE_MIN,
    gcTime: FIVE_MIN * 2,
    retry: false,
    queryFn: () => fetchSummary({ data: { propertyIds: ids, startDate, endDate } }),
  });

  const rows = useMemo(() => {
    const list = (query.data ?? []).map((s) => {
      const blog = properties.find((p) => p.ga4_property_id === s.propertyId);
      return { ...s, blog: blog?.blog_name ?? s.propertyId };
    });
    const dir = sort.desc ? -1 : 1;
    return [...list].sort((a, b) =>
      sort.key === "blog"
        ? a.blog.localeCompare(b.blog) * dir
        : (a.kpis[sort.key] - b.kpis[sort.key]) * dir,
    );
  }, [query.data, properties, sort]);

  const totals = useMemo(() => {
    const sessions = rows.reduce((a, r) => a + r.kpis.sessions, 0);
    const users = rows.reduce((a, r) => a + r.kpis.activeUsers, 0);
    const views = rows.reduce((a, r) => a + r.kpis.screenPageViews, 0);
    const engaged = rows.reduce((a, r) => a + r.kpis.engagementRate * r.kpis.sessions, 0);
    const duration = rows.reduce((a, r) => a + r.kpis.averageSessionDuration * r.kpis.sessions, 0);
    return {
      sessions,
      users,
      views,
      engagementRate: sessions ? engaged / sessions : 0,
      averageSessionDuration: sessions ? duration / sessions : 0,
    };
  }, [rows]);

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <KpiSkeleton />
        <BlockSkeleton height={320} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorBox
        message={query.error instanceof Error ? query.error.message : "Erro desconhecido"}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const header = (key: SortKey, label: string, align = "text-right") => (
    <th className={`py-2 pr-3 ${align} font-medium`}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }))}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        {sort.key === key ? (
          sort.desc ? (
            <ArrowDown className="size-3" />
          ) : (
            <ArrowUp className="size-3" />
          )
        ) : null}
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi icon={<MousePointerClick className="size-3.5" />} label="Sessões (total)" value={fmtInt(totals.sessions)} />
        <Kpi icon={<Users className="size-3.5" />} label="Usuários (total)" value={fmtInt(totals.users)} />
        <Kpi icon={<Eye className="size-3.5" />} label="Visualizações (total)" value={fmtInt(totals.views)} />
        <Kpi icon={<BarChart3 className="size-3.5" />} label="Engajamento médio" value={fmtPct(totals.engagementRate)} />
        <Kpi icon={<Clock className="size-3.5" />} label="Duração média" value={fmtDur(totals.averageSessionDuration)} />
      </div>

      <Card title="Comparativo por blog">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                {header("blog", "Blog", "text-left")}
                {header("sessions", "Sessões")}
                {header("activeUsers", "Usuários")}
                {header("screenPageViews", "Pageviews")}
                {header("engagementRate", "Engajamento")}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.propertyId} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    {r.blog}
                    {!r.ok && (
                      <span className="ml-2 text-xs text-destructive">
                        {r.error?.slice(0, 80) ?? "erro"}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtInt(r.kpis.sessions)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtInt(r.kpis.activeUsers)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {fmtInt(r.kpis.screenPageViews)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmtPct(r.kpis.engagementRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PropertyIdsEditor({ properties }: { properties: BlogPropertyRow[] }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(properties.map((p) => [p.id, p.ga4_property_id])),
  );

  const save = useMutation({
    mutationFn: async () => {
      for (const p of properties) {
        const next = (values[p.id] ?? "").trim();
        if (next === p.ga4_property_id) continue;
        const { error } = await supabase
          .from("blog_properties")
          .update({ ga4_property_id: next })
          .eq("id", p.id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Property IDs salvos");
      void qc.invalidateQueries({ queryKey: ["blog_properties"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  return (
    <Card title="Property IDs do GA4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((p) => (
          <div key={p.id} className="space-y-1">
            <Label className="text-xs">{p.blog_name}</Label>
            <Input
              value={values[p.id] ?? ""}
              placeholder="ex: 123456789"
              onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <Button className="mt-4" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Salvando..." : "Salvar Property IDs"}
      </Button>
    </Card>
  );
}

function AnalyticsPage() {
  const props = useBlogProperties();
  const [selected, setSelected] = useState<string>("all");
  const [preset, setPreset] = useState<string>("30");
  const [customStart, setCustomStart] = useState(daysAgo(30));
  const [customEnd, setCustomEnd] = useState(iso(new Date()));
  const [showConfig, setShowConfig] = useState(false);

  const startDate = preset === "custom" ? customStart : daysAgo(Number(preset));
  const endDate = preset === "custom" ? customEnd : iso(new Date());

  const configured = (props.data ?? []).filter((p) => p.ga4_property_id.trim() !== "");

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Tráfego dos seus blogs direto do Google Analytics 4"
        action={
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowConfig((v) => !v)}>
            <Settings2 className="size-4" /> Property IDs
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] space-y-1">
          <Label className="text-xs">Blog</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os blogs</SelectItem>
              {configured.map((p) => (
                <SelectItem key={p.id} value={p.ga4_property_id}>
                  {p.blog_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[200px] space-y-1">
          <Label className="text-xs">Período</Label>
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {preset === "custom" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {showConfig && props.data && (
        <div className="mb-4">
          <PropertyIdsEditor properties={props.data} />
        </div>
      )}

      {props.isPending && <KpiSkeleton />}
      {props.isError && (
        <ErrorBox
          message={props.error instanceof Error ? props.error.message : "Erro desconhecido"}
          onRetry={() => void props.refetch()}
        />
      )}
      {props.data && configured.length === 0 && (
        <EmptyState
          icon={<BarChart3 className="size-7" />}
          title="Nenhum Property ID configurado"
          description="Preencha o Property ID do GA4 de cada blog para começar a ver os dados de tráfego."
          action={
            <Button size="sm" onClick={() => setShowConfig(true)}>
              Configurar Property IDs
            </Button>
          }
        />
      )}
      {props.data && configured.length > 0 && selected === "all" && (
        <AllBlogsView properties={configured} startDate={startDate} endDate={endDate} />
      )}
      {props.data && configured.length > 0 && selected !== "all" && (
        <SingleBlogView propertyId={selected} startDate={startDate} endDate={endDate} />
      )}
    </div>
  );
}