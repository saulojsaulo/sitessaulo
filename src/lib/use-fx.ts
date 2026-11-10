import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUsdBrl } from "./fx.functions";

/** A AwesomeAPI cacheia 1 min sem chave; consultar a cada 60 s acompanha o mercado. */
export const FX_REFRESH_MS = 60_000;

export function useUsdBrl(live: boolean) {
  const fetchRate = useServerFn(getUsdBrl);
  return useQuery({
    queryKey: ["fx", "usd-brl"],
    queryFn: () => fetchRate(),
    refetchInterval: live ? FX_REFRESH_MS : false,
    refetchOnWindowFocus: live,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: 2,
  });
}
