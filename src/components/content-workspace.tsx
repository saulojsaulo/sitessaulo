import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDelete } from "@/components/confirm-delete";
import { QuickPublish } from "@/components/quick-publish";
import { generateText } from "@/lib/ai.functions";
import {
  buildArticle,
  cleanHeadings,
  parseWorkspace,
  serializeWorkspace,
  splitSections,
  type Section,
  type Workspace,
} from "@/lib/content-workspace";
import {
  SYSTEM_PROMPT,
  buildCohesionPrompt,
  buildSectionPrompt,
  summarizeOutline,
} from "@/lib/prompts";

export interface WorkspaceApi {
  /** Substitui o texto da aba "Estrutura Bruta" e navega até ela. */
  setRaw: (text: string) => void;
}

interface Props {
  value: string;
  onChange: (content: string) => void;
  /** Muda quando outra postagem é aberta, para recarregar o estado das abas. */
  resetKey: string;
  /** Dados usados para publicar/agendar o Artigo Pronto no WordPress. */
  postId?: string | null;
  title?: string;
  cover?: string | undefined;
  tags?: string[] | undefined;
  onStatusChange?: (status: "artigo_completo" | "agendado" | "publicado") => void;
  /** Expõe ações do workspace para a tela de edição. */
  onReady?: (api: WorkspaceApi) => void;
}



export async function askGemini(
  prompt: string,
  meta?: { kind?: string; postId?: string | null; postTitle?: string | null },
) {
  const res = await generateText({
    data: {
      prompt,
      system: SYSTEM_PROMPT,
      kind: meta?.kind ?? "outro",
      postId: meta?.postId ?? null,
      postTitle: meta?.postTitle ?? null,
    },
  });
  return res.text;
}



const copy = async (text: string, message: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.error("Não foi possível copiar");
  }
};

