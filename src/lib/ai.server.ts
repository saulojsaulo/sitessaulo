/** Geração de texto via ChatGPT (OpenAI). Única IA usada no sistema.
 *  Streaming SSE acumulado no servidor. */
import { estimateTokens, logAiUsage } from "./ai-usage.server";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
export const AI_MODEL = "gpt-4.1";

export interface AiMeta {
  kind?: string;
  postId?: string | null;
  postTitle?: string | null;
  /** Nome da secret usada na chamada (aparece em mensagens de erro). */
  keyLabel?: string;
}

async function generateWithOpenAI(
  apiKey: string,
  model: string,
  prompt: string,
  system: string | undefined,
  meta: AiMeta,
): Promise<string> {
  const started = Date.now();
  const base = {
    kind: meta.kind ?? "outro",
    post_id: meta.postId ?? null,
    post_title: meta.postTitle ?? null,
    model: `openai/${model}`,
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
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
      }),
    });
  } catch (e) {
    return fail(`Falha de rede ao chamar o ChatGPT: ${e instanceof Error ? e.message : "erro"}`);
  }

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    if (res.status === 401) return fail("Chave OPENAI_API_KEY inválida ou revogada.");
    if (res.status === 402 || res.status === 403)
      return fail(`ChatGPT recusou a requisição: ${body.slice(0, 200)}`);
    if (res.status === 429)
      return fail("Limite de requisições/créditos da sua conta OpenAI atingido.");
    if (res.status === 400 && body.includes("context_length"))
      return fail("ChatGPT: prompt muito grande para este modelo (limite de contexto).");
    if (res.status === 404) return fail(`Modelo inválido: ${model}. Ajuste a secret OPENAI_MODEL.`);
    return fail(`ChatGPT [${res.status}]: ${body.slice(0, 300)}`);
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
      if (t.startsWith(":")) continue;
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "" || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
          error?: { message?: string } | null;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          } | null;
        };
        if (json.error) return fail(`ChatGPT: ${json.error.message ?? "erro desconhecido"}`);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) text += delta;
        if (json.usage) usage = json.usage;
      } catch {
        // fragmento incompleto
      }
    }
  }

  const out = text.trim();
  if (!out) return fail("O ChatGPT encerrou a resposta sem conteúdo. Tente novamente.");
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

/** Ponto único de geração usado por todo o sistema (nome mantido por compatibilidade). */
export async function generateWithGemini(
  prompt: string,
  system?: string,
  meta: AiMeta = {},
): Promise<string> {
  const key = process.env["OPENAI_API_KEY"]?.trim();
  if (!key) throw new Error("OPENAI_API_KEY não configurada");
  const model = process.env["OPENAI_MODEL"]?.trim() || AI_MODEL;
  return generateWithOpenAI(key, model, prompt, system, { ...meta, keyLabel: "OPENAI_API_KEY" });
}
