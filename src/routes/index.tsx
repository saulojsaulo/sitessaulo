import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FileText,
  FolderTree,
  Newspaper,
  Plus,
  Rocket,
  CalendarClock,
  PenLine,
  ListTree,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui-bits";
import { Delta, LiveDot, Sparkline } from "@/components/metric-bits";
import { useStore } from "@/lib/store";
import { useWpConnections, useWpPublications } from "@/lib/use-wp";
import {
  daysAgo,
  fmtInt,
  fmtPct,
  iso,
  propertyIdFor,
  useBlogProperties,
  useGa4Summaries,
} from "@/lib/use-ga4";
import type { PostStatus } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — PostFlow" },
      {
        name: "description",
        content: "Visão geral dos seus blogs, postagens por status e distribuição por categoria.",
      },
      { property: "og:title", content: "Dashboard — PostFlow" },
      {
        property: "og:description",
        content: "Acompanhe totais de blogs, postagens e o gráfico por categoria.",
      },
    ],
  }),
  component: Dashboard,
});

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="surface flex items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <span
        className={
          accent
            ? "gradient-brand grid size-11 place-items-center rounded-xl text-primary-foreground"
            : "grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground"
        }
      >
        {icon}
      </span>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/** Painel multi-blog: publicados / agendados / rascunhos por site WordPress. */
