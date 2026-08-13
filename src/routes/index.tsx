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
import { FileText, FolderTree, Newspaper, Plus, Rocket, CalendarClock, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui-bits";
import { useStore } from "@/lib/store";
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

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="surface p-5">
          <h2 className="text-sm font-semibold">Postagens por status</h2>
          <div className="mt-4 space-y-3">
            {(
              [
                ["rascunho", PenLine],
                ["agendado", CalendarClock],
                ["publicado", Rocket],
              ] as const
            ).map(([status, Icon]) => {
              const total = byStatus[status];
              const pct = posts.length ? Math.round((total / posts.length) * 100) : 0;
              return (
                <div key={status}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Icon className="size-3.5" />
                      <StatusBadge status={status} />
                    </span>
                    <span className="font-medium">{total}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="gradient-brand h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
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
