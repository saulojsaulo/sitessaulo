import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdsterraDashboard } from "./adsterra.functions";
import type { AdsterraRange } from "./adsterra-types";

/** A Adsterra mantém cada resposta em cache por 60 s: atualizar mais rápido não traz dado novo. */
export const ADSTERRA_REFRESH_MS = 60_000;

export const isAdsterraSetupError = (message: string) => message.startsWith("ADSTERRA_API_KEY");

export function useAdsterra(range: AdsterraRange, domain: string | undefined, live: boolean) {
  const fetchDashboard = useServerFn(getAdsterraDashboard);
  return useQuery({
    queryKey: ["adsterra", range, domain ?? "all"],
    queryFn: () => fetchDashboard({ data: { range, ...(domain ? { domain } : {}) } }),
    refetchInterval: live ? ADSTERRA_REFRESH_MS : false,
    refetchOnWindowFocus: live,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    // Erros de token/configuração não melhoram com nova tentativa.
    retry: (count, err) => {
      const m = err instanceof Error ? err.message : "";
      return count < 2 && !isAdsterraSetupError(m) && !/\((401|403)\)/.test(m);
    },
  });
}
