import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { SchedulerRunRow } from "./scheduler";

export const runsKey = (date: string) => ["scheduler_runs", date];

export function useSchedulerRuns(date: string) {
  return useQuery({
    queryKey: runsKey(date),
    queryFn: async (): Promise<SchedulerRunRow[]> => {
      const { data, error } = await supabase
        .from("scheduler_runs")
        .select("*")
        .eq("run_date", date)
        .order("position");
      if (error) throw new Error(error.message);
      return (data ?? []) as SchedulerRunRow[];
    },
    refetchInterval: 60_000,
  });
}

export function useSchedulerActions(date: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: runsKey(date) });
  };
  const reset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scheduler_runs")
        .update({ state: "pendente", error: null, started_at: null, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });
  return { reset, invalidate };
}
