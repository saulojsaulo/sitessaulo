/**
 * Estado das 3 abas de conteúdo (Estrutura Bruta / Estruturas Individuais / Artigo Pronto).
 * É serializado dentro do próprio campo `content` da postagem, num comentário
 * invisível no final do texto, para persistir sem alterar o schema do banco.
 */
export interface Section {
  id: string;
  /** Comando + título + subtítulos (o prompt que vai para a IA). */
  prompt: string;
  /** Texto devolvido pela IA e colado pelo usuário. */
  response: string;
}

export interface Workspace {
  raw: string;
  sections: Section[];
  article: string;
  /** true quando o artigo foi editado manualmente e não deve ser recalculado. */
  manual: boolean;
}

const MARKER_START = "<!--PF_WS:";
const MARKER_END = "-->";

export const emptyWorkspace: Workspace = { raw: "", sections: [], article: "", manual: false };

export const newId = () => Math.random().toString(36).slice(2, 10);

export function parseWorkspace(content: string): Workspace {
  const at = content.lastIndexOf(MARKER_START);
  if (at === -1) return { ...emptyWorkspace, article: content, manual: content.trim() !== "" };
  const end = content.indexOf(MARKER_END, at);
  if (end === -1) return { ...emptyWorkspace, article: content, manual: content.trim() !== "" };
  const article = content.slice(0, at).replace(/\s+$/, "");
  try {
    const json = decodeURIComponent(content.slice(at + MARKER_START.length, end));
    const parsed = JSON.parse(json) as Partial<Workspace>;
    return {
      raw: typeof parsed.raw === "string" ? parsed.raw : "",
      sections: Array.isArray(parsed.sections)
        ? parsed.sections.map((s) => ({
            id: s?.id ?? newId(),
            prompt: s?.prompt ?? "",
            response: s?.response ?? "",
          }))
        : [],
      article,
      manual: Boolean(parsed.manual),
    };
  } catch {
    return { ...emptyWorkspace, article, manual: article.trim() !== "" };
  }
}

export function serializeWorkspace(ws: Workspace): string {
  const meta = encodeURIComponent(
    JSON.stringify({ raw: ws.raw, sections: ws.sections, manual: ws.manual }),
  );
  const hasState = ws.raw.trim() !== "" || ws.sections.length > 0 || ws.manual;
  if (!hasState) return ws.article;
  return `${ws.article}\n${MARKER_START}${meta}${MARKER_END}`;
}

/** Linha de comando: entre aspas e começando com "Gere o texto ..." */
const isCommandLine = (line: string) => {
  const t = line.trim();
  if (!t.startsWith('"') && !t.startsWith("“")) return false;
  return /gere\s+o\s+texto/i.test(t);
};

const isTitleLine = (line: string) => /^\s*##(?!#)/.test(line);

export interface ParseResult {
  sections: Section[];
  warnings: string[];
}

/** Divide a estrutura bruta em sessões: comando + título (##) + subtítulos (###). */
export function splitSections(raw: string): ParseResult {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const warnings: string[] = [];
  const blocks: string[][] = [];
  let current: string[] | null = null;
  let preamble: string[] = [];

  for (const line of lines) {
    if (isCommandLine(line)) {
      if (current) blocks.push(current);
      current = [line.trim()];
    } else if (current) {
      current.push(line);
    } else if (line.trim() !== "") {
      preamble.push(line);
    }
  }
  if (current) blocks.push(current);

  if (blocks.length === 0) {
    // Fallback: sem linhas de comando, divide pelos títulos "##".
    let byTitle: string[][] = [];
    let buf: string[] | null = null;
    for (const line of lines) {
      if (isTitleLine(line)) {
        if (buf) byTitle.push(buf);
        buf = [line];
      } else if (buf) {
        buf.push(line);
      }
    }
    if (buf) byTitle.push(buf);
    if (byTitle.length === 0) {
      if (raw.trim() !== "")
        warnings.push(
          'Não encontrei linhas de comando (entre aspas, iniciando com "Gere o texto...") nem títulos com "##". Verifique o texto colado.',
        );
      return { sections: [], warnings };
    }
    warnings.push(
      'Nenhuma linha de comando foi encontrada — dividi as sessões pelos títulos com "##".',
    );
    byTitle = byTitle.map((b) => b);
    return {
      sections: byTitle.map((b) => ({
        id: newId(),
        prompt: b.join("\n").replace(/\s+$/, ""),
        response: "",
      })),
      warnings,
    };
  }

  if (preamble.length > 0)
    warnings.push("Ignorei o texto que aparece antes da primeira linha de comando.");

  const sections = blocks.map((b, i) => {
    if (!b.some(isTitleLine))
      warnings.push(`A sessão ${i + 1} não tem um título com "##" — confira o texto.`);
    return { id: newId(), prompt: b.join("\n").replace(/\s+$/, ""), response: "" };
  });

  return { sections, warnings };
}

export function buildArticle(sections: Section[]): string {
  return sections
    .map((s) => s.response.trim())
    .filter((t) => t !== "")
    .join("\n\n");
}
