/** Chamada ao Gemini: usa a chave própria do usuário (GEMINI_API_KEY) quando existir,
 *  caso contrário cai no Lovable AI Gateway. Streaming acumulado no servidor. */
import { estimateTokens, logAiUsage } from "./ai-usage.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const AI_MODEL = "google/gemini-3.7-flash";

export interface AiMeta {
  kind?: string;
  postId?: string | null;
  postTitle?: string | null;
}

/** Chamada direta à API do Google (chave própria do usuário). */
async function generateWithGoogleDirect(
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
    model: `google-direct/${model}`,
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:streamGenerateContent?alt=sse`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      }),
    });
  } catch (e) {
    return fail(`Falha de rede ao chamar o Gemini: ${e instanceof Error ? e.message : "erro"}`);
  }

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) return fail("Limite de requisições da sua conta Gemini atingido.");
    if (res.status === 400 && body.includes("API key"))
      return fail("Chave GEMINI_API_KEY inválida.");
    if (res.status === 403) return fail(`Acesso negado pelo Google: ${body.slice(0, 200)}`);
    return fail(`Gemini [${res.status}]: ${body.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let usage: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | null =
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
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          };
        };
        for (const part of json.candidates?.[0]?.content?.parts ?? []) {
          if (part.text) text += part.text;
        }
        if (json.usageMetadata) usage = json.usageMetadata;
      } catch {
        // fragmento incompleto
      }
    }
  }

  const out = text.trim();
  const promptTokens = usage?.promptTokenCount ?? estimateTokens((system ?? "") + prompt);
  const completionTokens = usage?.candidatesTokenCount ?? estimateTokens(out);

  await logAiUsage({
    ...base,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: usage?.totalTokenCount ?? promptTokens + completionTokens,
    estimated: usage == null,
    duration_ms: Date.now() - started,
    ok: true,
    error: null,
  });

  return out;
}

/** Chamada à Groq (API compatível com OpenAI, streaming SSE). */
async function generateWithGroq(
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
    model: `groq/${model}`,
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
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
    return fail(`Falha de rede ao chamar a Groq: ${e instanceof Error ? e.message : "erro"}`);
  }

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    if (res.status === 401) return fail("Chave GROQ_API_KEY inválida.");
    if (res.status === 429) return fail("Limite de requisições da sua conta Groq atingido.");
    if (res.status === 404)
      return fail(`Modelo Groq inválido: ${model}. Ajuste a secret GROQ_MODEL.`);
    return fail(`Groq [${res.status}]: ${body.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  // Modelos agentic (compound) às vezes devolvem o texto final no campo
  // `reasoning` e deixam `content` vazio — guardamos como reserva.
  let reasoning = "";
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
          choices?: { delta?: { content?: string; reasoning?: string } }[];
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          } | null;
          x_groq?: {
            usage?: {
              prompt_tokens?: number;
              completion_tokens?: number;
              total_tokens?: number;
            } | null;
          };
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) text += delta;
        const think = json.choices?.[0]?.delta?.reasoning;
        if (think) reasoning += think;
        if (json.usage) usage = json.usage;
        else if (json.x_groq?.usage) usage = json.x_groq.usage;
      } catch {
        // fragmento incompleto
      }
    }
  }

  const cleanThink = (s: string) =>
    s
      .replace(/<\/?think>/gi, "")
      .replace(/<\/?reasoning>/gi, "")
      .trim();

  let out = text.trim();
  if (out === "") out = cleanThink(reasoning);
  if (out === "")
    return fail("O modelo não retornou conteúdo. Tente gerar novamente.");

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

export async function generateWithGemini(
  prompt: string,
  system?: string,
  meta: AiMeta = {},
): Promise<string> {
  const groqKey = process.env["GROQ_API_KEY"];
  if (groqKey) {
    const model = process.env["GROQ_MODEL"] || "openai/gpt-oss-120b";

    // Modelos agentic da Groq (compound) têm busca web real: ativamos as regras
    // que exigem fonte verificável em vez de dados inventados.
    if (model.includes("compound")) {
      const { WEB_SEARCH_SYSTEM_ADDENDUM, WEB_SEARCH_SECTION_ADDENDUM } = await import("./prompts");
      const sys = (system ?? "") + WEB_SEARCH_SYSTEM_ADDENDUM;
      const userPrompt =
        meta.kind === "sessao" ? prompt + WEB_SEARCH_SECTION_ADDENDUM : prompt;
      return generateWithGroq(groqKey, model, userPrompt, sys, meta);
    }

    return generateWithGroq(groqKey, model, prompt, system, meta);
  }

  const ownKey = process.env["GEMINI_API_KEY"];
  if (ownKey) {
    const model = process.env["GEMINI_MODEL"] || "gemini-3.6-flash";
    return generateWithGoogleDirect(ownKey, model, prompt, system, meta);
  }


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