export function ContentWorkspace({ value, onChange, resetKey, postId = null, title = "", cover, tags, onStatusChange, onReady }: Props) {
  const [ws, setWs] = useState<Workspace>(() => parseWorkspace(value));
  const [warnings, setWarnings] = useState<string[]>([]);
  const [tab, setTab] = useState("bruta");
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const loadedFor = useRef(resetKey);
  const wsRef = useRef(ws);
  wsRef.current = ws;

  useEffect(() => {
    if (loadedFor.current === resetKey) return;
    loadedFor.current = resetKey;
    setWs(parseWorkspace(value));
    setWarnings([]);
    setTab("bruta");
  }, [resetKey, value]);

  /** Atualiza estado local + campo persistido da postagem. */
  const commit = (next: Workspace) => {
    wsRef.current = next;
    setWs(next);
    onChange(serializeWorkspace(next));
  };

  useEffect(() => {
    onReady?.({
      setRaw: (text: string) => {
        commit({ ...wsRef.current, raw: text });
        setTab("bruta");
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onReady]);

  const rebuilt = useMemo(() => buildArticle(ws.sections), [ws.sections]);
  const article = useMemo(
    () => cleanHeadings(ws.manual ? ws.article : rebuilt),
    [ws.manual, ws.article, rebuilt],
  );

  const process = () => {
    const { sections, warnings: w } = splitSections(ws.raw);
    setWarnings(w);
    if (sections.length === 0) {
      toast.error("Nenhuma sessão encontrada no texto colado");
      return;
    }
    // Preserva respostas já preenchidas para prompts idênticos.
    const previous = new Map(ws.sections.map((s) => [s.prompt.trim(), s.response]));
    const merged = sections.map((s) => ({ ...s, response: previous.get(s.prompt.trim()) ?? "" }));
    commit({ ...ws, sections: merged, article: ws.manual ? ws.article : buildArticle(merged) });
    toast.success(`${merged.length} sessões geradas`);
    setTab("sessoes");
  };

  const updateSection = (id: string, patch: Partial<Section>) => {
    const sections = wsRef.current.sections.map((s) => (s.id === id ? { ...s, ...patch } : s));
    const cur = wsRef.current;
    commit({ ...cur, sections, article: cur.manual ? cur.article : buildArticle(sections) });
  };

  const removeSection = (id: string) => {
    const sections = ws.sections.filter((s) => s.id !== id);
    commit({ ...ws, sections, article: ws.manual ? ws.article : buildArticle(sections) });
    toast.success("Sessão excluída");
  };

  const generateSection = async (id: string) => {
    const section = wsRef.current.sections.find((s) => s.id === id);
    if (!section?.prompt.trim()) return;
    const guidance =
      '\n\nRegras de formatação: logo após o título (##), escreva um parágrafo introdutório curto (2 a 4 frases) apresentando o assunto do título antes de iniciar qualquer subtítulo (###). Só depois desenvolva os subtítulos. Não adicione dicas de SEO nem comentários ao publisher.';
    const text = await askGemini(section.prompt + guidance, {
      kind: "sessao",
      postId,
      postTitle: title,
    });


    if (!text) throw new Error("A IA não retornou conteúdo");
    updateSection(id, { response: text });
  };

  const generateAll = async () => {
    const list = wsRef.current.sections;
    if (list.length === 0) return;
    setBulk({ done: 0, total: list.length });
    let ok = 0;
    for (const [i, s] of list.entries()) {
      try {
        await generateSection(s.id);
        ok += 1;
      } catch (e) {
        toast.error(`Sessão ${i + 1}: ${e instanceof Error ? e.message : "falhou"}`);
      }
      setBulk({ done: i + 1, total: list.length });
    }
    setBulk(null);
    if (ok > 0) toast.success(`${ok}/${list.length} sessões geradas com IA`);
  };

  const filled = ws.sections.filter((s) => s.response.trim() !== "").length;


  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="bruta">Estrutura Bruta</TabsTrigger>
          <TabsTrigger value="sessoes">
            Estruturas Individuais
            {ws.sections.length > 0 ? (
              <span className="ml-1.5 rounded bg-primary/15 px-1.5 text-xs text-primary">
                {filled}/{ws.sections.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="artigo">Artigo Pronto</TabsTrigger>
        </TabsList>
        <Button
          type="button"
          variant="secondary"
          className="gap-2 sm:ml-auto"
          disabled={ws.sections.length === 0 || bulk !== null}
          onClick={() => void generateAll()}
        >
          {bulk ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Gerando {bulk.done}/{bulk.total}…
            </>
          ) : (
            <>
              <Sparkles className="size-4" /> Gerar Todas as Sessões com IA
            </>
          )}
        </Button>
      </div>


      <TabsContent value="bruta" className="mt-3 space-y-3">
        <Textarea
          value={ws.raw}
          onChange={(e) => commit({ ...ws, raw: e.target.value })}
          placeholder={'"Gere o texto para a seção do blog..."\n## 1. Título\n### 1.1 Subtítulo'}
          className="min-h-72 font-mono text-xs"
        />
        {warnings.length > 0 ? (
          <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <ul className="space-y-1">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="gap-2" onClick={process} disabled={!ws.raw.trim()}>
            <Wand2 className="size-4" /> Processar
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => commit({ ...ws, raw: "" })}
            disabled={!ws.raw}
          >
            Limpar
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="sessoes" className="mt-3 space-y-3">
        {ws.sections.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Cole a estrutura na aba “Estrutura Bruta” e clique em Processar.
          </p>
        ) : (
          ws.sections.map((s, i) => (
            <SectionCard
              key={s.id}
              index={i + 1}
              section={s}
              busy={bulk !== null}
              onGenerate={() => generateSection(s.id)}
              onChange={(patch) => updateSection(s.id, patch)}
              onRemove={() => removeSection(s.id)}
            />
          ))

        )}
      </TabsContent>

      <TabsContent value="artigo" className="mt-3 space-y-3">
        <Textarea
          value={article}
          onChange={(e) => commit({ ...ws, article: e.target.value, manual: true })}
          placeholder="O artigo é montado com as respostas das sessões."
          className="min-h-96 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-xs text-muted-foreground">
            {ws.manual ? "Editado manualmente" : "Montado a partir das sessões"} ·{" "}
            {article.trim() ? article.trim().split(/\s+/).length : 0} palavras
          </span>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={() => {
              commit({ ...ws, article: rebuilt, manual: false });
              onStatusChange?.("artigo_completo");
              toast.success("Artigo reconstruído a partir das sessões");
            }}
          >
            <RotateCcw className="size-4" /> Restaurar
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            disabled={!article.trim()}
            onClick={() => void copy(article, "Artigo copiado!")}
          >
            <Copy className="size-4" /> Copiar
          </Button>
          <ConfirmDelete
            trigger={
              <Button type="button" variant="ghost" className="gap-2 text-destructive">
                <Trash2 className="size-4" /> Excluir
              </Button>
            }
            title="Limpar artigo montado?"
            description="O texto final será apagado. As sessões da aba 2 continuam salvas."
            onConfirm={() => commit({ ...ws, article: "", manual: true })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <QuickPublish
            postId={postId}
            title={title}
            article={article}
            cover={cover}
            tags={tags}
            {...(onStatusChange ? { onStatusChange } : {})}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}

function SectionCard({
  index,
  section,
  busy,
  onGenerate,
  onChange,
  onRemove,
}: {
  index: number;
  section: Section;
  busy: boolean;
  onGenerate: () => Promise<void>;
  onChange: (patch: Partial<Section>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(section.prompt);
  const [response, setResponse] = useState(section.response);
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    if (!editing) {
      setPrompt(section.prompt);
      setResponse(section.response);
    }
  }, [editing, section.prompt, section.response]);

  const done = section.response.trim() !== "";

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
          Sessão {index}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
            done
              ? "border-success/30 bg-success/15 text-success"
              : "border-warning/30 bg-warning/15 text-warning"
          }`}
        >
          {done ? <Check className="size-3" /> : <Clock className="size-3" />}
          {done ? "Respondida" : "Pendente"}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={busy || loading || !section.prompt.trim()}
          onClick={() => {
            setLoading(true);
            void onGenerate()
              .then(() => toast.success(`Sessão ${index} gerada com IA`))
              .catch((e: unknown) =>
                toast.error(e instanceof Error ? e.message : "Falha ao gerar com IA"),
              )
              .finally(() => setLoading(false));
          }}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Gerar com IA
        </Button>
        <div className="ml-auto flex items-center gap-1">

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil className="size-3.5" /> Editar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            disabled={!editing}
            onClick={() => {
              onChange({ prompt, response });
              setEditing(false);
              toast.success(`Sessão ${index} salva`);
            }}
          >
            <Save className="size-3.5" /> Salvar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => void copy(section.prompt, `Prompt da sessão ${index} copiado!`)}
          >
            <Copy className="size-3.5" /> Copiar
          </Button>
          <ConfirmDelete
            trigger={
              <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive">
                <Trash2 className="size-3.5" /> Excluir
              </Button>
            }
            title={`Excluir sessão ${index}?`}
            description="A sessão e sua resposta serão removidas do artigo montado."
            onConfirm={onRemove}
          />
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Label className="text-xs">Prompt da sessão</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-28 font-mono text-xs"
          />
          <Label className="text-xs">Resposta gerada</Label>
          <Textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            className="min-h-40 text-sm"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-2.5 font-mono text-xs text-muted-foreground">
            {section.prompt}
          </pre>
          <Label className="text-xs">Resposta gerada</Label>
          <Textarea
            value={section.response}
            onChange={(e) => onChange({ response: e.target.value })}
            placeholder="Cole aqui o texto devolvido pela IA para esta sessão."
            className="min-h-32 text-sm"
          />
        </div>
      )}
    </div>
  );
}
