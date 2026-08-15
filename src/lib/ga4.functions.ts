import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Ga4BlogSummary, Ga4PropertyReport, Ga4Realtime } from "./ga4-types";

export const getPropertyReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        propertyId: z.string().min(1),
        startDate: z.string().min(1),
        endDate: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<Ga4PropertyReport> => {
    const { propertyReport } = await import("./ga4-reports.server");
    return propertyReport(data.propertyId, data.startDate, data.endDate);
  });

export const getRealtime = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ propertyId: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<Ga4Realtime> => {
    const { realtime } = await import("./ga4-reports.server");
    return realtime(data.propertyId);
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
    const { propertySummary } = await import("./ga4-reports.server");
    return Promise.all(
      data.propertyIds.map((id) => propertySummary(id, data.startDate, data.endDate)),
    );
  });