function WpOverview() {
  const connections = useWpConnections();
  const publications = useWpPublications();
  const conns = connections.data ?? [];
  const pubs = publications.data ?? [];

  if (conns.length === 0)
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum site WordPress conectado ainda.
      </p>
    );

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {conns.map((c) => {
        const list = pubs.filter((p) => p.connection_id === c.id);
        const n = (s: string) => list.filter((p) => p.status === s).length;
        return (
          <Link
            key={c.id}
            to="/agendadas"
            className="rounded-lg border p-3 transition-colors hover:bg-accent"
          >
            <div className="truncate text-sm font-semibold">{c.name}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="text-success">{n("publicado")} publicados</span>
              <span className="text-warning">{n("agendado")} agendados</span>
              <span>{n("rascunho")} rascunhos</span>
              {n("falhou") > 0 && <span className="text-destructive">{n("falhou")} falhas</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function Dashboard() {
  const { blogs, categories, posts, hydrated } = useStore();

  const byStatus = useMemo(() => {
    const acc: Record<PostStatus, number> = {
      rascunho: 0,
      estrutura: 0,
      artigo_completo: 0,
      agendado: 0,
      publicado: 0,
    };
    for (const p of posts) acc[p.status] += 1;
    return acc;
  }, [posts]);

  const chartData = useMemo(
    () =>
      categories
        .map((c) => ({
          name: c.name.length > 12 ? `${c.name.slice(0, 12)}…` : c.name,
          total: posts.filter((p) => p.categoryId === c.id).length,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
    [categories, posts],
  );

  const recent = useMemo(
    () => [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [posts],
  );

  const gaProps = useBlogProperties();
  const gaIds = (gaProps.data ?? [])
    .map((p) => p.ga4_property_id.trim())
    .filter((id) => id !== "");
  const gaSummaries = useGa4Summaries(gaIds, daysAgo(28), iso(new Date()));

  const traffic = useMemo(() => {
    const list = (gaSummaries.data ?? []).filter((s) => s.ok);
    if (list.length === 0) return null;
    const sessions = list.reduce((a, s) => a + s.kpis.sessions, 0);
    const prevSessions = list.reduce((a, s) => a + s.prevKpis.sessions, 0);
    const views = list.reduce((a, s) => a + s.kpis.screenPageViews, 0);
    const users = list.reduce((a, s) => a + s.kpis.activeUsers, 0);
    const activeNow = list.reduce((a, s) => a + s.activeNow, 0);
    const engagement = sessions
      ? list.reduce((a, s) => a + s.kpis.engagementRate * s.kpis.sessions, 0) / sessions
      : 0;
    const byDate = new Map<string, number>();
    for (const s of list)
      for (const t of s.timeseries) byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.sessions);
    const spark = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
    const perBlog = blogs
      .map((b) => {
        const pid = propertyIdFor(gaProps.data, b);
        const s = pid ? list.find((x) => x.propertyId === pid) : undefined;
        return s ? { blog: b, summary: s } : null;
      })
      .filter((x): x is { blog: (typeof blogs)[number]; summary: (typeof list)[number] } => x !== null)
      .sort((a, b) => b.summary.kpis.sessions - a.summary.kpis.sessions)
      .slice(0, 5);
    return { sessions, prevSessions, views, users, activeNow, engagement, spark, perBlog };
  }, [gaSummaries.data, blogs, gaProps.data]);

  if (hydrated && blogs.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Bem-vindo ao PostFlow" />
        <EmptyState
          icon={<Rocket className="size-7" />}
          title="Comece cadastrando um blog"
          description="Depois você poderá criar categorias e organizar todas as suas postagens em um só lugar."
          action={
            <Button asChild className="mt-2 gap-2">
              <Link to="/blogs">
                <Plus className="size-4" /> Cadastrar blog
              </Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do seu calendário editorial"
        action={
          <Button asChild className="gap-2">
            <Link to="/postagens">
              <Plus className="size-4" /> Nova postagem
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Blogs" value={blogs.length} icon={<Newspaper className="size-5" />} accent />
        <StatCard label="Categorias" value={categories.length} icon={<FolderTree className="size-5" />} />
        <StatCard label="Postagens" value={posts.length} icon={<FileText className="size-5" />} />
        <StatCard label="Publicadas" value={byStatus.publicado} icon={<Rocket className="size-5" />} />
      </div>

      {traffic ? (
        <div className="surface mt-4 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Tráfego (últimos 28 dias)</h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <LiveDot users={traffic.activeNow} /> online agora
              </span>
              <Link to="/analytics" className="text-primary hover:underline">
                Ver Analytics →
              </Link>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Sessões</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold tracking-tight">{fmtInt(traffic.sessions)}</p>
                <Delta current={traffic.sessions} previous={traffic.prevSessions} />
              </div>
              <Sparkline values={traffic.spark} width={140} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Usuários</p>
              <p className="text-2xl font-bold tracking-tight">{fmtInt(traffic.users)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Visualizações</p>
              <p className="text-2xl font-bold tracking-tight">{fmtInt(traffic.views)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Engajamento</p>
              <p className="text-2xl font-bold tracking-tight">{fmtPct(traffic.engagement)}</p>
            </div>
          </div>
          {traffic.perBlog.length > 0 ? (
            <ul className="mt-4 divide-y border-t text-xs">
              {traffic.perBlog.map(({ blog, summary }) => (
                <li key={blog.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{blog.name}</span>
                  <Sparkline values={summary.timeseries.map((t) => t.sessions)} />
                  <span className="w-16 text-right tabular-nums">{fmtInt(summary.kpis.sessions)}</span>
                  <Delta current={summary.kpis.sessions} previous={summary.prevKpis.sessions} />
                  <LiveDot users={summary.activeNow} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="surface p-5">
          <h2 className="text-sm font-semibold">Postagens por status</h2>
          <div className="mt-4 space-y-3">
            {(
              [
                ["rascunho", PenLine],
                ["estrutura", ListTree],
                ["artigo_completo", CheckCircle2],
                ["agendado", CalendarClock],
                ["publicado", Rocket],
              ] as const
            ).map(([status, Icon]) => {
              const total = byStatus[status];
              const pct = posts.length ? Math.round((total / posts.length) * 100) : 0;
              return (
                <Link
                  key={status}
                  to="/postagens"
                  search={{ status }}
                  title={`Ir para as postagens com status ${status}`}
                  className="group block rounded-lg p-1.5 transition-colors hover:bg-accent/60"
                >
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Icon className="size-3.5" />
                      <StatusBadge status={status} />
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium">
                      {total}
                      <ChevronRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-70" />
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="gradient-brand h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="surface p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Postagens por categoria</h2>
          {chartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Crie categorias para visualizar o gráfico.
            </p>
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    stroke="var(--color-border)"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    stroke="var(--color-border)"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "0.75rem",
                      color: "var(--color-popover-foreground)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="total" name="Postagens" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="surface mt-4 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Sites WordPress conectados</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/conexoes">Gerenciar conexões</Link>
          </Button>
        </div>
        <WpOverview />
      </div>

      <div className="surface mt-4 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Postagens recentes</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/postagens">Ver todas</Link>
          </Button>
        </div>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma postagem cadastrada ainda.
          </p>
        ) : (
          <ul className="divide-y">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {p.cover ? (
                    <img src={p.cover} alt="" className="size-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      <FileText className="size-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {blogs.find((b) => b.id === p.blogId)?.name ?? "—"} ·{" "}
                    {categories.find((c) => c.id === p.categoryId)?.name ?? "Sem categoria"}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
