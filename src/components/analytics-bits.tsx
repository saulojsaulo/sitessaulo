import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Delta, Sparkline } from "@/components/metric-bits";

export const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "var(--shadow-soft)",
};

export function ErrorBox({
  message,
  onRetry,
  title = "Não foi possível carregar os dados desta propriedade.",
}: {
  message: string;
  onRetry: () => void;
  title?: string;
}) {
  return (
    <div className="surface flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xl text-xs text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="size-4" /> Tentar novamente
      </Button>
    </div>
  );
}

export function Kpi({
  icon,
  label,
  value,
  current,
  previous,
  hint,
  series,
  invert,
  points,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  current?: number;
  previous?: number;
  hint?: string;
  /** Série diária para o mini-gráfico (opcional). */
  series?: number[];
  /** Quando MENOR é melhor (ex.: rejeição). */
  invert?: boolean;
  /** Para taxas: variação em pontos percentuais. */
  points?: boolean;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <p className="font-display text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums">
          {value}
        </p>
        {series && series.length > 1 ? (
          <Sparkline values={series} width={84} height={30} stroke="var(--primary)" />
        ) : null}
      </div>
      {current !== undefined && previous !== undefined ? (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Delta
            current={current}
            previous={previous}
            {...(invert ? { invert } : {})}
            {...(points ? { points } : {})}
          />
          <span>vs. período anterior</span>
        </div>
      ) : null}
      {hint ? <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  children,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
