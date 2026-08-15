/** Monta os relatórios GA4 (server-only) usados pelas server functions. */
import { runReports, runRealtimeReport, dim, met } from "./ga4.server";
import {
  ZERO_KPIS,
  type Ga4BlogSummary,
  type Ga4Gainer,
  type Ga4Kpis,
  type Ga4PropertyReport,
  type Ga4Realtime,
} from "./ga4-types";

const KPI_METRICS = [
  { name: "sessions" },
  { name: "activeUsers" },
  { name: "newUsers" },
  { name: "screenPageViews" },
  { name: "engagementRate" },
  { name: "averageSessionDuration" },
  { name: "bounceRate" },
  { name: "eventCount" },
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function kpisFromRow(row: { metricValues?: { value: string }[] } | undefined): Ga4Kpis {
  if (!row) return { ...ZERO_KPIS };
  return {
    sessions: met(row, 0),
    activeUsers: met(row, 1),
    newUsers: met(row, 2),
    screenPageViews: met(row, 3),
    engagementRate: met(row, 4),
    averageSessionDuration: met(row, 5),
    bounceRate: met(row, 6),
    eventCount: met(row, 7),
  };
}

/** Período imediatamente anterior, de mesma duração. */
export function previousRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: iso(prevStart), endDate: iso(prevEnd) };
}

export async function propertyReport(
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<Ga4PropertyReport> {
  const prev = previousRange(startDate, endDate);
  const dateRanges = [{ startDate, endDate }];
  const prevRanges = [prev];
  const top = (metric: string) => [{ metric: { metricName: metric }, desc: true }];

  const reports = await runReports(propertyId, [
    { dateRanges, metrics: KPI_METRICS },
    { dateRanges: prevRanges, metrics: KPI_METRICS },
    {
      dateRanges,
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 400,
    },
    {
      dateRanges,
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [
        { name: "screenPageViews" },
        { name: "activeUsers" },
        { name: "averageSessionDuration" },
        { name: "engagementRate" },
      ],
      orderBys: top("screenPageViews"),
      limit: 50,
    },
    {
      dateRanges: prevRanges,
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: top("screenPageViews"),
      limit: 200,
    },
    {
      dateRanges,
      dimensions: [{ name: "landingPage" }],
      metrics: [{ name: "sessions" }, { name: "engagementRate" }],
      orderBys: top("sessions"),
      limit: 15,
    },
    {
      dateRanges,
      dimensions: [{ name: "sessionSourceMedium" }],
      metrics: [{ name: "sessions" }],
      orderBys: top("sessions"),
      limit: 15,
    },
    {
      dateRanges,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: top("sessions"),
      limit: 10,
    },
    {
      dateRanges,
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }],
      orderBys: top("sessions"),
      limit: 10,
    },
    {
      dateRanges,
      dimensions: [{ name: "country" }],
      metrics: [{ name: "sessions" }],
      orderBys: top("sessions"),
      limit: 12,
    },
    {
      dateRanges,
      dimensions: [{ name: "city" }],
      metrics: [{ name: "sessions" }],
      orderBys: top("sessions"),
      limit: 12,
    },
    {
      dateRanges,
      dimensions: [{ name: "hour" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ dimension: { dimensionName: "hour" } }],
      limit: 24,
    },
    {
      dateRanges,
      dimensions: [{ name: "dayOfWeek" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ dimension: { dimensionName: "dayOfWeek" } }],
      limit: 7,
    },
    {
      dateRanges,
      dimensions: [{ name: "newVsReturning" }],
      metrics: [{ name: "sessions" }],
      orderBys: top("sessions"),
      limit: 5,
    },
  ]);

  const named = (i: number) =>
    (reports[i]?.rows ?? []).map((r) => ({ name: dim(r) || "(não definido)", sessions: met(r, 0) }));

  const pages = (reports[3]?.rows ?? []).map((r) => ({
    pagePath: dim(r),
    title: dim(r, 1),
    views: met(r, 0),
    users: met(r, 1),
    avgDuration: met(r, 2),
    engagementRate: met(r, 3),
  }));

  const prevPages = new Map<string, number>();
  for (const r of reports[4]?.rows ?? []) prevPages.set(dim(r), met(r, 0));

  const movers: Ga4Gainer[] = pages.map((p) => {
    const prevViews = prevPages.get(p.pagePath) ?? 0;
    return {
      pagePath: p.pagePath,
      title: p.title,
      views: p.views,
      prevViews,
      delta: p.views - prevViews,
    };
  });

  return {
    kpis: kpisFromRow(reports[0]?.rows?.[0]),
    prevKpis: kpisFromRow(reports[1]?.rows?.[0]),
    timeseries: (reports[2]?.rows ?? []).map((r) => ({
      date: dim(r),
      sessions: met(r, 0),
      users: met(r, 1),
      views: met(r, 2),
    })),
    pages,
    landingPages: (reports[5]?.rows ?? []).map((r) => ({
      pagePath: dim(r),
      sessions: met(r, 0),
      engagementRate: met(r, 1),
    })),
    sources: named(6),
    channels: named(7),
    devices: named(8),
    countries: named(9),
    cities: named(10),
    hours: (reports[11]?.rows ?? []).map((r) => ({ hour: dim(r), sessions: met(r, 0) })),
    weekdays: (reports[12]?.rows ?? []).map((r) => ({
      day: WEEKDAYS[Number(dim(r))] ?? dim(r),
      sessions: met(r, 0),
    })),
    newVsReturning: named(13),
    gainers: [...movers].sort((a, b) => b.delta - a.delta).slice(0, 10),
    decliners: [...movers].sort((a, b) => a.delta - b.delta).slice(0, 10),
  };
}

