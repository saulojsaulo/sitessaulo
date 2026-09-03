/**
 * Plano de publicação persistido (tabela scheduler_plan).
 *
 * O calendário do Agendador deixa de ser uma projeção volátil: a atribuição
 * de cada artigo a uma data + ciclo é gravada no banco na primeira vez que a
 * data é aberta e nunca muda depois. Artigos já publicados (ou agendados)
 * nunca entram em datas futuras.
 */
import { supabase } from "./supabase";
import { blogQueue, todayInSP, CYCLES, nextBusinessDays } from "./scheduler";
import type { Blog, Category, Post } from "./types";
import type { BlogRow, CategoryRow, PostRow } from "./supabase";

export interface PlanRow {
  id: string;
  run_date: string;
  cycle: number;
  position: number;
  blog_id: string;
  blog_name: string;
  post_id: string;
  post_title: string;
  category_id: string | null;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Status que não devem mais ocupar uma data futura. */
const DONE_STATUS = new Set(["publicado", "agendado"]);

/** Limite de dias que podem ser gerados de uma vez. */
const MAX_DAYS = 180;

/** Lê todas as páginas de uma consulta (PostgREST devolve no máx. 1000 linhas). */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let page = 0; page < 50; page += 1) {
    const { data, error } = await build(page * size, page * size + size - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

async function loadData() {
  const [blogsRes, catsRes, postRows, coverRows] = await Promise.all([
    supabase.from("blogs").select("*").order("name"),
    supabase.from("categories").select("*").order("name"),
    fetchAll<Partial<PostRow>>((from, to) =>
      supabase
        .from("posts")
        .select("id,blog_id,category_id,title,status,created_at")
        .order("created_at")
        .range(from, to),
    ),
    fetchAll<{ id: string }>((from, to) =>
      supabase
        .from("posts")
        .select("id")
        .not("cover", "is", null)
        .neq("cover", "")
        .order("id")
        .range(from, to),
    ),
  ]);
  const postsRes = { data: postRows };
  const coverRes = { data: coverRows };
  const err = blogsRes.error ?? catsRes.error;
  if (err) throw new Error(err.message);



  const blogs: Blog[] = ((blogsRes.data ?? []) as BlogRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    description: r.description ?? "",
    color: r.color,
    createdAt: r.created_at,
  }));
  const categories: Category[] = ((catsRes.data ?? []) as CategoryRow[]).map((r) => ({
    id: r.id,
    blogId: r.blog_id,
    name: r.name,
  }));
  const posts: Post[] = ((postsRes.data ?? []) as Partial<PostRow>[]).map((r) => ({
    id: r.id as string,
    blogId: r.blog_id as string,
    categoryId: r.category_id ?? undefined,
    title: r.title as string,
    content: "",
    tags: [],
    status: r.status as Post["status"],
    publishDate: "",
    createdAt: r.created_at as string,
  }));
  const withCover = new Set(((coverRes.data ?? []) as { id: string }[]).map((r) => r.id));
  return { blogs, categories, posts, withCover };
}

/**
 * Garante que existe plano gravado de hoje até `dateISO` e devolve as linhas
 * da data pedida (todos os ciclos).
 */
export async function ensurePlan(dateISO: string): Promise<PlanRow[]> {
  const todayISO = todayInSP();

  // Datas passadas: apenas histórico gravado.
  if (dateISO < todayISO) return listPlan(dateISO);

  const { blogs, categories, posts, withCover } = await loadData();
  const postById = new Map(posts.map((p) => [p.id, p]));

  // Todo o plano já gravado (qualquer data) — usado para nunca repetir artigo.
  const all = await fetchAll<PlanRow>((from, to) =>
    supabase.from("scheduler_plan").select("*").order("run_date").range(from, to),
  );
  const future = all.filter((r) => r.run_date >= todayISO);

  // Remove de datas futuras os artigos que já foram publicados/agendados
  // ou que perderam a imagem de capa.
  const stale = future.filter((r) => {
    const p = postById.get(r.post_id);
    return !p || DONE_STATUS.has(p.status) || !withCover.has(p.id);
  });
  if (stale.length > 0) {
    const ids = stale.map((r) => r.id);
    const { error } = await supabase.from("scheduler_plan").delete().in("id", ids);
    if (error) throw new Error(error.message);
  }
  const staleIds = new Set(stale.map((r) => r.id));
  const kept = future.filter((r) => !staleIds.has(r.id));
  /** Artigos já usados em qualquer data (inclui histórico passado). */
  const usedEver = new Set(all.filter((r) => !staleIds.has(r.id)).map((r) => r.post_id));


  // Datas que precisam ser geradas (de hoje até a data pedida).
  const daysNeeded = Math.min(
    MAX_DAYS,
    Math.round((Date.parse(`${dateISO}T00:00:00Z`) - Date.parse(`${todayISO}T00:00:00Z`)) / 86_400_000) + 1,
  );
  const dates = nextBusinessDays(todayISO, Math.max(1, daysNeeded));

  const assigned = usedEver;
  const byDate = new Map<string, PlanRow[]>();
  for (const r of kept) {
    const bucket = byDate.get(r.run_date);
    if (bucket) bucket.push(r);
    else byDate.set(r.run_date, [r]);
  }

  // Fila elegível por blog: com capa, ainda não publicada/agendada.
  const queues = new Map<string, Post[]>();
  for (const blog of blogs) {
    const queue = blogQueue(posts, categories, blog.id, withCover, true).filter(
      (p) => !DONE_STATUS.has(p.status),
    );
    queues.set(blog.id, queue);
  }

  const ordered = [...blogs].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const inserts: PlanRow[] = [];

  for (const day of dates) {
    const existing = byDate.get(day) ?? [];
    for (let cycle = 0; cycle < CYCLES.length; cycle += 1) {
      const rowsInCycle = existing.filter((r) => r.cycle === cycle);
      const blogsDone = new Set(rowsInCycle.map((r) => r.blog_id));
      if (blogsDone.size >= ordered.length) continue;
      let position = rowsInCycle.length;
      for (const blog of ordered) {
        if (blogsDone.has(blog.id)) continue;
        const queue = queues.get(blog.id) ?? [];
        const post = queue.find((p) => !assigned.has(p.id));
        if (!post) continue;
        assigned.add(post.id);
        inserts.push({
          id: uid(),
          run_date: day,
          cycle,
          position,
          blog_id: blog.id,
          blog_name: blog.name,
          post_id: post.id,
          post_title: post.title,
          category_id: post.categoryId ?? null,
        });
        position += 1;
      }
    }
  }


  if (inserts.length > 0) {
    // ignoreDuplicates: se outra aba gerou o mesmo artigo em paralelo, não falha.
    const { error } = await supabase
      .from("scheduler_plan")
      .upsert(inserts, { onConflict: "post_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }


  return listPlan(dateISO);
}

export async function listPlan(dateISO: string): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from("scheduler_plan")
    .select("*")
    .eq("run_date", dateISO)
    .order("cycle")
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanRow[];
}
