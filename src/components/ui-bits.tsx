import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type PostStatus } from "@/lib/types";

const statusStyles: Record<PostStatus, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  estrutura: "tone-primary",
  sessoes_completas: "tone-primary",
  aguardando_revisao: "tone-warning",
  artigo_completo: "tone-cyan",
  agendado: "tone-warning",
  publicado: "tone-success",
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

const tagPalette = ["tone-primary", "tone-cyan", "tone-success", "tone-warning", "tone-pink"];

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
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
      <div className="mb-1 grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-1">{action}</div> : null}
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
