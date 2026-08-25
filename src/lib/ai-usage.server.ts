import { supabase } from "./supabase";

export interface AiUsageRecord {
  kind: string;
  post_id: string | null;
  post_title: string | null;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated: boolean;
  duration_ms: number;
  ok: boolean;
  error: string | null;
}

/** Registro best-effort: nunca deixa a geração falhar por causa do log. */
export async function logAiUsage(rec: AiUsageRecord): Promise<void> {
  try {
    const { error } = await supabase.from("ai_usage").insert(rec);
    if (error) console.warn("[ai_usage] falha ao registrar:", error.message);
  } catch (e) {
    console.warn("[ai_usage] falha ao registrar:", e instanceof Error ? e.message : e);
  }
}

/** Aproximação usada quando o provedor não devolve o bloco `usage`. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}