export async function realtime(propertyId: string): Promise<Ga4Realtime> {
  const [total, pages, countries, devices, minutes] = await Promise.all([
    runRealtimeReport(propertyId, { metrics: [{ name: "activeUsers" }] }),
    runRealtimeReport(propertyId, {
      dimensions: [{ name: "unifiedScreenName" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 15,
    }),
    runRealtimeReport(propertyId, {
      dimensions: [{ name: "country" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 10,
    }),
    runRealtimeReport(propertyId, {
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 5,
    }),
    runRealtimeReport(propertyId, {
      dimensions: [{ name: "minutesAgo" }],
      metrics: [{ name: "activeUsers" }],
      limit: 30,
    }),
  ]);

  const minuteMap = new Map<number, number>();
  for (const r of minutes.rows ?? []) minuteMap.set(Number(dim(r)), met(r, 0));

  return {
    activeUsers: met(total.rows?.[0] ?? {}, 0),
    pages: (pages.rows ?? []).map((r) => ({ pagePath: dim(r), activeUsers: met(r, 0) })),
    countries: (countries.rows ?? []).map((r) => ({
      name: dim(r) || "(não definido)",
      activeUsers: met(r, 0),
    })),
    devices: (devices.rows ?? []).map((r) => ({
      name: dim(r) || "(não definido)",
      activeUsers: met(r, 0),
    })),
    minutes: Array.from({ length: 30 }, (_, i) => ({
      minutesAgo: 29 - i,
      activeUsers: minuteMap.get(29 - i) ?? 0,
    })),
  };
}

export async function propertySummary(
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<Ga4BlogSummary> {
  const prev = previousRange(startDate, endDate);
  const zero = { ...ZERO_KPIS };
  try {
    const reports = await runReports(propertyId, [
      { dateRanges: [{ startDate, endDate }], metrics: KPI_METRICS },
      { dateRanges: [prev], metrics: KPI_METRICS },
      {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
        limit: 400,
      },
      {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 100,
      },
    ]);
    let activeNow = 0;
    try {
      const rt = await runRealtimeReport(propertyId, { metrics: [{ name: "activeUsers" }] });
      activeNow = met(rt.rows?.[0] ?? {}, 0);
    } catch {
      activeNow = 0;
    }
    return {
      propertyId,
      ok: true,
      kpis: kpisFromRow(reports[0]?.rows?.[0]),
      prevKpis: kpisFromRow(reports[1]?.rows?.[0]),
      activeNow,
      timeseries: (reports[2]?.rows ?? []).map((r) => ({ date: dim(r), sessions: met(r, 0) })),
      topPages: (reports[3]?.rows ?? []).map((r) => ({
        pagePath: dim(r),
        title: dim(r, 1),
        views: met(r, 0),
      })),
    };
  } catch (error) {
    return {
      propertyId,
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
      kpis: zero,
      prevKpis: { ...zero },
      activeNow: 0,
      timeseries: [],
      topPages: [],
    };
  }
}