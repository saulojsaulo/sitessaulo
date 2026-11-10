import { createServerFn } from "@tanstack/react-start";
import type { AdsterraRange } from "./adsterra-types";

const RANGES: AdsterraRange[] = ["today", "yesterday", "7d", "14d", "30d", "month"];

export const getAdsterraDashboard = createServerFn({ method: "POST" })
  .inputValidator((input: { range?: string; domain?: string }) => {
    const range = RANGES.includes(input?.range as AdsterraRange)
      ? (input.range as AdsterraRange)
      : "7d";
    // domain é um ID numérico da Adsterra; qualquer outra coisa é descartada.
    const domain = /^\d{1,12}$/.test(String(input?.domain ?? ""))
      ? String(input.domain)
      : undefined;
    return { range, domain };
  })
  .handler(async ({ data }) => {
    const { loadAdsterraDashboard } = await import("./adsterra.server");
    return loadAdsterraDashboard(data.range, data.domain);
  });
