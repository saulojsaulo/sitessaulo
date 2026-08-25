import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Coins, Cpu, RefreshCw, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";

/** Preço aproximado do google/gemini-3.7-flash (USD por 1M de tokens). Estimativa. */
const PRICE_IN = 0.3;
const PRICE_OUT = 2.5;

interface UsageRow {
  id: string;
  created_at: string;
  kind: string;
  post_title: string | null;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated: boolean;
  duration_ms: number;
  ok: boolean;
  error: string | null;
}

const KIND_LABEL: Record<string, string> = {
  estrutura: "Estrutura",
  sessao: "Sessão",
  outro: "Outro",
};

const fmtInt = (n: number) => n.toLocaleString("pt-BR");
const fmtUsd = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function AiUsagePanel() {
  const [days, setDays] = useState("30");
  const [kind, setKind] = useState("all");

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - Number(days));
    return d.toISOString();
  }, [days]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["ai-usage", days, kind],
    queryFn: async (): Promise<UsageRow[]> => {
      let q = supabase
        .from("ai_usage")
        .select(
          "id, created_at, kind, post_title, model, prompt_tokens, completion_tokens, total_tokens, estimated, duration_ms, ok, error",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (kind !== "all") q = q.eq("kind", kind);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as UsageRow[];
    },
  });

  const rows = data ?? [];

  const stats = useMemo(() => {
    const todayKey = new Date().toDateString();
    let today = 0;
    let inTok = 0;
    let outTok = 0;
    let fails = 0;
    let ms = 0;
    for (const r of rows) {
      if (new Date(r.created_at).toDateString() === todayKey) today += 1;
      inTok += r.prompt_tokens;
      outTok += r.completion_tokens;
      ms += r.duration_ms;
      if (!r.ok) fails += 1;
    }
    const cost = (inTok / 1_000_000) * PRICE_IN + (outTok / 1_000_000) * PRICE_OUT;
    return {
      today,
      total: rows.length,
      inTok,
      outTok,
      fails,
      cost,
      avgMs: rows.length ? Math.round(ms / rows.length) : 0,
    };
  }, [rows]);

  const chart = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = Number(days) - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    for (const r of rows) {
      const k = r.created_at.slice(0, 10);
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].map(([date, calls]) => ({
      date,
      label: date.slice(8) + "/" + date.slice(5, 7),
      calls,
    }));
  }, [rows, days]);

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Uso de IA</h2>
            <p className="text-xs text-muted-foreground">
              Gerações feitas com o Gemini · custo estimado
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="estrutura">Estrutura</SelectItem>
              <SelectItem value="sessao">Sessão</SelectItem>
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-9 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => void refetch()}
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </header>

      {isError ? (
        <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            Não foi possível ler o histórico de uso. Rode o SQL da tabela <code>ai_usage</code> no
            Supabase.
            <div className="mt-1 opacity-80">{error instanceof Error ? error.message : ""}</div>
          </div>
        </div>
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={<Zap className="size-4" />} label="Gerações hoje" value={fmtInt(stats.today)} />
            <Stat
              icon={<Cpu className="size-4" />}
              label={`Gerações (${days}d)`}
              value={fmtInt(stats.total)}
              hint={stats.fails > 0 ? `${stats.fails} com erro` : "nenhum erro"}
            />
            <Stat
              icon={<Sparkles className="size-4" />}
              label="Tokens (entrada / saída)"
              value={`${fmtInt(stats.inTok)} / ${fmtInt(stats.outTok)}`}
              hint={`média ${fmtInt(stats.avgMs)} ms por geração`}
            />
            <Stat
              icon={<Coins className="size-4" />}
              label="Custo estimado"
              value={fmtUsd(stats.cost)}
              hint="valores oficiais no painel de créditos"
            />
          </div>

          <div className="h-56 rounded-xl border p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
                <ReTooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [fmtInt(v), "gerações"]}
                />
                <Bar dataKey="calls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-2 text-left font-medium">Quando</th>
                  <th className="p-2 text-left font-medium">Tipo</th>
                  <th className="p-2 text-left font-medium">Postagem</th>
                  <th className="p-2 text-right font-medium">Tokens</th>
                  <th className="p-2 text-right font-medium">Duração</th>
                  <th className="p-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="whitespace-nowrap p-2">{fmtDate(r.created_at)}</td>
                    <td className="p-2">{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td className="max-w-[280px] truncate p-2">{r.post_title ?? "—"}</td>
                    <td className="whitespace-nowrap p-2 text-right">
                      {fmtInt(r.total_tokens)}
                      {r.estimated ? <span className="text-muted-foreground"> ~</span> : null}
                    </td>
                    <td className="whitespace-nowrap p-2 text-right">
                      {(r.duration_ms / 1000).toFixed(1)}s
                    </td>
                    <td className="p-2">
                      {r.ok ? (
                        <span className="rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-success">
                          ok
                        </span>
                      ) : (
                        <span
                          className="rounded-full border border-destructive/30 bg-destructive/15 px-2 py-0.5 text-destructive"
                          title={r.error ?? ""}
                        >
                          erro
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      Nenhuma geração registrada nesse período.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Tokens marcados com <strong>~</strong> são estimados. O custo é uma aproximação a partir
            do preço do modelo {rows[0]?.model ?? "google/gemini-3.7-flash"}.
          </p>
        </>
      )}
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
