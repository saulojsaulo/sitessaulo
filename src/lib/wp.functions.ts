import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { WpPublishResult, WpSiteMeta, WpTerm, WpTestResult } from "./wp-types";

const credsSchema = z.object({
  siteUrl: z.string().min(4),
  username: z.string().min(1),
  appPassword: z.string().min(1),
});

/** Testa credenciais informadas no formulário (antes de salvar). */
export const testWpCredentials = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => credsSchema.parse(input))
  .handler(async ({ data }): Promise<WpTestResult> => {
    const { testConnection } = await import("./wp.server");
    return testConnection({
      site_url: data.siteUrl,
      username: data.username,
      app_password: data.appPassword,
    });
  });

/** Testa uma conexão já salva no banco. */
export const testWpConnection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ connectionId: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<WpTestResult> => {
    const { loadConnection, testConnection } = await import("./wp.server");
    try {
      const c = await loadConnection(data.connectionId);
      return testConnection({
        site_url: c.site_url,
        username: c.username,
        app_password: c.app_password,
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

/** Categorias, tags e autores reais do site. */
export const getWpSiteMeta = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ connectionId: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<WpSiteMeta> => {
    const { loadConnection, siteMeta } = await import("./wp.server");
    try {
      const c = await loadConnection(data.connectionId);
      return siteMeta({
        site_url: c.site_url,
        username: c.username,
        app_password: c.app_password,
      });
    } catch (e) {
      return {
        categories: [],
        tags: [],
        authors: [],
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

export const createWpTerm = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        connectionId: z.string().min(1),
        kind: z.enum(["categories", "tags"]),
        name: z.string().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; term?: WpTerm; error?: string }> => {
    const { createTerm, loadConnection } = await import("./wp.server");
    try {
      const c = await loadConnection(data.connectionId);
      const term = await createTerm(
        { site_url: c.site_url, username: c.username, app_password: c.app_password },
        data.kind,
        data.name,
      );
      return { ok: true, term };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

export const publishWpPost = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        connectionId: z.string().min(1),
        title: z.string().min(1).max(300),
        content: z.string().min(1),
        status: z.enum(["draft", "publish", "future"]),
        date: z.string().min(10).optional(),
        slug: z.string().max(200).optional(),
        metaDescription: z.string().max(400).optional(),
        categories: z.array(z.number().int().positive()).max(20).optional(),
        tags: z.array(z.number().int().positive()).max(50).optional(),
        authorId: z.number().int().positive().optional(),
        cover: z.string().max(12_000_000).optional(),
        coverFileName: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<WpPublishResult> => {
    const { publishToWordPress } = await import("./wp.server");
    return publishToWordPress(data);
  });
