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
  /** Colunas opcionais (podem não existir ainda no banco). */
  cached_tokens?: number;
  reasoning_tokens?: number;
}

/** Registro best-effort: nunca deixa a geração falhar por causa do log. */
export async function logAiUsage(rec: AiUsageRecord): Promise<void> {
  try {
    const { error } = await supabase.from("ai_usage").insert(rec);
    if (!error) return;
    // Banco sem as colunas novas: grava o essencial.
    const { cached_tokens: _c, reasoning_tokens: _r, ...basic } = rec;
    const retry = await supabase.from("ai_usage").insert(basic);
    if (retry.error) console.warn("[ai_usage] falha ao registrar:", retry.error.message);
  } catch (e) {
    console.warn("[ai_usage] falha ao registrar:", e instanceof Error ? e.message : e);
  }
}

/** Aproximação usada quando o provedor não devolve o bloco `usage`. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}
