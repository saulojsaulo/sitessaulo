import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { fmtInt, fmtCompact } from "@/lib/use-ga4";
import { pctDelta } from "@/lib/ga4-types";

/**
 * Variação entre período atual e anterior.
 * - `invert`: quando MENOR é melhor (ex.: taxa de rejeição) — queda fica verde.
 * - `points`: para taxas (0–1), mostra a diferença em pontos percentuais em vez de %.
 * - Variações absurdas (período anterior quase vazio) são limitadas a ">999%".
 */
export function Delta({
  current,
  previous,
  invert = false,
  points = false,
  className = "",
}: {
  current: number;
  previous: number;
  invert?: boolean;
  points?: boolean;
  className?: string;
}) {
  let text: string;
  let diff: number;

  if (points) {
    diff = (current - previous) * 100;
    text = `${diff > 0 ? "+" : ""}${diff.toFixed(1)} pp`;
  } else if (previous <= 0) {
    diff = current > 0 ? 1 : 0;
    text = current > 0 ? "novo" : "—";
  } else {
    const d = pctDelta(current, previous);
    diff = d;
    const pct = d * 100;
    text = pct > 999 ? ">+999%" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  }

  const flat = Math.abs(diff) < (points ? 0.05 : 0.001);
  const up = !flat && diff > 0;
  const good = invert ? !up : up;
  const Icon = flat ? ArrowRight : up ? ArrowUpRight : ArrowDownRight;
  const tone = flat
    ? "bg-muted text-muted-foreground"
    : good
      ? "tone-success border-transparent"
      : "tone-danger border-transparent";

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${tone} ${className}`}
      title={`Período anterior: ${points ? fmtPctRaw(previous) : fmtInt(previous)}`}
    >
      <Icon className="size-3" />
      {text}
    </span>
  );
}

const fmtPctRaw = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Pontinho pulsante com usuários ativos agora. */
export function LiveDot({ users, label = true }: { users: number; label?: boolean }) {
  const on = users > 0;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium tabular-nums"
      title={`${fmtInt(users)} usuário(s) ativo(s) agora`}
    >
      <span className="relative grid size-2 place-items-center">
        <span
          className={`absolute size-2 rounded-full ${on ? "animate-ping bg-chart-2" : "bg-muted-foreground/40"}`}
        />
        <span className={`size-1.5 rounded-full ${on ? "bg-chart-2" : "bg-muted-foreground/60"}`} />
      </span>
      {label ? (
        <span className={on ? "text-chart-2" : "text-muted-foreground"}>{fmtInt(users)}</span>
      ) : null}
    </span>
  );
}

/** Sparkline SVG minimalista (sem dependências). */
export function Sparkline({
  values,
  width = 96,
  height = 26,
  stroke = "var(--chart-1)",
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (values.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map(
    (v, i) =>
      `${(i * step).toFixed(1)},${(height - ((v - min) / span) * (height - 3) - 1.5).toFixed(1)}`,
  );
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className="overflow-visible"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Selo compacto de visualizações. */
export function ViewsBadge({ views, title }: { views: number; title?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-chart-1/12 px-2 py-0.5 text-[11px] font-medium text-chart-1 tabular-nums"
      title={title ?? `${fmtInt(views)} visualizações no GA4 (últimos 28 dias)`}
    >
      {fmtCompact(views)}
    </span>
  );
}
