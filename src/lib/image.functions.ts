import { createServerFn } from "@tanstack/react-start";

export const generateCoverImageFn = createServerFn({ method: "POST" })
  .inputValidator((input: { prompt: string }) => {
    const prompt = String(input?.prompt ?? "").trim();
    if (!prompt) throw new Error("Prompt vazio");
    return { prompt: prompt.slice(0, 4000) };
  })
  .handler(async ({ data }) => {
    const { generateCoverImage } = await import("./image.server");
    const dataUrl = await generateCoverImage(data.prompt);
    return { dataUrl };
  });
