import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase, type BlogPropertyRow } from "./supabase";
import {
  getPropertiesSummary,
  getPropertyReport,
  getRealtime,
} from "./ga4.functions";
import type { Ga4BlogSummary, Ga4PropertyReport, Ga4Realtime } from "./ga4-types";

export const FIVE_MIN = 5 * 60 * 1000;

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};

export const normalizeDomain = (url: string) =>
  url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

export function useBlogProperties() {
  return useQuery({
    queryKey: ["blog_properties"],
    staleTime: FIVE_MIN,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_properties")
        .select("*")
        .order("blog_name");
      if (error) throw new Error(error.message);
      return (data ?? []) as BlogPropertyRow[];
    },
  });
}

/** Property ID configurado para o domínio/nome de um blog do PostFlow. */
export function propertyIdFor(
  properties: BlogPropertyRow[] | undefined,
  blog: { name?: string; url?: string } | null | undefined,
) {
  if (!properties || !blog) return "";
  const domain = normalizeDomain(blog.url ?? "");
  const name = (blog.name ?? "").trim().toLowerCase();
  const found = properties.find((p) => {
    const key = normalizeDomain(p.blog_name);
    return (domain && key === domain) || (name && p.blog_name.trim().toLowerCase() === name);
  });
  return found?.ga4_property_id.trim() ?? "";
}

export function useGa4Summaries(propertyIds: string[], startDate: string, endDate: string) {
  const fetchSummary = useServerFn(getPropertiesSummary);
  const ids = [...new Set(propertyIds.filter(Boolean))].sort();
  return useQuery<Ga4BlogSummary[]>({
    queryKey: ["ga4", "summary", ids.join(","), startDate, endDate],
    enabled: ids.length > 0,
    staleTime: FIVE_MIN,
    gcTime: FIVE_MIN * 2,
    retry: false,
    queryFn: () => fetchSummary({ data: { propertyIds: ids, startDate, endDate } }),
  });
}

export function useGa4Report(propertyId: string, startDate: string, endDate: string) {
  const fetchReport = useServerFn(getPropertyReport);
  return useQuery<Ga4PropertyReport>({
    queryKey: ["ga4", "property", propertyId, startDate, endDate],
    enabled: propertyId !== "",
    staleTime: FIVE_MIN,
    gcTime: FIVE_MIN * 2,
    retry: false,
    queryFn: () => fetchReport({ data: { propertyId, startDate, endDate } }),
  });
}

export function useGa4Realtime(propertyId: string) {
  const fetchRealtime = useServerFn(getRealtime);
  return useQuery<Ga4Realtime>({
    queryKey: ["ga4", "realtime", propertyId],
    enabled: propertyId !== "",
    staleTime: 45 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
    queryFn: () => fetchRealtime({ data: { propertyId } }),
  });
}

/* ---------- casamento entre postagens e páginas do GA4 ---------- */

export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const STOP = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "em", "para", "com", "no", "na", "um", "uma"]);

const tokens = (s: string) => slugify(s).split("-").filter((t) => t.length > 2 && !STOP.has(t));

export interface PageStat {
  pagePath: string;
  title: string;
  views: number;
}

/** Encontra a página do GA4 mais provável para um título de postagem. */
export function matchPage(pages: PageStat[], postTitle: string): PageStat | null {
  const want = tokens(postTitle);
  if (want.length === 0) return null;
  const wantSlug = want.join("-");
  let best: { page: PageStat; score: number } | null = null;
  for (const page of pages) {
    const haystack = `${slugify(page.pagePath)}-${slugify(page.title)}`;
    let score = 0;
    if (haystack.includes(wantSlug)) score = 1;
    else {
      const hits = want.filter((t) => haystack.includes(t)).length;
      score = hits / want.length;
    }
    if (score >= 0.6 && (!best || score > best.score || (score === best.score && page.views > best.page.views))) {
      best = { page, score };
    }
  }
  return best?.page ?? null;
}

/** Índice memoizado título -> métricas da página. */
export function usePageMatcher(pages: PageStat[] | undefined) {
  return useMemo(() => {
    const list = pages ?? [];
    const cache = new Map<string, PageStat | null>();
    return (title: string) => {
      if (list.length === 0) return null;
      if (!cache.has(title)) cache.set(title, matchPage(list, title));
      return cache.get(title) ?? null;
    };
  }, [pages]);
}

/* ---------- formatação ---------- */

export const fmtInt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n));
export const fmtCompact = (n: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
export const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
export const fmtDur = (s: number) => {
  const total = Math.round(s);
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, "0")}s`;
};
export const fmtDay = (yyyymmdd: string) =>
  yyyymmdd.length === 8 ? `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}` : yyyymmdd;