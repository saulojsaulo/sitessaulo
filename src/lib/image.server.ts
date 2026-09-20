/** Geração de imagem via ChatGPT (OpenAI Images API). */
const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
export const IMAGE_MODEL = "gpt-image-1";

export async function generateCoverImage(prompt: string): Promise<string> {
  const key = process.env["OPENAI_API_KEY"]?.trim();
  if (!key) throw new Error("OPENAI_API_KEY não configurada");
  const model = process.env["OPENAI_IMAGE_MODEL"]?.trim() || IMAGE_MODEL;

  let res: Response;
  try {
    res = await fetch(OPENAI_IMAGES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, prompt, size: "1536x1024", n: 1 }),
    });
  } catch (e) {
    throw new Error(
      `Falha de rede ao gerar a imagem: ${e instanceof Error ? e.message : "erro"}`,
    );
  }

  const body = await res.text();
  if (!res.ok) {
    if (res.status === 401) throw new Error("Chave OPENAI_API_KEY inválida ou revogada.");
    if (res.status === 429)
      throw new Error("Limite de requisições/créditos da sua conta OpenAI atingido.");
    if (res.status === 404)
      throw new Error(`Modelo de imagem inválido: ${model}. Ajuste a secret OPENAI_IMAGE_MODEL.`);
    throw new Error(`ChatGPT imagens [${res.status}]: ${body.slice(0, 300)}`);
  }

  let json: { data?: { b64_json?: string; url?: string }[] };
  try {
    json = JSON.parse(body) as typeof json;
  } catch {
    throw new Error("Resposta inválida do ChatGPT ao gerar a imagem.");
  }

  const item = json.data?.[0];
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item?.url) {
    const img = await fetch(item.url);
    const buf = Buffer.from(await img.arrayBuffer());
    return `data:image/png;base64,${buf.toString("base64")}`;
  }
  throw new Error("O ChatGPT não devolveu nenhuma imagem. Tente novamente.");
}
