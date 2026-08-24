/** Chamadas à REST API do WordPress (Application Passwords / Basic Auth). Só roda no servidor. */
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase";
import type {
  WpAuthor,
  WpConnectionRow,
  WpPublicationStatus,
  WpPublishResult,
  WpSiteMeta,
  WpTerm,
  WpTestResult,
} from "./wp-types";

const db = () =>
  createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export async function loadConnection(id: string): Promise<WpConnectionRow> {
  const { data, error } = await db().from("wp_connections").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Falha ao ler a conexão: ${error.message}`);
  if (!data) throw new Error("Conexão WordPress não encontrada.");
  return data as WpConnectionRow;
}

const base = (siteUrl: string) => `${siteUrl.trim().replace(/\/+$/, "")}/wp-json/wp/v2`;

const authHeader = (user: string, password: string) =>
  `Basic ${btoa(`${user.trim()}:${password.trim().replace(/\s+/g, "")}`)}`;

interface Creds {
  site_url: string;
  username: string;
  app_password: string;
}

/** Rota alternativa (?rest_route=) usada quando o firewall bloqueia /wp-json. */
function restRouteUrl(siteUrl: string, path: string): string {
  const [route, query] = path.split("?");
  const params = new URLSearchParams(query ?? "");
  params.set("rest_route", `/wp/v2${route}`);
  return `${siteUrl.trim().replace(/\/+$/, "")}/?${params.toString()}`;
}

interface Attempt {
  restRoute: boolean;
  /** Envia o JSON como form-urlencoded — driblar regras de Mod_Security que barram HTML em JSON. */
  form: boolean;
}

/** Converte um corpo JSON em form-urlencoded (arrays viram campos repetidos). */
function jsonToForm(json: string): URLSearchParams {
  const params = new URLSearchParams();
  const obj = JSON.parse(json) as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) for (const v of value) params.append(`${key}[]`, String(v));
    else if (typeof value === "object")
      for (const [k, v] of Object.entries(value as Record<string, unknown>))
        params.append(`${key}[${k}]`, String(v));
    else params.append(key, String(value));
  }
  return params;
}

const isJsonBody = (init: RequestInit) =>
  typeof init.body === "string" &&
  /application\/json/i.test(String((init.headers as Record<string, string> | undefined)?.["Content-Type"] ?? ""));

async function wpAttempt<T>(
  creds: Creds,
  path: string,
  init: RequestInit,
  timeoutMs: number,
  attempt: Attempt,
): Promise<{ ok: true; data: T } | { ok: false; status: number; body: unknown; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = attempt.restRoute
      ? restRouteUrl(creds.site_url, path)
      : `${base(creds.site_url)}${path}`;
    const headers: Record<string, string> = {
      Authorization: authHeader(creds.username, creds.app_password),
      Accept: "application/json",
      // Alguns servidores com Mod_Security devolvem 406 sem um User-Agent de navegador.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    };
    let body: BodyInit | null = init.body ?? null;
    if (attempt.form && isJsonBody(init)) {
      body = jsonToForm(init.body as string).toString();
      headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
    }
    const res = await fetch(url, { ...init, body, signal: controller.signal, headers });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) return { ok: false, status: res.status, body: parsed, text };
    return { ok: true, data: parsed as T };
  } finally {
    clearTimeout(timer);
  }
}

/** Status que indicam bloqueio de firewall/proxy e valem uma nova tentativa por outro caminho. */
const BLOCKED = new Set([403, 406, 418, 501, 503]);

async function wpFetch<T>(
  creds: Creds,
  path: string,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<T> {
  const attempts: Attempt[] = [
    { restRoute: false, form: false },
    { restRoute: true, form: false },
    ...(isJsonBody(init)
      ? [
          { restRoute: false, form: true },
          { restRoute: true, form: true },
        ]
      : []),
  ];
  let last: { status: number; body: unknown; text: string } | null = null;
  try {
    for (const attempt of attempts) {
      const res = await wpAttempt<T>(creds, path, init, timeoutMs, attempt);
      if (res.ok) return res.data;
      last = { status: res.status, body: res.body, text: res.text };
      // 401/404 não melhoram com outra rota: falha imediatamente.
      if (!BLOCKED.has(res.status)) break;
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      throw new Error("Tempo limite excedido ao falar com o WordPress.");
    throw e;
  }
  throw new Error(friendlyError(last!.status, last!.body, last!.text));
}

function friendlyError(status: number, body: unknown, text: string): string {
  const code = (body as { code?: string } | null)?.code ?? "";
  const message = (body as { message?: string } | null)?.message ?? text.slice(0, 300);
  if (status === 401 || code === "incorrect_password" || code === "invalid_username")
    return "Credenciais inválidas: confira o usuário e a Application Password.";
  if (status === 403)
    return `Sem permissão neste site (${message || "403"}). O usuário precisa poder publicar.`;
  if (code === "rest_no_route")
    return "REST API não encontrada. Ative os links permanentes (permalinks) no WordPress.";
  if (status === 404) return "Endpoint não encontrado — confira a URL do site.";
  if (status === 406 || /mod_security/i.test(text))
    return "O firewall do servidor (Mod_Security) bloqueou o envio. Peça à sua hospedagem para liberar as requisições REST (/wp-json/wp/v2/posts e /media) ou desativar as regras de Mod_Security para o seu usuário.";
  return `WordPress [${status}]: ${message || "erro desconhecido"}`;
}

export async function testConnection(creds: Creds): Promise<WpTestResult> {
  try {
    const me = await wpFetch<{ name: string; roles?: string[] }>(
      creds,
      "/users/me?context=edit",
      {},
      15_000,
    );
    return { ok: true, user: me.name, roles: me.roles ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function siteMeta(creds: Creds): Promise<WpSiteMeta> {
  try {
    const [categories, tags, authors] = await Promise.all([
      wpFetch<WpTerm[]>(creds, "/categories?per_page=100&orderby=name&order=asc"),
      wpFetch<WpTerm[]>(creds, "/tags?per_page=100&orderby=count&order=desc"),
      wpFetch<WpAuthor[]>(creds, "/users?per_page=100&context=edit").catch(() => [] as WpAuthor[]),
    ]);
    return {
      categories: categories.map((c) => ({ id: c.id, name: c.name, count: c.count })),
      tags: tags.map((t) => ({ id: t.id, name: t.name, count: t.count })),
      authors: authors.map((a) => ({ id: a.id, name: a.name })),
    };
  } catch (e) {
    return {
      categories: [],
      tags: [],
      authors: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function createTerm(
  creds: Creds,
  kind: "categories" | "tags",
  name: string,
): Promise<WpTerm> {
  try {
    return await wpFetch<WpTerm>(creds, `/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  } catch (e) {
    // Termo já existente: o WP devolve term_exists com o id no erro.
    const msg = e instanceof Error ? e.message : String(e);
    const existing = await wpFetch<WpTerm[]>(
      creds,
      `/${kind}?per_page=1&search=${encodeURIComponent(name)}`,
    ).catch(() => [] as WpTerm[]);
    if (existing[0]) return existing[0];
    throw new Error(msg);
  }
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl.trim());
  if (!match) throw new Error("Imagem de capa inválida.");
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, mime: match[1]! };
}

