/**
 * Execução do agendador (servidor). Roda o ciclo de 3 etapas de um artigo por vez,
 * com trava de execução única e limite de 20 minutos por artigo.
 */
import { supabase } from "./supabase";
import { generateWithGemini } from "./ai.server";
import {
  SYSTEM_PROMPT,
  REVIEW_SYSTEM_PROMPT,
  buildSectionPrompt,
  buildStructurePrompt,
  buildReviewPrompt,
  parseReviewOutput,
  summarizeOutline,
} from "./prompts";
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
const LOCK_MINUTES = 3;

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
  const withCover = new Set(
    ((coverRes.data ?? []) as { id: string }[]).map((r) => r.id),
  );
  return { blogs, categories, posts, withCover };
}

/** Cria os registros do dia a partir do plano (idempotente). */
export async function ensureRuns(dateISO: string): Promise<SchedulerRunRow[]> {
  const { blogs, categories, posts, withCover } = await loadData();
  const existing = await listRuns(dateISO);

  if (isBusinessDayISO(dateISO) && dateISO >= todayInSP()) {
    const plan = planForDate({
      blogs,
      categories,
      posts,
      dateISO,
      todayISO: todayInSP(),
      withCover,
    });
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

/** Tempo de CPU/rede que uma invocação pode usar antes de devolver o controle. */
const BUDGET_MS = 55_000;

type StepResult = "progress" | "done";

/**
 * Executa UMA etapa pequena do artigo (estrutura, uma sessão ou a montagem final)
 * e salva o progresso. Assim cada invocação termina rápido e o ciclo é retomável.
 */
async function stepOnce(postId: string, runId?: string): Promise<StepResult> {
  const { blogs, posts } = await loadData();
  const post = posts.find((p) => p.id === postId);
  if (!post) throw new Error("Postagem não encontrada");
  const blog = blogs.find((b) => b.id === post.blogId);
  const niche = blog?.description?.trim() || blog?.name;
  const ctx = niche ? { niche } : {};

  let ws = parseWorkspace(post.content);

  // Etapa 1 — Estrutura Bruta ("Gerar com IA")
  if (!ws.raw.trim()) {
    const raw = await generateWithGemini(buildStructurePrompt(post.title, ctx), SYSTEM_PROMPT, {
      kind: "estrutura",
      postId: post.id,
      postTitle: post.title,
    });
    if (!raw.trim()) throw new Error("A IA não retornou a estrutura");
    ws = { ...ws, raw };
    await savePost(post.id, serializeWorkspace(ws), "estrutura");
    if (runId) await patchRun(runId, { structure_at: nowISO() });
    return "progress";
  }

  // Etapa 2 — Estruturas Individuais (divide a estrutura em sessões)
  let sections = ws.sections;
  if (sections.length === 0 || sections.some((s) => !s.prompt.trim())) {
    const split = splitSections(ws.raw);
    if (split.sections.length === 0)
      throw new Error("Não foi possível dividir a estrutura em sessões");
    const previous = new Map(ws.sections.map((s) => [s.prompt.trim(), s.response]));
    sections = split.sections.map((s) => ({ ...s, response: previous.get(s.prompt.trim()) ?? "" }));
    ws = { ...ws, sections };
    await savePost(post.id, serializeWorkspace(ws), "sessoes_completas");
    if (runId) await patchRun(runId, { structure_at: nowISO() });
    return "progress";
  }

  // Etapa 3 — uma sessão por passo ("Gerar Todas as Sessões com IA")
  const idx = sections.findIndex((s) => !s.response.trim());
  if (idx >= 0) {
    const outline = summarizeOutline(sections.map((s) => s.prompt));
    const section = sections[idx]!;
    const previousText = sections
      .slice(0, idx)
      .map((s) => s.response.trim())
      .filter((t) => t !== "")
      .join("\n\n");
    const text = await generateWithGemini(
      buildSectionPrompt(post.title, outline, section.prompt, ctx, previousText),
      SYSTEM_PROMPT,
      { kind: "sessao", postId: post.id, postTitle: post.title },
    );
    if (!text.trim()) throw new Error(`A IA não retornou a sessão ${idx + 1}`);
    sections = sections.map((s, j) => (j === idx ? { ...s, response: text } : s));
    ws = { ...ws, sections, article: buildArticle(sections), manual: false };
    const last = idx === sections.length - 1;
    await savePost(
      post.id,
      serializeWorkspace(ws),
      last ? "aguardando_revisao" : "sessoes_completas",
    );
    if (runId && last) await patchRun(runId, { sections_at: nowISO() });
    return "progress";
  }

  // Etapa 4 — Artigo Prompt (junta as sessões geradas)
  const article = buildArticle(sections);
  if (!article.trim()) throw new Error("Artigo montado ficou vazio");
  if (article.trim() !== ws.article.trim()) {
    ws = { ...ws, sections, article, manual: false };
    await savePost(post.id, serializeWorkspace(ws), "aguardando_revisao");
    if (runId) await patchRun(runId, { sections_at: nowISO() });
    return "progress";
  }

  // Etapa 5/6 — Revisar Conteúdo → Artigo Publicação
  if (!ws.published.trim()) {
    const reviewed = await generateWithGemini(buildReviewPrompt(article), REVIEW_SYSTEM_PROMPT, {
      kind: "revisao",
      postId: post.id,
      postTitle: post.title,
    });
    const parsed = parseReviewOutput(reviewed);
    if (!parsed.article.trim()) throw new Error("A IA não retornou o artigo revisado");
    ws = { ...ws, sections, article, manual: false, published: parsed.article };
    await savePost(post.id, serializeWorkspace(ws), "artigo_completo");
    if (runId) await patchRun(runId, { article_at: nowISO(), state: "concluido", error: null });
    return "done";
  }

  await savePost(post.id, serializeWorkspace({ ...ws, sections, article }), "artigo_completo");
  if (runId) await patchRun(runId, { article_at: nowISO(), state: "concluido", error: null });
  return "done";
}

export interface PostProgress {
  postId: string;
  status: Post["status"];
  hasRaw: boolean;
  sections: number;
  sectionsDone: number;
  hasArticle: boolean;
  hasPublished: boolean;
}

/** Progresso de cada postagem para a linha do tempo do Agendador. */
export async function readProgress(postIds: string[]): Promise<PostProgress[]> {
  if (postIds.length === 0) return [];
  const { data, error } = await supabase
    .from("posts")
    .select("id,content,status")
    .in("id", postIds);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; content: string; status: string }[]).map((row) => {
    const ws = parseWorkspace(row.content ?? "");
    return {
      postId: row.id,
      status: row.status as Post["status"],
      hasRaw: ws.raw.trim() !== "",
      sections: ws.sections.length,
      sectionsDone: ws.sections.filter((s) => s.response.trim() !== "").length,
      hasArticle: ws.article.trim() !== "",
      hasPublished: ws.published.trim() !== "",
    };
  });
}

