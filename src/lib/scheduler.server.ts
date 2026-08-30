/**
 * Execução do agendador (servidor). Roda o ciclo de 3 etapas de um artigo por vez,
 * com trava de execução única e limite de 20 minutos por artigo.
 */
import { supabase } from "./supabase";
import { generateWithGemini } from "./ai.server";
import { SYSTEM_PROMPT, buildSectionPrompt, buildStructurePrompt, summarizeOutline } from "./prompts";
import {
  buildArticle,
  parseWorkspace,
  serializeWorkspace,
  splitSections,
} from "./content-workspace";
import {
  STEP_TIMEOUT_MIN,
  planForDate,
  todayInSP,
  isBusinessDayISO,
  type SchedulerRunRow,
} from "./scheduler";
import type { Blog, Category, Post } from "./types";
import type { BlogRow, CategoryRow, PostRow } from "./supabase";

const LOCK_ID = "runner";
const LOCK_MINUTES = 25;

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const nowISO = () => new Date().toISOString();

async function loadData() {
  const [blogsRes, catsRes, postsRes, coverRes] = await Promise.all([
    supabase.from("blogs").select("*").order("name"),
    supabase.from("categories").select("*").order("name"),
    supabase
      .from("posts")
      .select("id,blog_id,category_id,title,content,tags,status,publish_date,created_at")
      .order("created_at"),
    supabase.from("posts").select("id").not("cover", "is", null).neq("cover", ""),
  ]);
  const err = blogsRes.error ?? catsRes.error ?? postsRes.error;
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
  const posts: Post[] = ((postsRes.data ?? []) as PostRow[]).map((r) => ({
    id: r.id,
    blogId: r.blog_id,
    categoryId: r.category_id ?? undefined,
    title: r.title,
    content: r.content,
    tags: r.tags ?? [],
    status: r.status as Post["status"],
    publishDate: r.publish_date,
    createdAt: r.created_at,
  }));
  return { blogs, categories, posts };
}

/** Cria os registros do dia a partir do plano (idempotente). */
export async function ensureRuns(dateISO: string): Promise<SchedulerRunRow[]> {
  const { blogs, categories, posts } = await loadData();
  const existing = await listRuns(dateISO);

  if (isBusinessDayISO(dateISO) && dateISO >= todayInSP()) {
    const plan = planForDate({ blogs, categories, posts, dateISO, todayISO: todayInSP() });
    const taken = new Set(existing.map((r) => r.post_id));
    const blogsWithRun = new Set(existing.map((r) => r.blog_id));
    const missing = plan.filter((i) => !taken.has(i.postId) && !blogsWithRun.has(i.blogId));
    if (missing.length > 0) {
      const rows = missing.map((i) => ({
        id: uid(),
        run_date: dateISO,
        post_id: i.postId,
        blog_id: i.blogId,
        blog_name: i.blogName,
        post_title: i.postTitle,
        position: i.position,
        state: "pendente",
        created_at: nowISO(),
        updated_at: nowISO(),
      }));
      const { error } = await supabase.from("scheduler_runs").insert(rows);
      if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
      return listRuns(dateISO);
    }
  }
  return existing;
}

export async function listRuns(dateISO: string): Promise<SchedulerRunRow[]> {
  const { data, error } = await supabase
    .from("scheduler_runs")
    .select("*")
    .eq("run_date", dateISO)
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []) as SchedulerRunRow[];
}

async function patchRun(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase
    .from("scheduler_runs")
    .update({ ...patch, updated_at: nowISO() })
    .eq("id", id);
  if (error) console.error("[scheduler] patchRun", error.message);
}

async function acquireLock(): Promise<boolean> {
  const until = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
  const { data } = await supabase
    .from("scheduler_locks")
    .select("lease_until")
    .eq("id", LOCK_ID)
    .maybeSingle();
  const lease = (data as { lease_until?: string } | null)?.lease_until;
  if (lease && new Date(lease).getTime() > Date.now()) return false;
  const { error } = await supabase
    .from("scheduler_locks")
    .upsert({ id: LOCK_ID, lease_until: until });
  if (error) {
    console.error("[scheduler] lock", error.message);
    return false;
  }
  return true;
}

async function releaseLock() {
  await supabase
    .from("scheduler_locks")
    .upsert({ id: LOCK_ID, lease_until: new Date(0).toISOString() });
}

async function savePost(postId: string, content: string, status: Post["status"]) {
  const { error } = await supabase.from("posts").update({ content, status }).eq("id", postId);
  if (error) throw new Error(error.message);
}