async function uploadMedia(
  creds: Creds,
  dataUrl: string,
  fileBase: string,
  altText: string,
): Promise<number> {
  const { bytes, mime } = dataUrlToBytes(dataUrl);
  const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const media = await wpFetch<{ id: number }>(
    creds,
    "/media",
    {
      method: "POST",
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${fileBase}.${ext}"`,
      },
      body: bytes as unknown as BodyInit,
    },
    60_000,
  );
  await wpFetch(creds, `/media/${media.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alt_text: altText, title: altText }),
  }).catch(() => null);
  return media.id;
}

export interface PublishInput {
  connectionId: string;
  title: string;
  content: string;
  status: "draft" | "publish" | "future";
  /** "YYYY-MM-DDTHH:mm" na hora local do site (obrigatório para future). */
  date?: string | undefined;
  slug?: string | undefined;
  metaDescription?: string | undefined;
  categories?: number[] | undefined;
  tags?: number[] | undefined;
  authorId?: number | undefined;
  cover?: string | undefined;
  coverFileName?: string | undefined;
}

const outStatus: Record<PublishInput["status"], WpPublicationStatus> = {
  draft: "rascunho",
  publish: "publicado",
  future: "agendado",
};

export async function publishToWordPress(input: PublishInput): Promise<WpPublishResult> {
  try {
    const conn = await loadConnection(input.connectionId);
    const creds: Creds = {
      site_url: conn.site_url,
      username: conn.username,
      app_password: conn.app_password,
    };

    let featured: number | undefined;
    if (input.cover) {
      featured = await uploadMedia(
        creds,
        input.cover,
        input.coverFileName || "capa",
        input.title,
      );
    }

    const body: Record<string, unknown> = {
      title: input.title,
      content: input.content,
      status: input.status,
    };
    if (input.status === "future") {
      if (!input.date) throw new Error("Informe a data e hora do agendamento.");
      body["date"] = input.date;
    }
    if (input.slug) body["slug"] = input.slug;
    if (featured) body["featured_media"] = featured;
    if (input.categories?.length) body["categories"] = input.categories;
    if (input.tags?.length) body["tags"] = input.tags;
    if (input.authorId) body["author"] = input.authorId;
    if (input.metaDescription) {
      body["excerpt"] = input.metaDescription;
      // Yoast e RankMath expõem estes campos meta quando registrados na REST API.
      body["meta"] = {
        _yoast_wpseo_metadesc: input.metaDescription,
        rank_math_description: input.metaDescription,
      };
    }

    const created = await wpFetch<{ id: number; link: string; status: string }>(
      creds,
      "/posts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      60_000,
    );

    return {
      ok: true,
      wpPostId: created.id,
      link: created.link,
      status: outStatus[input.status],
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