export interface PipelineResult {
  done: boolean;
  steps: number;
}

/** Roda o ciclo de um artigo em passos, dentro do orçamento de tempo da invocação. */
export async function runPipeline(postId: string, runId?: string): Promise<PipelineResult> {
  const deadline = Date.now() + BUDGET_MS;
  let steps = 0;
  while (Date.now() < deadline) {
    const r = await stepOnce(postId, runId);
    steps += 1;
    if (r === "done") return { done: true, steps };
  }
  return { done: false, steps };
}

export interface RunResult {
  ok: boolean;
  message: string;
  postId?: string;
}

/** Escolhe o próximo registro: retoma o que está em execução, senão o primeiro pendente. */
function pickNext(runs: SchedulerRunRow[]): SchedulerRunRow | undefined {
  const ordered = [...runs].sort((a, b) => a.position - b.position);
  return (
    ordered.find((r) => r.state === "executando") ?? ordered.find((r) => r.state === "pendente")
  );
}

/**
 * Uma invocação avança quantas etapas couberem no orçamento de tempo e devolve o
 * controle; o cron (a cada minuto) retoma exatamente de onde parou.
 */
export async function runScheduler(dateISO = todayInSP()): Promise<RunResult> {
  if (!(await acquireLock())) return { ok: true, message: "Outra execução em andamento" };

  const deadline = Date.now() + BUDGET_MS;
  let steps = 0;
  let lastTitle = "";

  try {
    const initial = await ensureRuns(dateISO);
    if (initial.length === 0) return { ok: true, message: "Nenhum artigo planejado para hoje" };

    while (Date.now() < deadline) {
      const runs = await listRuns(dateISO);
      const current = pickNext(runs);
      if (!current)
        return {
          ok: true,
          message: steps
            ? `${steps} etapa(s) executada(s) — fila do dia concluída`
            : "Fila do dia concluída",
        };

      // Travado sem progresso por mais que o limite: marca falha e segue.
      if (current.state === "executando") {
        const idle = Date.now() - new Date(current.updated_at).getTime();
        if (idle > STEP_TIMEOUT_MIN * 60_000) {
          await patchRun(current.id, {
            state: "falhou",
            error: `Excedeu ${STEP_TIMEOUT_MIN} minutos sem progresso`,
          });
          continue;
        }
      } else {
        await patchRun(current.id, {
          state: "executando",
          started_at: current.started_at ?? nowISO(),
          error: null,
        });
      }

      try {
        const r = await stepOnce(current.post_id, current.id);
        steps += 1;
        lastTitle = current.post_title;
        if (r === "done") continue;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Falha desconhecida";
        await patchRun(current.id, { state: "falhou", error: message });
        return { ok: false, message: `${current.post_title}: ${message}`, postId: current.post_id };
      }
    }

    return {
      ok: true,
      message: steps
        ? `${steps} etapa(s) executada(s) — última: "${lastTitle}"`
        : "Sem tempo para novas etapas nesta execução",
    };
  } finally {
    await releaseLock();
  }
}

