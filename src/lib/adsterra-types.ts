/** Tipos compartilhados entre servidor e cliente (sem imports de servidor). */

export type AdsterraRange = "today" | "yesterday" | "7d" | "14d" | "30d" | "month";

export const ADSTERRA_RANGES: { id: AdsterraRange; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "7d", label: "7 dias" },
  { id: "14d", label: "14 dias" },
  { id: "30d", label: "30 dias" },
  { id: "month", label: "Este mês" },
];

export interface AdsterraMetrics {
  impressions: number;
  clicks: number;
  revenue: number;
  /** Fração (0–1): cliques ÷ impressões. */
  ctr: number;
  /** Receita por mil impressões, em USD. */
  cpm: number;
}

export interface AdsterraDailyPoint extends AdsterraMetrics {
  /** AAAA-MM-DD */
  date: string;
}

export interface AdsterraPlacementRow extends AdsterraMetrics {
  id: string;
  name: string;
  domain: string;
}

export interface AdsterraCountryRow extends AdsterraMetrics {
  /** Código do país (ex.: BR) ou o texto devolvido pela Adsterra. */
  code: string;
}

export interface AdsterraDomain {
  id: string;
  title: string;
}

export interface AdsterraDashboard {
  fetchedAt: string;
  range: {
    id: AdsterraRange;
    start: string;
    finish: string;
    prevStart: string;
    prevFinish: string;
    days: number;
  };
  totals: AdsterraMetrics;
  prevTotals: AdsterraMetrics;
  daily: AdsterraDailyPoint[];
  placements: AdsterraPlacementRow[];
  countries: AdsterraCountryRow[];
  domains: AdsterraDomain[];
  /** Avisos de partes que falharam sem derrubar o painel. */
  warnings: string[];
  /** Primeiro item bruto de cada resposta, para diagnóstico de formato. */
  diagnostic: {
    daily: Record<string, string> | null;
    placements: Record<string, string> | null;
    countries: Record<string, string> | null;
  };
}
