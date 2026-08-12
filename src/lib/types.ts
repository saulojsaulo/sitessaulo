export type PostStatus = "rascunho" | "agendado" | "publicado";

export interface Blog {
  id: string;
  name: string;
  url: string;
  description: string;
  logo?: string;
  color: string;
  createdAt: string;
}

export interface Category {
  id: string;
  blogId: string;
  name: string;
  description?: string;
}

export interface Post {
  id: string;
  blogId: string;
  categoryId?: string;
  title: string;
  content: string;
  tags: string[];
  status: PostStatus;
  publishDate: string;
  cover?: string;
  createdAt: string;
}

export const STATUS_LABEL: Record<PostStatus, string> = {
  rascunho: "Rascunho",
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