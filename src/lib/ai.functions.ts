import { createServerFn } from "@tanstack/react-start";

export const generateText = createServerFn({ method: "POST" })
  .inputValidator((input: { prompt: string; system?: string }) => {
    const prompt = String(input?.prompt ?? "").trim();
    if (!prompt) throw new Error("Prompt vazio");
    return { prompt, system: input.system ? String(input.system) : undefined };
  })
  .handler(async ({ data }) => {
    const { generateWithGemini } = await import("./ai.server");
    const text = await generateWithGemini(data.prompt, data.system);
    return { text };
  });
