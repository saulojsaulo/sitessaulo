/**
 * Agendador automático: planeja 1 artigo por blog por dia e registra
 * o progresso das 3 etapas (Estrutura → Sessões Completas → Aguardando Revisão).
 * Este módulo é puro (usado no cliente e no servidor).
 */
import type { Blog, Category, Post } from "./types";

export const RUN_HOUR_SP = 3;
/** Tempo máximo (min) para um artigo chegar em "Artigo Aguardando Revisão". */
export const STEP_TIMEOUT_MIN = 20;

export type RunState = "pendente" | "executando" | "concluido" | "falhou";
export type StepKey = "estrutura" | "sessoes" | "artigo";

export const STEPS: { key: StepKey; label: string; column: keyof SchedulerRunRow }[] = [
  { key: "estrutura", label: "Estrutura gerada com IA", column: "structure_at" },
  { key: "sessoes", label: "Sessões Completas", column: "sections_at" },
  { key: "artigo", label: "Artigo Aguardando Revisão", column: "article_at" },
];

export interface SchedulerRunRow {
  id: string;
  run_date: string;
  post_id: string;
  blog_id: string;
  blog_name: string;
  post_title: string;
  position: number;
  state: RunState;
  structure_at: string | null;
  sections_at: string | null;
  article_at: string | null;
  started_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo. */
export function todayInSP(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

export const parseISODate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Publicações são diárias: todos os dias da semana entram na fila. */
export const isBusinessDay = (_d: Date) => true;

export const isBusinessDayISO = (iso: string) => isBusinessDay(parseISODate(iso));


/**
 * Posição do dia útil `dateISO` contando a partir de `fromISO` (índice 0 =
 * primeiro dia útil >= fromISO). Retorna null para datas passadas ou fins de semana.
 */
export function businessDayIndex(fromISO: string, dateISO: string): number | null {
  if (dateISO < fromISO) return null;
  if (!isBusinessDayISO(dateISO)) return null;
  const cursor = parseISODate(fromISO);
  let index = 0;
  for (let guard = 0; guard < 4000; guard += 1) {
    const cur = toISODate(cursor);
    if (isBusinessDay(cursor)) {
      if (cur === dateISO) return index;
      index += 1;
    }
    if (cur >= dateISO) return null;
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

/** Próximos `count` dias a partir de `fromISO` (inclusive). */
export function nextBusinessDays(fromISO: string, count: number): string[] {
  const out: string[] = [];
  const cursor = parseISODate(fromISO);
  while (out.length < count) {
    if (isBusinessDay(cursor)) out.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Status que ainda precisam passar pelo ciclo automático. */
const PENDING_STATUS = new Set(["rascunho", "estrutura", "sessoes_completas"]);

/**
 * Fila de um blog em round-robin de categorias: Cat A, Cat B, Cat C… e volta
 * para Cat A, para nunca publicar duas vezes a mesma categoria em sequência.
 */
export function blogQueue(
  posts: Post[],
  categories: Category[],
  blogId: string,
  /** Ids de postagens que possuem imagem de capa. Se informado, só elas entram na fila. */
  withCover?: Set<string>,
): Post[] {
  const catName = (id?: string) =>
    categories.find((c) => c.id === id)?.name ?? "\uffffSem categoria";

  const eligible = posts
    .filter(
      (p) =>
        p.blogId === blogId &&
        PENDING_STATUS.has(p.status) &&
        (withCover ? withCover.has(p.id) : true),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title));

  const groups = new Map<string, Post[]>();
  for (const p of eligible) {
    const key = p.categoryId ?? "__none__";
    const bucket = groups.get(key);
    if (bucket) bucket.push(p);
    else groups.set(key, [p]);
  }
  const buckets = [...groups.entries()]
    .sort((a, b) => catName(a[0]).localeCompare(catName(b[0]), "pt-BR"))
    .map(([, v]) => v);

  const out: Post[] = [];
  for (let i = 0; out.length < eligible.length; i += 1) {
    for (const bucket of buckets) {
      const item = bucket[i];
      if (item) out.push(item);
    }
  }
  return out;
}

export interface PlanItem {
  postId: string;
  postTitle: string;
  blogId: string;
  blogName: string;
  /** Ordem de execução no dia (blogs em ordem alfabética). */
  position: number;
}

/**
 * Plano projetado para uma data: 1 artigo por blog, blogs em ordem alfabética.
 * Só projeta datas futuras/hoje — o passado vem dos registros salvos.
 */
export function planForDate(input: {
  blogs: Blog[];
  categories: Category[];
  posts: Post[];
  dateISO: string;
  todayISO: string;
  /** Só postagens com imagem de capa entram na fila. */
  withCover?: Set<string>;
}): PlanItem[] {
  const { blogs, categories, posts, dateISO, todayISO, withCover } = input;
  const offset = businessDayIndex(todayISO, dateISO);
  if (offset === null) return [];

  const ordered = [...blogs].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const items: PlanItem[] = [];
  for (const blog of ordered) {
    const queue = blogQueue(posts, categories, blog.id, withCover);
    const post = queue[offset];
    if (!post) continue;
    items.push({
      postId: post.id,
      postTitle: post.title,
      blogId: blog.id,
      blogName: blog.name,
      position: items.length,
    });
  }
  return items;
}

export type DotTone = "pendente" | "ok" | "atraso" | "falha";

/** Cor do pontinho de uma etapa na linha do tempo. */
export function stepTone(
  run: Pick<SchedulerRunRow, "state" | "structure_at" | "sections_at" | "article_at">,
  step: StepKey,
  opts: { dateISO: string; todayISO: string; nowSPHour: number },
): DotTone {
  const map: Record<StepKey, string | null> = {
    estrutura: run.structure_at,
    sessoes: run.sections_at,
    artigo: run.article_at,
  };
  if (map[step]) return "ok";
  if (run.state === "falhou") return "falha";
  const started = opts.dateISO < opts.todayISO;
  const dueToday = opts.dateISO === opts.todayISO && opts.nowSPHour >= RUN_HOUR_SP;
  if (started || dueToday) return "atraso";
  return "pendente";
}

export const nowHourSP = (now: Date = new Date()) =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
