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

export const issuesKey = ["scheduler_issues"];

/** Registros dos últimos 14 dias usados no log de erros da fila. */
export function useSchedulerIssues() {
  return useQuery({
    queryKey: issuesKey,
    queryFn: async (): Promise<SchedulerRunRow[]> => {
      const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("scheduler_runs")
        .select("*")
        .gte("run_date", since)
        .neq("state", "concluido")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as SchedulerRunRow[];
    },
    refetchInterval: 60_000,
  });
}

/** Reinicia um registro travado/falhado, voltando para "pendente". */
export function useResetRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scheduler_runs")
        .update({ state: "pendente", error: null, started_at: null, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: issuesKey });
      void qc.invalidateQueries({ queryKey: ["scheduler_runs"] });
    },
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
