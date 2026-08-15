import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const rangeSchema = z.object({
  propertyId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

export interface Ga4Kpis {
  sessions: number;
  activeUsers: number;
  screenPageViews: number;
  engagementRate: number;
  averageSessionDuration: number;
}

export interface Ga4PropertyReport {
  kpis: Ga4Kpis;
  timeseries: { date: string; sessions: number; users: number }[];
  pages: { pagePath: string; views: number; avgDuration: number }[];
  channels: { name: string; sessions: number }[];
  devices: { name: string; sessions: number }[];
  countries: { name: string; sessions: number }[];
}

export interface Ga4BlogSummary {
  propertyId: string;
  ok: boolean;
  error?: string;
  kpis: Ga4Kpis;
}

export const getPropertyReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => rangeSchema.parse(input))
  .handler(async ({ data }): Promise<Ga4PropertyReport> => {
    const { batchRunReports, dim, met } = await import("./ga4.server");
    const dateRanges = [{ startDate: data.startDate, endDate: data.endDate }];
    const kpiMetrics = [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "screenPageViews" },
      { name: "engagementRate" },
      { name: "averageSessionDuration" },
    ];

    const reports = await batchRunReports(data.propertyId, [
      { dateRanges, metrics: kpiMetrics },
      {
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
        limit: 400,
      },
      {
        dateRanges,
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }, { name: "averageSessionDuration" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 20,
      },
      {
        dateRanges,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      },
      {
        dateRanges,
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      },
      {
        dateRanges,
        dimensions: [{ name: "country" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      },
    ]);

    const kpiRow = reports[0]?.rows?.[0];
    const kpis: Ga4Kpis = {
      sessions: kpiRow ? met(kpiRow, 0) : 0,
      activeUsers: kpiRow ? met(kpiRow, 1) : 0,
      screenPageViews: kpiRow ? met(kpiRow, 2) : 0,
      engagementRate: kpiRow ? met(kpiRow, 3) : 0,
      averageSessionDuration: kpiRow ? met(kpiRow, 4) : 0,
    };

    return {
      kpis,
      timeseries: (reports[1]?.rows ?? []).map((r) => ({
        date: dim(r),
        sessions: met(r, 0),
        users: met(r, 1),
      })),
      pages: (reports[2]?.rows ?? []).map((r) => ({
        pagePath: dim(r),
        views: met(r, 0),
        avgDuration: met(r, 1),
      })),
      channels: (reports[3]?.rows ?? []).map((r) => ({ name: dim(r), sessions: met(r, 0) })),
      devices: (reports[4]?.rows ?? []).map((r) => ({ name: dim(r), sessions: met(r, 0) })),
      countries: (reports[5]?.rows ?? []).map((r) => ({ name: dim(r), sessions: met(r, 0) })),
    };
  });

export const getPropertiesSummary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        propertyIds: z.array(z.string().min(1)).max(50),
        startDate: z.string().min(1),
        endDate: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<Ga4BlogSummary[]> => {
    const { batchRunReports, met } = await import("./ga4.server");
    const dateRanges = [{ startDate: data.startDate, endDate: data.endDate }];
    const metrics = [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "screenPageViews" },
      { name: "engagementRate" },
      { name: "averageSessionDuration" },
    ];

    const results = await Promise.all(
      data.propertyIds.map(async (propertyId): Promise<Ga4BlogSummary> => {
        const zero: Ga4Kpis = {
          sessions: 0,
          activeUsers: 0,
          screenPageViews: 0,
          engagementRate: 0,
          averageSessionDuration: 0,
        };
        try {
          const reports = await batchRunReports(propertyId, [{ dateRanges, metrics }]);
          const row = reports[0]?.rows?.[0];
          return {
            propertyId,
            ok: true,
            kpis: row
              ? {
                  sessions: met(row, 0),
                  activeUsers: met(row, 1),
                  screenPageViews: met(row, 2),
                  engagementRate: met(row, 3),
                  averageSessionDuration: met(row, 4),
                }
              : zero,
          };
        } catch (error) {
          return {
            propertyId,
            ok: false,
            error: error instanceof Error ? error.message : "Erro desconhecido",
            kpis: zero,
          };
        }
      }),
    );

    return results;
  });