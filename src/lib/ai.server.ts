/** Chamada ao Lovable AI Gateway (Gemini) com streaming acumulado no servidor. */
import { estimateTokens, logAiUsage } from "./ai-usage.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const AI_MODEL = "google/gemini-3.7-flash";

export interface AiMeta {
  kind?: string;
  postId?: string | null;
  postTitle?: string | null;
}

export async function generateWithGemini(
  prompt: string,
  system?: string,
  meta: AiMeta = {},
): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY não configurada");

  const started = Date.now();
  const base = {
    kind: meta.kind ?? "outro",
    post_id: meta.postId ?? null,
    post_title: meta.postTitle ?? null,
    model: AI_MODEL,
  };

  const fail = async (message: string): Promise<never> => {
    await logAiUsage({
      ...base,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      estimated: true,
      duration_ms: Date.now() - started,
      ok: false,
      error: message.slice(0, 500),
    });
    throw new Error(message);
  };

  let res: Response;
  try {
    res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
      }),
    });
  } catch (e) {
    return fail(`Falha de rede ao chamar a IA: ${e instanceof Error ? e.message : "erro"}`);
  }

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) return fail("Limite de requisições atingido. Tente em instantes.");
    if (res.status === 402) return fail("Créditos de IA esgotados no workspace.");
    return fail(`IA [${res.status}]: ${body.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null =
    null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "" || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          } | null;
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) text += delta;
        if (json.usage) usage = json.usage;
      } catch {
        // fragmento incompleto: ignorado
      }
    }
  }

  const out = text.trim();
  const promptTokens = usage?.prompt_tokens ?? estimateTokens((system ?? "") + prompt);
  const completionTokens = usage?.completion_tokens ?? estimateTokens(out);

  await logAiUsage({
    ...base,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: usage?.total_tokens ?? promptTokens + completionTokens,
    estimated: usage == null,
    duration_ms: Date.now() - started,
    ok: true,
    error: null,
  });

  return out;
}
