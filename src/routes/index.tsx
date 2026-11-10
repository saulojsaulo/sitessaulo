import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Newspaper, Plus, Rocket, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui-bits";
import { Delta, LiveDot, Sparkline } from "@/components/metric-bits";
import { useStore } from "@/lib/store";
import {
  daysAgo,
  fmtInt,
  fmtPct,
  iso,
  propertyIdFor,
  useBlogProperties,
  useGa4Summaries,
} from "@/lib/use-ga4";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — PostFlow" },
      { name: "description", content: "Visão geral do tráfego dos sites CNPJ." },
      { property: "og:title", content: "Dashboard — PostFlow" },
      { property: "og:description", content: "Tráfego e sites monitorados em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { blogs, hydrated } = useStore();

  const gaProps = useBlogProperties();
  const gaIds = (gaProps.data ?? []).map((p) => p.ga4_property_id.trim()).filter((id) => id !== "");
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
      .filter(
        (x): x is { blog: (typeof blogs)[number]; summary: (typeof list)[number] } => x !== null,
      )
      .sort((a, b) => b.summary.kpis.sessions - a.summary.kpis.sessions)
      .slice(0, 5);
    return { sessions, prevSessions, views, users, activeNow, engagement, spark, perBlog };
  }, [gaSummaries.data, blogs, gaProps.data]);

  const tracked = (gaProps.data ?? []).filter((p) => p.ga4_property_id.trim() !== "").length;

  if (hydrated && blogs.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Bem-vindo ao PostFlow" />
        <EmptyState
          icon={<Rocket className="size-7" />}
          title="Comece cadastrando um site"
          description="Cadastre seus sites para acompanhar o tráfego."
          action={
            <Button asChild className="mt-2 gap-2">
              <Link to="/blogs">
                <Plus className="size-4" /> Cadastrar site
              </Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Visão geral dos seus sites" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/blogs" className="surface flex items-center gap-4 p-5 transition-all hover:shadow-lift">
          <span className="gradient-brand grid size-11 place-items-center rounded-xl text-primary-foreground">
            <Newspaper className="size-5" />
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight">{blogs.length}</p>
            <p className="text-xs text-muted-foreground">Sites</p>
          </div>
        </Link>
        <Link to="/analytics" className="surface flex items-center gap-4 p-5 transition-all hover:shadow-lift">
          <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
            <BarChart3 className="size-5" />
          </span>
          <div>
            <p className="text-2xl font-bold tracking-tight">{tracked}</p>
            <p className="text-xs text-muted-foreground">Sites com Google Analytics</p>
          </div>
        </Link>
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
                  <span className="w-16 text-right tabular-nums">
                    {fmtInt(summary.kpis.sessions)}
                  </span>
                  <Delta current={summary.kpis.sessions} previous={summary.prevKpis.sessions} />
                  <LiveDot users={summary.activeNow} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

    </>
  );
}
