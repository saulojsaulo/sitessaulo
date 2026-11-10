import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  DollarSign,
  ExternalLink,
  Eye,
  Gauge,
  KeyRound,
  MousePointerClick,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { FxCard } from "@/components/fx-card";
import { Card, ErrorBox, Kpi, tooltipStyle } from "@/components/analytics-bits";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmtCompact, fmtInt, fmtPct } from "@/lib/use-ga4";
import { ADSTERRA_REFRESH_MS, isAdsterraSetupError, useAdsterra } from "@/lib/use-adsterra";
import { useUsdBrl } from "@/lib/use-fx";
import { brl } from "@/lib/fx-format";
import { ADSTERRA_RANGES, type AdsterraRange } from "@/lib/adsterra-types";

/* ------------------------------ Formatação ------------------------------ */

const usd2 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usd3 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
/** Valores abaixo de US$ 1 ganham uma casa a mais para não virarem "US$ 0,00". */
const usd = (v: number) => (v !== 0 && Math.abs(v) < 1 ? usd3 : usd2).format(v);
const usdAxis = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(v < 10 ? 2 : 0)}`;

const shortDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const longDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["pt-BR"], { type: "region" })
    : null;

function countryName(code: string): string {
  const c = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return code;
  try {
    return regionNames?.of(c) ?? c;
  } catch {
    return c;
  }
}

const PERIOD_PHRASE: Record<AdsterraRange, string> = {
  today: "de hoje",
  yesterday: "de ontem",
  "7d": "dos últimos 7 dias",
  "14d": "dos últimos 14 dias",
  "30d": "dos últimos 30 dias",
  month: "do mês",
};

const METRICS = [
  { id: "revenue", label: "Receita", fmt: usd, axis: usdAxis },
  { id: "impressions", label: "Impressões", fmt: fmtInt, axis: fmtCompact },
  { id: "clicks", label: "Cliques", fmt: fmtInt, axis: fmtCompact },
  { id: "cpm", label: "CPM", fmt: usd, axis: usdAxis },
] as const;
type MetricId = (typeof METRICS)[number]["id"];

/* -------------------------------- Helpers -------------------------------- */

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap gap-0.5 rounded-lg bg-muted p-1"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs sm:text-sm",
            value === o.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ShareBar({ pct }: { pct: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

function SetupCard() {
  return (
    <div className="panel mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground">
        <KeyRound className="size-5" />
      </span>
      <h2 className="text-base font-semibold">Conecte sua conta Adsterra</h2>
      <p className="text-sm text-muted-foreground">
        O PostFlow ainda não encontrou o token da API. Ele fica só no servidor, nunca no navegador.
      </p>
      <ol className="mt-1 space-y-1.5 text-left text-sm text-muted-foreground">
        <li>
          <strong className="text-foreground">1.</strong> No painel da Adsterra: Settings → API →{" "}
          <em>Generate new token</em>.
        </li>
        <li>
          <strong className="text-foreground">2.</strong> Defina a variável de ambiente abaixo no
          servidor do PostFlow (junto de <code>OPENAI_API_KEY</code>).
        </li>
        <li>
          <strong className="text-foreground">3.</strong> Recarregue esta página.
        </li>
      </ol>
      <code className="mt-1 rounded-md border bg-muted px-3 py-2 text-xs">
        ADSTERRA_API_KEY=seu_token_aqui
      </code>
      <a
        href="https://help-publishers.adsterra.com/en/articles/5385760-api"
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        Documentação da API <ExternalLink className="size-3" />
      </a>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel space-y-3 p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
      <div className="panel p-5">
        <Skeleton className="mb-4 h-4 w-40" />
        <Skeleton className="h-[280px] w-full" />
      </div>
    </div>
  );
}

/* -------------------------------- Painel -------------------------------- */

export function AdsterraPanel() {
  const [range, setRange] = useState<AdsterraRange>("7d");
  const [domain, setDomain] = useState("all");
  const [live, setLive] = useState(true);
  const [metricId, setMetricId] = useState<MetricId>("revenue");
  const [showAllPlacements, setShowAllPlacements] = useState(false);

  const q = useAdsterra(range, domain === "all" ? undefined : domain, live);
  const fxq = useUsdBrl(live);
  const bid = fxq.data?.bid ?? null;
  const now = useNow();
  const data = q.data;
  const errorMessage = q.error instanceof Error ? q.error.message : null;

  const metric = METRICS.find((m) => m.id === metricId) ?? METRICS[0];
  const placementRevenue = useMemo(
    () => (data?.placements ?? []).reduce((a, p) => a + p.revenue, 0),
    [data?.placements],
  );
  const countryRevenue = useMemo(
    () => (data?.countries ?? []).reduce((a, c) => a + c.revenue, 0),
    [data?.countries],
  );

  const secondsAgo = q.dataUpdatedAt
    ? Math.max(0, Math.floor((now - q.dataUpdatedAt) / 1000))
    : null;
  const nextIn =
    secondsAgo === null ? null : Math.max(0, Math.round(ADSTERRA_REFRESH_MS / 1000) - secondsAgo);

  if (errorMessage && isAdsterraSetupError(errorMessage) && !data) {
    return (
      <div>
        <PageHeader
          title="Receita (Adsterra)"
          subtitle="Receita, impressões, cliques, CTR e CPM dos anúncios instalados nos seus sites"
        />
        <SetupCard />
      </div>
    );
  }

  const t = data?.totals;
  const p = data?.prevTotals;

  return (
    <div>
      <PageHeader
        title="Receita (Adsterra)"
        subtitle="Receita, impressões, cliques, CTR e CPM dos anúncios instalados nos seus sites"
      />

      <div className="panel mb-5 flex flex-wrap items-end gap-x-5 gap-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Período</Label>
          <Segmented label="Período" value={range} options={ADSTERRA_RANGES} onChange={setRange} />
        </div>

        {data && data.domains.length > 0 ? (
          <div className="flex min-w-[12rem] flex-col gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Site</Label>
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os sites</SelectItem>
                {data.domains.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          <div
            className="flex items-center gap-2 text-xs text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <span className="relative grid size-2 place-items-center">
              {live && !q.isFetching && !q.isError ? (
                <span className="absolute size-2 animate-ping rounded-full bg-success/60" />
              ) : null}
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  q.isFetching
                    ? "bg-warning"
                    : q.isError
                      ? "bg-destructive"
                      : live
                        ? "bg-success"
                        : "bg-muted-foreground/60",
                )}
              />
            </span>
            <span className="tabular-nums">
              {q.isFetching
                ? "Atualizando…"
                : secondsAgo === null
                  ? "Carregando…"
                  : `Atualizado há ${secondsAgo}s${
                      live ? ` · próxima em ${nextIn}s` : " · atualização pausada"
                    }`}
            </span>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
            <Switch checked={live} onCheckedChange={setLive} aria-label="Atualização automática" />
            Ao vivo
          </label>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={q.isFetching}
            onClick={() => void q.refetch()}
          >
            <RefreshCw className={cn("size-4", q.isFetching && "animate-spin")} /> Atualizar
          </Button>
        </div>
      </div>

      {q.isPending && !data ? <LoadingSkeleton /> : null}

      {q.isError && !data ? (
        <ErrorBox
          title="Não foi possível carregar os dados da Adsterra."
          message={errorMessage ?? "Erro desconhecido"}
          onRetry={() => void q.refetch()}
        />
      ) : null}

      {data && t && p ? (
        <div className={cn("space-y-4 transition-opacity", q.isPlaceholderData && "opacity-60")}>
          {q.isError ? (
            <div className="tone-warning flex items-start gap-2 rounded-lg border p-3 text-xs">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Não foi possível atualizar agora ({errorMessage}). Mostrando os dados de{" "}
                {new Date(data.fetchedAt).toLocaleTimeString("pt-BR")}.
              </span>
            </div>
          ) : null}
          {data.warnings.length > 0 ? (
            <div className="tone-warning flex items-start gap-2 rounded-lg border p-3 text-xs">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>Alguns blocos ficaram incompletos: {data.warnings.join(" · ")}</span>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icon={<DollarSign className="size-3.5" />}
              label="Receita"
              value={usd(t.revenue)}
              current={t.revenue}
              previous={p.revenue}
              {...(bid !== null ? { hint: `≈ ${brl(t.revenue * bid)} (dólar de hoje)` } : {})}
            />
            <Kpi
              icon={<Eye className="size-3.5" />}
              label="Impressões"
              value={fmtInt(t.impressions)}
              current={t.impressions}
              previous={p.impressions}
              series={data.daily.map((d) => d.impressions)}
            />
            <Kpi
              icon={<MousePointerClick className="size-3.5" />}
              label="Cliques"
              value={fmtInt(t.clicks)}
              current={t.clicks}
              previous={p.clicks}
              hint={`CTR ${fmtPct(t.ctr)} (anterior ${fmtPct(p.ctr)})`}
              series={data.daily.map((d) => d.clicks)}
            />
            <Kpi
              icon={<Gauge className="size-3.5" />}
              label="CPM médio"
              value={usd(t.cpm)}
              current={t.cpm}
              previous={p.cpm}
              hint="Receita por mil impressões"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card
              className="flex flex-col lg:col-span-2"
              title="Evolução diária"
              subtitle={
                data.range.start === data.range.finish
                  ? longDate(data.range.start)
                  : `${longDate(data.range.start)} – ${longDate(data.range.finish)}`
              }
              action={
                <Segmented
                  label="Métrica do gráfico"
                  size="sm"
                  value={metricId}
                  options={METRICS.map((m) => ({ id: m.id, label: m.label }))}
                  onChange={setMetricId}
                />
              }
            >
              <div className="relative min-h-[280px] w-full min-w-0 flex-1">
                <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%">
                    {data.daily.length > 2 ? (
                      <AreaChart
                        data={data.daily}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="adsterraFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={shortDate}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={24}
                        />
                        <YAxis
                          tickFormatter={(v: number) => metric.axis(v)}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                          width={52}
                        />
                        <ReTooltip
                          contentStyle={tooltipStyle}
                          labelFormatter={(d) => longDate(String(d))}
                          formatter={(v) => [metric.fmt(Number(v)), metric.label]}
                        />
                        <Area
                          type="monotone"
                          dataKey={metricId}
                          stroke="var(--chart-1)"
                          strokeWidth={2}
                          fill="url(#adsterraFill)"
                          activeDot={{ r: 4 }}
                        />
                      </AreaChart>
                    ) : (
                      <BarChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={shortDate}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickFormatter={(v: number) => metric.axis(v)}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                          width={52}
                        />
                        <ReTooltip
                          contentStyle={tooltipStyle}
                          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                          labelFormatter={(d) => longDate(String(d))}
                          formatter={(v) => [metric.fmt(Number(v)), metric.label]}
                        />
                        <Bar
                          dataKey={metricId}
                          fill="var(--chart-1)"
                          radius={[4, 4, 0, 0]}
                          barSize={48}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
            <FxCard
              className="lg:col-span-1"
              revenueUsd={t.revenue}
              cpmUsd={t.cpm}
              periodLabel={PERIOD_PHRASE[data.range.id]}
              live={live}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card
              className="lg:col-span-3"
              title="Receita por placement"
              subtitle={`${data.placements.length} placement(s) com atividade no período`}
            >
              {data.placements.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sem dados de placements neste período.
                </p>
              ) : (
                <>
                  <div className="-mx-1 overflow-x-auto px-1">
                    <table className="w-full min-w-[540px] text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                          <th className="pb-2 font-medium">Placement</th>
                          <th className="pb-2 text-right font-medium">Impr.</th>
                          <th className="pb-2 text-right font-medium">Cliques</th>
                          <th className="pb-2 text-right font-medium">CTR</th>
                          <th className="pb-2 text-right font-medium">CPM</th>
                          <th className="w-[140px] pb-2 text-right font-medium">Receita</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(showAllPlacements ? data.placements : data.placements.slice(0, 8)).map(
                          (row) => (
                            <tr key={`${row.id}-${row.name}`}>
                              <td className="max-w-[220px] py-2.5 pr-3">
                                <div className="truncate font-medium" title={row.name}>
                                  {row.name}
                                </div>
                                {row.domain ? (
                                  <div className="truncate text-xs text-muted-foreground">
                                    {row.domain}
                                  </div>
                                ) : null}
                              </td>
                              <td className="py-2.5 text-right tabular-nums">
                                {fmtInt(row.impressions)}
                              </td>
                              <td className="py-2.5 text-right tabular-nums">
                                {fmtInt(row.clicks)}
                              </td>
                              <td className="py-2.5 text-right tabular-nums">{fmtPct(row.ctr)}</td>
                              <td className="py-2.5 text-right tabular-nums">{usd(row.cpm)}</td>
                              <td className="py-2.5 pl-3 text-right">
                                <div className="font-semibold tabular-nums">{usd(row.revenue)}</div>
                                <div className="mt-1">
                                  <ShareBar
                                    pct={
                                      placementRevenue ? (row.revenue / placementRevenue) * 100 : 0
                                    }
                                  />
                                </div>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                  {data.placements.length > 8 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => setShowAllPlacements((v) => !v)}
                    >
                      {showAllPlacements
                        ? "Mostrar menos"
                        : `Mostrar todos (${data.placements.length})`}
                    </Button>
                  ) : null}
                </>
              )}
            </Card>

            <Card
              className="lg:col-span-2"
              title="Receita por país"
              subtitle="Maiores origens de receita"
            >
              {data.countries.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sem dados de países neste período.
                </p>
              ) : (
                <ul className="space-y-3.5">
                  {data.countries.slice(0, 8).map((c) => (
                    <li key={c.code}>
                      <div className="flex items-center gap-2">
                        <span className="grid h-5 min-w-7 place-items-center rounded bg-muted px-1 text-[10px] font-semibold">
                          {c.code.slice(0, 3).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {countryName(c.code)}
                        </span>
                        <span className="text-sm font-semibold tabular-nums">{usd(c.revenue)}</span>
                      </div>
                      <div className="mt-1.5">
                        <ShareBar pct={countryRevenue ? (c.revenue / countryRevenue) * 100 : 0} />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {fmtInt(c.impressions)} impr. · CPM {usd(c.cpm)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Fonte: API de Publisher da Adsterra · a Adsterra guarda cada resposta por 60 s, por isso
            o painel atualiza a cada minuto · datas consultadas em UTC · comparação com os{" "}
            {data.range.days} dia(s) imediatamente anteriores ({longDate(data.range.prevStart)} –{" "}
            {longDate(data.range.prevFinish)}).
          </p>

          <details className="panel p-4 text-xs">
            <summary className="cursor-pointer font-medium text-muted-foreground">
              Diagnóstico da resposta (para suporte)
            </summary>
            <p className="mt-2 text-muted-foreground">
              Primeiro item bruto devolvido pela Adsterra em cada consulta. Útil se algum número
              parecer errado.
            </p>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3">
              {JSON.stringify(data.diagnostic, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