/** Roda as 3 etapas de um artigo, retomando de onde parou. */
export async function runPipeline(postId: string, runId?: string): Promise<SchedulerRunRow | null> {
  const { blogs, posts } = await loadData();
  const post = posts.find((p) => p.id === postId);
  if (!post) throw new Error("Postagem não encontrada");
  const blog = blogs.find((b) => b.id === post.blogId);
  const niche = blog?.description?.trim() || blog?.name;
  const ctx = niche ? { niche } : {};

  let ws = parseWorkspace(post.content);

  // Etapa 1 — Estrutura
  if (!ws.raw.trim()) {
    const raw = await generateWithGemini(buildStructurePrompt(post.title, ctx), SYSTEM_PROMPT, {
      kind: "estrutura",
      postId: post.id,
      postTitle: post.title,
    });
    if (!raw.trim()) throw new Error("A IA não retornou a estrutura");
    ws = { ...ws, raw };
  }
  await savePost(post.id, serializeWorkspace(ws), "estrutura");
  if (runId) await patchRun(runId, { structure_at: nowISO() });

  // Etapa 2 — Sessões individuais
  let sections = ws.sections;
  if (sections.length === 0 || sections.some((s) => !s.prompt.trim())) {
    const split = splitSections(ws.raw);
    if (split.sections.length === 0) throw new Error("Não foi possível dividir a estrutura em sessões");
    const previous = new Map(ws.sections.map((s) => [s.prompt.trim(), s.response]));
    sections = split.sections.map((s) => ({ ...s, response: previous.get(s.prompt.trim()) ?? "" }));
  }
  const outline = summarizeOutline(sections.map((s) => s.prompt));

  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i]!;
    if (section.response.trim()) continue;
    const previousText = sections
      .slice(0, i)
      .map((s) => s.response.trim())
      .filter((t) => t !== "")
      .join("\n\n");
    const text = await generateWithGemini(
      buildSectionPrompt(post.title, outline, section.prompt, ctx, previousText),
      SYSTEM_PROMPT,
      { kind: "sessao", postId: post.id, postTitle: post.title },
    );
    if (!text.trim()) throw new Error(`A IA não retornou a sessão ${i + 1}`);
    sections = sections.map((s, j) => (j === i ? { ...s, response: text } : s));
    ws = { ...ws, sections, article: buildArticle(sections), manual: false };
    await savePost(post.id, serializeWorkspace(ws), "estrutura");
  }

  ws = { ...ws, sections, article: buildArticle(sections), manual: false };
  await savePost(post.id, serializeWorkspace(ws), "sessoes_completas");
  if (runId) await patchRun(runId, { sections_at: nowISO() });

  // Etapa 3 — Artigo Pronto aguardando revisão
  const article = buildArticle(sections);
  if (!article.trim()) throw new Error("Artigo montado ficou vazio");
  ws = { ...ws, article, manual: false };
  await savePost(post.id, serializeWorkspace(ws), "aguardando_revisao");
  if (runId) await patchRun(runId, { article_at: nowISO(), state: "concluido", error: null });

  return null;
}

export interface RunResult {
  ok: boolean;
  message: string;
  postId?: string;
}

/**
 * Uma invocação = no máximo um artigo. Chamada de 5 em 5 minutos a partir das 03:00
 * (fuso São Paulo), processa a fila do dia em ordem alfabética de blog.
 */
export async function runScheduler(dateISO = todayInSP()): Promise<RunResult> {
  if (!(await acquireLock())) return { ok: true, message: "Outra execução em andamento" };

  try {
    const runs = await ensureRuns(dateISO);
    if (runs.length === 0) return { ok: true, message: "Nenhum artigo planejado para hoje" };

    // Se o artigo atual está executando há menos de 20 min, aguarda.
    const running = runs.find((r) => r.state === "executando");
    if (running) {
      const age = Date.now() - new Date(running.started_at ?? running.updated_at).getTime();
      if (age < STEP_TIMEOUT_MIN * 60_000)
        return { ok: true, message: `Aguardando "${running.post_title}" concluir` };
      await patchRun(running.id, {
        state: "falhou",
        error: `Excedeu ${STEP_TIMEOUT_MIN} minutos sem concluir`,
      });
    }

    const next = (await listRuns(dateISO)).find((r) => r.state === "pendente");

    if (!next) return { ok: true, message: "Fila do dia concluída" };

    await patchRun(next.id, { state: "executando", started_at: nowISO(), error: null });
    try {
      await runPipeline(next.post_id, next.id);
      return { ok: true, message: `"${next.post_title}" chegou em Aguardando Revisão`, postId: next.post_id };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha desconhecida";
      await patchRun(next.id, { state: "falhou", error: message });
      return { ok: false, message: `${next.post_title}: ${message}`, postId: next.post_id };
    }
  } finally {
    await releaseLock();
  }
}
