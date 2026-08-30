export type PostStatus =
  | "rascunho"
  | "estrutura"
  | "sessoes_completas"
  | "aguardando_revisao"
  | "artigo_completo"
  | "agendado"
  | "publicado";


export interface Blog {
  id: string;
  name: string;
  url: string;
  description: string;
  logo?: string | undefined;
  color: string;
  createdAt: string;
}

export interface Category {
  id: string;
  blogId: string;
  name: string;
  description?: string | undefined;
}

export interface Post {
  id: string;
  blogId: string;
  categoryId?: string | undefined;
  title: string;
  content: string;
  tags: string[];
  status: PostStatus;
  publishDate: string;
  cover?: string | undefined;
  createdAt: string;
}

export const STATUS_LABEL: Record<PostStatus, string> = {
  rascunho: "Rascunho",
  estrutura: "Estrutura",
  sessoes_completas: "Sessões Completas",
  aguardando_revisao: "Artigo Aguardando Revisão",
  artigo_completo: "Artigo Completo",
  agendado: "Agendado",
  publicado: "Publicado",
};


export const BLOG_COLORS = [
  "oklch(0.58 0.204 277)",
  "oklch(0.7 0.14 197)",
  "oklch(0.66 0.16 155)",
  "oklch(0.78 0.16 70)",
  "oklch(0.62 0.2 340)",
];

/** Domínios com painel WordPress disponível em /wp-admin */
export const WP_ADMIN_DOMAINS = [
  "ailovepdf.com.br",
  "smallpdf.com.br",
  "moneypress.com.br",
  "cnpjbusca.com",
  "valorfipe.com",
  "hinarioccb.com",
  "bibliaonlinecompleta.com.br",
  "curiosohein.com",
  "issoeincrivel.com",
  "todogostoso.com",
];

const normalizeDomain = (url: string) =>
  url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

export function siteUrl(url: string) {
  const d = normalizeDomain(url);
  return d ? `https://${d}` : "";
}

export function wpAdminUrl(url: string) {
  const d = normalizeDomain(url);
  if (!d) return "";
  return WP_ADMIN_DOMAINS.includes(d) ? `https://${d}/wp-admin` : "";
}