import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type PostStatus } from "@/lib/types";

const statusStyles: Record<PostStatus, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  estrutura: "bg-primary/12 text-primary border-primary/25",
  artigo_completo: "bg-cyan/15 text-cyan border-cyan/30",
  agendado: "bg-warning/15 text-warning border-warning/30",
  publicado: "bg-success/15 text-success border-success/30",
};

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

const tagPalette = [
  "bg-primary/12 text-primary border-primary/25",
  "bg-cyan/15 text-cyan border-cyan/30",
  "bg-success/15 text-success border-success/30",
  "bg-warning/15 text-warning border-warning/30",
  "bg-chart-5/15 text-chart-5 border-chart-5/30",
];

export function TagChip({
  label,
  onRemove,
  className,
}: {
  label: string;
  onRemove?: () => void;
  className?: string;
}) {
  let hash = 0;
  for (const ch of label) hash = (hash + ch.charCodeAt(0)) % 997;
  const tone = tagPalette[hash % tagPalette.length];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        tone,
        className,
      )}
    >
      #{label}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover tag ${label}`}
          className="opacity-60 transition-opacity hover:opacity-100"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="relative mb-1 grid size-16 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <span className="absolute inset-0 -z-10 animate-pulse rounded-2xl bg-primary/20 blur-xl" />
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}