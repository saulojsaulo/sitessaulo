/** Tipos compartilhados da integração com a REST API do WordPress. */

export type WpConnectionStatus = "nao_testado" | "conectado" | "erro";

export interface WpConnectionRow {
  id: string;
  name: string;
  site_url: string;
  username: string;
  app_password: string;
  status: WpConnectionStatus;
  last_error: string | null;
  last_tested_at: string | null;
  created_at: string;
}

export type WpPublicationStatus = "rascunho" | "agendado" | "publicado" | "falhou";

export interface WpPublicationRow {
  id: string;
  post_id: string;
  connection_id: string;
  title: string;
  wp_post_id: number | null;
  wp_link: string | null;
  status: WpPublicationStatus;
  scheduled_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface WpTerm {
  id: number;
  name: string;
  count?: number;
}

export interface WpAuthor {
  id: number;
  name: string;
}

export interface WpTestResult {
  ok: boolean;
  /** Nome do usuário autenticado no WordPress. */
  user?: string;
  roles?: string[];
  error?: string;
}

export interface WpSiteMeta {
  categories: WpTerm[];
  tags: WpTerm[];
  authors: WpAuthor[];
  error?: string;
}

export interface WpPublishResult {
  ok: boolean;
  wpPostId?: number;
  link?: string;
  status?: WpPublicationStatus;
  error?: string;
}

export const WP_STATUS_LABEL: Record<WpPublicationStatus, string> = {
  rascunho: "Rascunho",
  agendado: "Agendado",
  publicado: "Publicado",
  falhou: "Falhou",
};

export const WP_CONNECTION_LABEL: Record<WpConnectionStatus, string> = {
  nao_testado: "Não testado",
  conectado: "Conectado",
  erro: "Erro",
};

/** Converte o Artigo Pronto (texto/markdown leve) em HTML para o WordPress. */
export function articleToHtml(text: string): string {
  if (/<(p|h[1-6]|ul|ol|div)[\s>]/i.test(text)) return text;
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let list: string[] = [];

  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|\s)\*(?!\s)(.+?)\*(?=\s|$|[.,;:!?])/g, "$1<em>$2</em>");

  const flush = () => {
    if (list.length) {
      out.push(`<ul>${list.map((li) => `<li>${li}</li>`).join("")}</ul>`);
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      flush();
      continue;
    }
    const heading = /^(#{2,4})\s*(.+)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
      continue;
    }
    const item = /^[-*•]\s+(.+)$/.exec(line);
    if (item) {
      list.push(inline(item[1]!));
      continue;
    }
    flush();
    out.push(`<p>${inline(line)}</p>`);
  }
  flush();
  return out.join("\n");
}

export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
