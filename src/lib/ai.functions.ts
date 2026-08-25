import { createServerFn } from "@tanstack/react-start";

export const generateText = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      prompt: string;
      system?: string;
      kind?: string;
      postId?: string | null;
      postTitle?: string | null;
    }) => {
      const prompt = String(input?.prompt ?? "").trim();
      if (!prompt) throw new Error("Prompt vazio");
      return {
        prompt,
        system: input.system ? String(input.system) : undefined,
        kind: input.kind ? String(input.kind) : "outro",
        postId: input.postId ? String(input.postId) : null,
        postTitle: input.postTitle ? String(input.postTitle).slice(0, 200) : null,
      };
    },
  )
  .handler(async ({ data }) => {
    const { generateWithGemini } = await import("./ai.server");
    const text = await generateWithGemini(data.prompt, data.system, {
      kind: data.kind,
      postId: data.postId,
      postTitle: data.postTitle,
    });
    return { text };
  });
