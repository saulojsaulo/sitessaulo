import { useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { Card } from "@/components/analytics-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useUsdBrl } from "@/lib/use-fx";
import { brl, brlRate, parseAmount, signedPct, usdMoney } from "@/lib/fx-format";

const QUICK_AMOUNTS = [10, 100, 1000];
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

const SP = "America/Sao_Paulo";
function fmtQuoteTime(iso: string): string {
  const d = new Date(iso);
  const sameDay =
    d.toLocaleDateString("pt-BR", { timeZone: SP }) ===
    new Date().toLocaleDateString("pt-BR", { timeZone: SP });
  return sameDay
    ? d.toLocaleTimeString("pt-BR", { timeZone: SP })
    : d.toLocaleString("pt-BR", {
        timeZone: SP,
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function FxCard({
  revenueUsd,
  cpmUsd,
  periodLabel,
  live,
  className = "",
}: {
  revenueUsd: number;
  cpmUsd: number;
  /** Ex.: "dos últimos 7 dias" */
  periodLabel: string;
  live: boolean;
  className?: string;
}) {
  const q = useUsdBrl(live);
  const fx = q.data;
  const errorMessage = q.error instanceof Error ? q.error.message : null;

  // null = acompanha a receita do período; texto = valor digitado pela pessoa.
  const [custom, setCustom] = useState<string | null>(null);
  const revenueText = revenueUsd.toFixed(2).replace(".", ",");
  const amountText = custom ?? revenueText;
  const amount = parseAmount(amountText);

  const stale = fx ? Date.now() - new Date(fx.quotedAt).getTime() > STALE_AFTER_MS : false;
  const pct = fx?.pctChange ?? null;
  const PctIcon = pct !== null && pct < 0 ? ArrowDownRight : ArrowUpRight;

  return (
    <Card
      className={className}
      title="Conversão para real"
      subtitle="Dólar comercial · US$ → R$"
      action={
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {q.isFetching ? (
            <RefreshCw className="size-3 animate-spin" />
          ) : (
            <span
              className={cn(
                "size-1.5 rounded-full",
                live ? "bg-success" : "bg-muted-foreground/60",
              )}
            />
          )}
          {live ? "ao vivo" : "pausado"}
        </span>
      }
    >
      {!fx && q.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {!fx && q.isError ? (
        <div className="flex flex-col items-start gap-3 text-sm">
          <p className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {errorMessage ?? "Não foi possível obter a cotação."}
          </p>
          <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {fx ? (
        <div className="flex h-full flex-col gap-4">
          {fx.note ? (
            <div className="tone-warning flex items-start gap-2 rounded-lg border p-2.5 text-[11px]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{fx.note}</span>
            </div>
          ) : null}
          {stale ? (
            <div className="tone-warning flex items-start gap-2 rounded-lg border p-2.5 text-[11px]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Sem atualização recente (o mercado pode estar fechado). Última cotação:{" "}
                {fmtQuoteTime(fx.quotedAt)}.
              </span>
            </div>
          ) : null}
          {q.isError ? (
            <div className="tone-warning flex items-start gap-2 rounded-lg border p-2.5 text-[11px]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>Não foi possível atualizar agora; mostrando a última cotação obtida.</span>
            </div>
          ) : null}

          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Receita {periodLabel} em reais
            </p>
            <p className="mt-1 font-display text-4xl font-semibold leading-none tracking-tight tabular-nums">
              {brl(revenueUsd * fx.bid)}
            </p>
            <p className="mt-2 text-xs tabular-nums text-muted-foreground">
              {usdMoney(revenueUsd)} × {brlRate(fx.bid)} · CPM médio ≈ {brl(cpmUsd * fx.bid)}
            </p>
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] text-muted-foreground">Dólar agora (compra)</p>
                <p className="font-display text-xl font-semibold tabular-nums">{brlRate(fx.bid)}</p>
              </div>
              {pct !== null ? (
                <span
                  title="Variação no dia"
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                    pct > 0
                      ? "tone-success"
                      : pct < 0
                        ? "tone-danger"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  <PctIcon className="size-3" />
                  {signedPct(pct)}
                  <span className="ml-1 font-normal opacity-70">hoje</span>
                </span>
              ) : null}
            </div>
            {fx.ask !== null || fx.high !== null || fx.low !== null ? (
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                {(
                  [
                    ["Venda", fx.ask],
                    ["Máxima", fx.high],
                    ["Mínima", fx.low],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium tabular-nums">{v !== null ? brlRate(v) : "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          <div>
            <Label htmlFor="fx-amount" className="text-xs font-medium text-muted-foreground">
              Simular conversão
            </Label>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  US$
                </span>
                <Input
                  id="fx-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  className="pl-11 tabular-nums"
                  value={amountText}
                  onChange={(e) => setCustom(e.target.value)}
                  aria-invalid={amount === null}
                />
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              <div
                className="min-w-[6.5rem] text-right text-base font-semibold tabular-nums"
                aria-live="polite"
              >
                {amount !== null ? brl(amount * fx.bid) : "—"}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {QUICK_AMOUNTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCustom(String(v))}
                  className="rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {`US$ ${v.toLocaleString("pt-BR")}`}
                </button>
              ))}
              {custom !== null ? (
                <button
                  type="button"
                  onClick={() => setCustom(null)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium text-primary hover:underline"
                >
                  Usar receita do período
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-auto space-y-1 border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
            {fx.ptax ? (
              <p className="tabular-nums">
                PTAX (Banco Central): venda {brlRate(fx.ptax.sell)} · fechamento de{" "}
                {fx.ptax.date.slice(8, 10)}/{fx.ptax.date.slice(5, 7)}
              </p>
            ) : null}
            <p>
              Cotação de {fmtQuoteTime(fx.quotedAt)} ·{" "}
              {fx.source === "awesomeapi" ? "AwesomeAPI" : "Banco Central (PTAX)"}. Valor de
              referência: o que você recebe depende do câmbio e das tarifas do seu banco ou meio de
              pagamento.
            </p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
