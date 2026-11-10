import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Clock,
  DollarSign,
  Eye,
  Flame,
  MousePointerClick,
  RefreshCw,
  Settings2,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/ui-bits";

import { AdsterraPanel } from "@/components/adsterra-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Delta, LiveDot, Sparkline } from "@/components/metric-bits";
import { Card, ErrorBox, Kpi, tooltipStyle } from "@/components/analytics-bits";
import { supabase, type BlogPropertyRow } from "@/lib/supabase";
import {
  daysAgo,
  fmtDay,
  fmtDur,
  fmtInt,
  fmtPct,
  iso,
  useBlogProperties,
  useGa4Realtime,
  useGa4Report,
  useGa4Summaries,
} from "@/lib/use-ga4";
import type { Ga4Kpis } from "@/lib/ga4-types";

export const Route = createFileRoute("/analytics")({
  validateSearch: (search: Record<string, unknown>): { aba?: "receita" } =>
    search["aba"] === "receita" ? { aba: "receita" } : {},
  head: () => ({
    meta: [
      { title: "Analytics — PostFlow" },
      {
        name: "description",
        content:
          "Tráfego (GA4) e receita de anúncios (Adsterra) dos seus blogs: tempo real, tendências, placements e países.",
      },
      { property: "og:title", content: "Analytics — PostFlow" },
      {
        property: "og:description",
        content: "Painel editorial com tempo real, comparativo de períodos e ranking de artigos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

const PRESETS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "28", label: "Últimos 28 dias" },
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

function KpiSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel space-y-3 p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

function BlockSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="panel p-5">
      <Skeleton className="mb-4 h-4 w-40" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  );
}

interface KpiSeries {
  sessions: number[];
  users: number[];
  views: number[];
}

function KpiGrid({ kpis, prev, series }: { kpis: Ga4Kpis; prev: Ga4Kpis; series?: KpiSeries }) {
  const pps = kpis.sessions ? kpis.screenPageViews / kpis.sessions : 0;
  const prevPps = prev.sessions ? prev.screenPageViews / prev.sessions : 0;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        icon={<MousePointerClick className="size-3.5" />}
        label="Sessões"
        value={fmtInt(kpis.sessions)}
        current={kpis.sessions}
        previous={prev.sessions}
        {...(series ? { series: series.sessions } : {})}
      />
      <Kpi
        icon={<Users className="size-3.5" />}
        label="Usuários ativos"
        value={fmtInt(kpis.activeUsers)}
        current={kpis.activeUsers}
        previous={prev.activeUsers}
        {...(series ? { series: series.users } : {})}
      />
      <Kpi
        icon={<UserPlus className="size-3.5" />}
        label="Novos usuários"
        value={fmtInt(kpis.newUsers)}
        current={kpis.newUsers}
        previous={prev.newUsers}
      />
      <Kpi
        icon={<Eye className="size-3.5" />}
        label="Visualizações"
        value={fmtInt(kpis.screenPageViews)}
        current={kpis.screenPageViews}
        previous={prev.screenPageViews}
        {...(series ? { series: series.views } : {})}
      />
      <Kpi
        icon={<BarChart3 className="size-3.5" />}
        label="Taxa de engajamento"
        value={fmtPct(kpis.engagementRate)}
        current={kpis.engagementRate}
        previous={prev.engagementRate}
        points
      />
      <Kpi
        icon={<TrendingDown className="size-3.5" />}
        label="Taxa de rejeição"
        value={fmtPct(kpis.bounceRate)}
        current={kpis.bounceRate}
        previous={prev.bounceRate}
        invert
        points
      />
      <Kpi
        icon={<Clock className="size-3.5" />}
        label="Duração média da sessão"
        value={fmtDur(kpis.averageSessionDuration)}
        current={kpis.averageSessionDuration}
        previous={prev.averageSessionDuration}
      />
      <Kpi
        icon={<Sparkles className="size-3.5" />}
        label="Páginas por sessão"
        value={pps.toFixed(2)}
        current={pps}
        previous={prevPps}
        hint={`${fmtInt(kpis.eventCount)} eventos no período`}
      />
    </div>
  );
}

const DEVICE_LABEL: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
};
const DEVICE_SHADE = ["bg-primary", "bg-primary/55", "bg-primary/25"];

function RealtimePanel({ propertyId }: { propertyId: string }) {
  const rt = useGa4Realtime(propertyId);

  if (rt.isError) return null;

  const data = rt.data;
  const devices = data?.devices ?? [];
  const deviceTotal = devices.reduce((a, d) => a + d.activeUsers, 0);
  const pages = data?.pages ?? [];
  const minutes = data?.minutes ?? [];
  // Um rótulo a cada 5 minutos, sempre terminando em "agora".
  const ticks = minutes
    .filter((_, i) => (minutes.length - 1 - i) % 5 === 0)
    .map((m) => m.minutesAgo);

  return (
    <Card
      title="Tempo real"
      subtitle="Últimos 30 minutos"
      action={
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Activity className="size-3.5" /> atualiza a cada 60 s
        </span>
      }
    >
      {!data ? (
        <Skeleton className="h-[150px] w-full" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)_280px]">
          <div className="flex flex-col justify-center rounded-lg bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <LiveDot users={data.activeUsers} label={false} />
              Usuários agora
            </div>
            <p className="mt-2 font-display text-5xl font-semibold leading-none tracking-tight tabular-nums">
              {fmtInt(data.activeUsers)}
            </p>
            {deviceTotal > 0 ? (
              <div className="mt-4">
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  {devices.map((d, i) => (
                    <span
                      key={d.name}
                      className={DEVICE_SHADE[i % DEVICE_SHADE.length]}
                      style={{ width: `${(d.activeUsers / deviceTotal) * 100}%` }}
                    />
                  ))}
                </div>
                <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  {devices.map((d, i) => (
                    <li key={d.name} className="flex items-center gap-1.5">
                      <span
                        className={`size-1.5 rounded-full ${DEVICE_SHADE[i % DEVICE_SHADE.length]}`}
                      />
                      <span className="flex-1">{DEVICE_LABEL[d.name] ?? d.name}</span>
                      <span className="tabular-nums text-foreground">{d.activeUsers}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-muted-foreground">Sem sessões ativas.</p>
            )}
          </div>

          <div className="h-[170px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.minutes} barCategoryGap="22%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="minutesAgo"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => (v === 0 ? "agora" : `-${v}m`)}
                  ticks={ticks}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <ReTooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                  labelFormatter={(v) => (v === 0 ? "agora" : `há ${v} min`)}
                />
                <Bar
                  dataKey="activeUsers"
                  name="Usuários"
                  radius={[3, 3, 0, 0]}
                  fill="var(--chart-1)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="min-w-0 lg:border-l lg:pl-6">
            <p className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Páginas sendo lidas</span>
              <span className="tabular-nums">{pages.length}</span>
            </p>
            {pages.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma página ativa agora.</p>
            ) : (
              <ul className="divide-y text-xs">
                {pages.slice(0, 6).map((p) => (
                  <li key={p.pagePath} className="flex items-center gap-3 py-1.5">
                    <span className="min-w-0 flex-1 truncate" title={p.pagePath}>
                      {p.pagePath || "(sem título)"}
                    </span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                      {p.activeUsers}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {pages.length > 6 ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                + {pages.length - 6} outras páginas
              </p>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}

function MoversTable({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { pagePath: string; title: string; views: number; prevViews: number; delta: number }[];
}) {
  return (
    <Card title={title} action={icon}>
      <ul className="space-y-2 text-xs">
        {rows.length === 0 && <li className="text-muted-foreground">Sem dados no período.</li>}
        {rows.map((r) => (
          <li key={r.pagePath} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate" title={`${r.title} — ${r.pagePath}`}>
              {r.title || r.pagePath}
            </span>
            <span className="tabular-nums text-muted-foreground">{fmtInt(r.views)}</span>
            <Delta current={r.views} previous={r.prevViews} />
          </li>
        ))}
      </ul>
    </Card>
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
  const query = useGa4Report(propertyId, startDate, endDate);

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <BlockSkeleton height={150} />
        <KpiSkeleton />
        <BlockSkeleton height={280} />
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
      <RealtimePanel propertyId={propertyId} />

      <KpiGrid
        kpis={d.kpis}
        prev={d.prevKpis}
        series={{
          sessions: d.timeseries.map((t) => t.sessions),
          users: d.timeseries.map((t) => t.users),
          views: d.timeseries.map((t) => t.views),
        }}
      />

      <Card title="Sessões, usuários e visualizações">
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
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
                tickLine={false}
                width={40}
              />
              <ReTooltip contentStyle={tooltipStyle} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
              />
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
              <Area
                type="monotone"
                dataKey="views"
                name="Visualizações"
                stroke="var(--chart-4)"
                fill="transparent"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Artigos mais lidos">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Artigo</th>
                <th className="py-2 pr-3 text-right font-medium">Views</th>
                <th className="py-2 pr-3 text-right font-medium">Usuários</th>
                <th className="py-2 pr-3 text-right font-medium">Tempo médio</th>
                <th className="py-2 text-right font-medium">Engajamento</th>
              </tr>
            </thead>
            <tbody>
              {d.pages.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-muted-foreground">
                    Sem dados no período.
                  </td>
                </tr>
              )}
              {d.pages.slice(0, 25).map((p) => (
                <tr key={p.pagePath} className="border-b last:border-0">
                  <td className="max-w-[420px] py-2 pr-3">
                    <span className="block truncate font-medium">{p.title || p.pagePath}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.pagePath}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtInt(p.views)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtInt(p.users)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtDur(p.avgDuration)}</td>
                  <td className="py-2 text-right tabular-nums">{fmtPct(p.engagementRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <MoversTable
          title="Em alta vs. período anterior"
          icon={<TrendingUp className="size-4 text-chart-2" />}
          rows={d.gainers}
        />
        <MoversTable
          title="Perdendo tráfego"
          icon={<TrendingDown className="size-4 text-destructive" />}
          rows={d.decliners}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Páginas de entrada">
          <ul className="space-y-2 text-xs">
            {d.landingPages.length === 0 && <li className="text-muted-foreground">Sem dados.</li>}
            {d.landingPages.map((p) => (
              <li key={p.pagePath} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{p.pagePath || "(direto)"}</span>
                <span className="tabular-nums">{fmtInt(p.sessions)}</span>
                <span className="w-14 text-right tabular-nums text-muted-foreground">
                  {fmtPct(p.engagementRate)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Origem / mídia">
          <ul className="space-y-2 text-xs">
            {d.sources.map((s) => (
              <li key={s.name} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="tabular-nums">{fmtInt(s.sessions)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Canais de aquisição">
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={d.channels}
                  dataKey="sessions"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                >
                  {d.channels.map((c, i) => (
                    <Cell key={c.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <ReTooltip contentStyle={tooltipStyle} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Novos vs. recorrentes">
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={d.newVsReturning}
                  dataKey="sessions"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                >
                  {d.newVsReturning.map((c, i) => (
                    <Cell key={c.name} fill={CHART_COLORS[(i + 1) % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <ReTooltip contentStyle={tooltipStyle} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Melhores horários para publicar">
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.hours}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                  tickLine={false}
                  interval={1}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                  tickLine={false}
                  width={36}
                />
                <ReTooltip contentStyle={tooltipStyle} labelFormatter={(v) => `${v}h`} />
                <Bar
                  dataKey="sessions"
                  name="Sessões"
                  radius={[6, 6, 0, 0]}
                  fillOpacity={0.85}
                  fill="var(--chart-3)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Dias da semana">
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.weekdays}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                  tickLine={false}
                  width={36}
                />
                <ReTooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="sessions"
                  name="Sessões"
                  radius={[6, 6, 0, 0]}
                  fillOpacity={0.85}
                  fill="var(--chart-5)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Dispositivos">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.devices}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                  tickLine={false}
                  width={36}
                />
                <ReTooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="sessions"
                  name="Sessões"
                  radius={[6, 6, 0, 0]}
                  fill="var(--chart-1)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Países">
          <ul className="space-y-2 text-xs">
            {d.countries.map((c) => (
              <li key={c.name} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="tabular-nums">{fmtInt(c.sessions)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Cidades">
          <ul className="space-y-2 text-xs">
            {d.cities.map((c) => (
              <li key={c.name} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="tabular-nums">{fmtInt(c.sessions)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

type SortKey =
  "blog" | "sessions" | "activeUsers" | "screenPageViews" | "engagementRate" | "activeNow";

function AllBlogsView({
  properties,
  startDate,
  endDate,
}: {
  properties: BlogPropertyRow[];
  startDate: string;
  endDate: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "sessions",
    desc: true,
  });
  const query = useGa4Summaries(
    properties.map((p) => p.ga4_property_id),
    startDate,
    endDate,
  );

  const rows = useMemo(() => {
    const list = (query.data ?? []).map((s) => {
      const blog = properties.find((p) => p.ga4_property_id === s.propertyId);
      return { ...s, blog: blog?.blog_name ?? s.propertyId };
    });
    const dir = sort.desc ? -1 : 1;
    return [...list].sort((a, b) =>
      sort.key === "blog"
        ? a.blog.localeCompare(b.blog) * dir
        : sort.key === "activeNow"
          ? (a.activeNow - b.activeNow) * dir
          : (a.kpis[sort.key] - b.kpis[sort.key]) * dir,
    );
  }, [query.data, properties, sort]);

  const totals = useMemo(() => {
    const sum = (pick: (r: (typeof rows)[number]) => number) =>
      rows.reduce((a, r) => a + pick(r), 0);
    const weighted = (
      pick: (k: Ga4Kpis) => number,
      sessions: (r: (typeof rows)[number]) => number,
    ) => {
      const total = sum(sessions);
      return total ? rows.reduce((a, r) => a + pick(r.kpis) * sessions(r), 0) / total : 0;
    };
    const curr: Ga4Kpis = {
      sessions: sum((r) => r.kpis.sessions),
      activeUsers: sum((r) => r.kpis.activeUsers),
      newUsers: sum((r) => r.kpis.newUsers),
      screenPageViews: sum((r) => r.kpis.screenPageViews),
      eventCount: sum((r) => r.kpis.eventCount),
      engagementRate: weighted(
        (k) => k.engagementRate,
        (r) => r.kpis.sessions,
      ),
      bounceRate: weighted(
        (k) => k.bounceRate,
        (r) => r.kpis.sessions,
      ),
      averageSessionDuration: weighted(
        (k) => k.averageSessionDuration,
        (r) => r.kpis.sessions,
      ),
    };
    const prev: Ga4Kpis = {
      sessions: sum((r) => r.prevKpis.sessions),
      activeUsers: sum((r) => r.prevKpis.activeUsers),
      newUsers: sum((r) => r.prevKpis.newUsers),
      screenPageViews: sum((r) => r.prevKpis.screenPageViews),
      eventCount: sum((r) => r.prevKpis.eventCount),
      engagementRate: weighted(
        (k) => k.engagementRate,
        (r) => r.prevKpis.sessions,
      ),
      bounceRate: weighted(
        (k) => k.bounceRate,
        (r) => r.prevKpis.sessions,
      ),
      averageSessionDuration: weighted(
        (k) => k.averageSessionDuration,
        (r) => r.prevKpis.sessions,
      ),
    };
    return { curr, prev, activeNow: sum((r) => r.activeNow) };
  }, [rows]);

  const combined = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows)
      for (const t of r.timeseries) map.set(t.date, (map.get(t.date) ?? 0) + t.sessions);
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, sessions]) => ({ label: fmtDay(date), sessions }));
  }, [rows]);

  const topArticles = useMemo(
    () =>
      rows
        .flatMap((r) => r.topPages.slice(0, 10).map((p) => ({ ...p, blog: r.blog })))
        .sort((a, b) => b.views - a.views)
        .slice(0, 15),
    [rows],
  );

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
      <div className="surface flex items-center gap-3 p-4">
        <LiveDot users={totals.activeNow} label={false} />
        <div>
          <p className="text-2xl font-bold tracking-tight">{fmtInt(totals.activeNow)}</p>
          <p className="text-xs text-muted-foreground">leitores online agora em todos os blogs</p>
        </div>
      </div>

      <KpiGrid kpis={totals.curr} prev={totals.prev} />

      <Card title="Sessões somadas (todos os blogs)">
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={combined}>
              <defs>
                <linearGradient id="gall" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
                tickLine={false}
                width={44}
              />
              <ReTooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="sessions"
                name="Sessões"
                stroke="var(--chart-1)"
                fill="url(#gall)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Comparativo por blog">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                {header("blog", "Blog", "text-left")}
                <th className="py-2 pr-3 font-medium">Tendência</th>
                {header("activeNow", "Agora")}
                {header("sessions", "Sessões")}
                <th className="py-2 pr-3 text-right font-medium">vs. anterior</th>
                {header("activeUsers", "Usuários")}
                {header("screenPageViews", "Views")}
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
                  <td className="py-2 pr-3">
                    <Sparkline values={r.timeseries.map((t) => t.sessions)} />
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <LiveDot users={r.activeNow} />
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtInt(r.kpis.sessions)}</td>
                  <td className="py-2 pr-3 text-right">
                    <Delta current={r.kpis.sessions} previous={r.prevKpis.sessions} />
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {fmtInt(r.kpis.activeUsers)}
                  </td>
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

      <Card title="Artigos campeões da rede" action={<Flame className="size-4 text-chart-4" />}>
        <ul className="space-y-2 text-xs">
          {topArticles.length === 0 && (
            <li className="text-muted-foreground">Sem dados no período.</li>
          )}
          {topArticles.map((a) => (
            <li key={`${a.blog}${a.pagePath}`} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate" title={a.pagePath}>
                {a.title || a.pagePath}
              </span>
              <span className="shrink-0 text-muted-foreground">{a.blog}</span>
              <span className="w-16 text-right tabular-nums">{fmtInt(a.views)}</span>
            </li>
          ))}
        </ul>
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
            <Label className="text-xs font-medium text-muted-foreground">{p.blog_name}</Label>
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

function TrafficTab() {
  const props = useBlogProperties();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("all");
  const [preset, setPreset] = useState<string>("28");
  const [customStart, setCustomStart] = useState(daysAgo(28));
  const [customEnd, setCustomEnd] = useState(iso(new Date()));
  const [showConfig, setShowConfig] = useState(false);

  const startDate = preset === "custom" ? customStart : daysAgo(Number(preset));
  const endDate = preset === "custom" ? customEnd : iso(new Date());

  const configured = (props.data ?? []).filter((p) => p.ga4_property_id.trim() !== "");

  const shortDate = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const rangeLabel = `${shortDate(startDate)} – ${shortDate(endDate)}`;

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Tempo real, tendências e desempenho editorial direto do Google Analytics 4"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                void qc.invalidateQueries({ queryKey: ["ga4"] });
                toast.success("Atualizando dados do GA4");
              }}
            >
              <RefreshCw className="size-4" /> Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowConfig((v) => !v)}
            >
              <Settings2 className="size-4" /> Property IDs
            </Button>
          </div>
        }
      />

      <div className="panel mb-5 flex flex-wrap items-end gap-x-4 gap-y-3 p-4">
        <div className="min-w-[220px] space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">Blog</Label>
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
          <Label className="text-xs font-medium text-muted-foreground">Período</Label>
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
              <Label className="text-xs font-medium text-muted-foreground">De</Label>
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Até</Label>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          </>
        )}
        <p className="ml-auto self-center text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{rangeLabel}</span> · comparado ao período
          anterior de mesma duração
        </p>
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

function AnalyticsPage() {
  const { aba } = Route.useSearch();
  const navigate = useNavigate();
  const tab = aba === "receita" ? "receita" : "trafego";

  return (
    <Tabs
      value={tab}
      onValueChange={(v) =>
        void navigate({
          to: "/analytics",
          search: v === "receita" ? { aba: "receita" } : {},
          replace: true,
        })
      }
    >
      <TabsList className="mb-5 h-10 w-full sm:w-auto">
        <TabsTrigger value="trafego" className="flex-1 gap-2 sm:flex-none">
          <BarChart3 className="size-4" /> Tráfego (GA4)
        </TabsTrigger>
        <TabsTrigger value="receita" className="flex-1 gap-2 sm:flex-none">
          <DollarSign className="size-4" /> Receita (Adsterra)
        </TabsTrigger>
      </TabsList>
      <TabsContent value="trafego" className="mt-0">
        <TrafficTab />
      </TabsContent>
      <TabsContent value="receita" className="mt-0">
        <AdsterraPanel />
      </TabsContent>
    </Tabs>
  );
}
