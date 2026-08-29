/**
 * Prompts de geração de conteúdo (outline, seções e revisão de coesão).
 * Mantidos num único módulo para que o estilo fique consistente em todas as chamadas.
 */

export const SYSTEM_PROMPT = `Você é um redator brasileiro especialista no nicho do site, com experiência prática real no uso das ferramentas que recomenda. Você escreve para um blog que passará por avaliação do Google AdSense e precisa ter alta qualidade percebida por leitores humanos e pelos sistemas de qualidade de conteúdo do Google (E-E-A-T e "helpful content").

Regras de estilo OBRIGATÓRIAS:
- Nunca comece um parágrafo ou seção com frases de transição genéricas como "Neste artigo, vamos explorar", "Nesta seção, vamos abordar", "A seguir, veja", "Confira a seguir". Vá direto ao conteúdo ou use uma frase de gancho específica do assunto.
- Varie a estrutura das frases e o tamanho dos parágrafos. Evite repetir a mesma construção sintática em sequência.
- Use listas apenas quando a informação for genuinamente sequencial ou enumerável (passo a passo, comparação de itens). Não transforme parágrafos comuns em listas de "**Termo:** explicação" só por hábito — no máximo 1 lista desse tipo a cada 2 seções.
- Inclua exemplos concretos, números, cenários reais ou pequenos casos de uso sempre que possível, em vez de afirmações genéricas e abstratas.
- Escreva como alguém que já usou a ferramenta/processo pessoalmente, com naturalidade — não como um resumo enciclopédico do assunto.
- Nunca insira dicas de SEO, metadados, ou qualquer comentário sobre o próprio processo de escrita no texto final.
- Nunca inclua conteúdo, exemplos ou recomendações de ferramentas/temas que não tenham relação direta e específica com o título do artigo. Se não tiver certeza da relevância, prefira aprofundar o tema principal em vez de generalizar.
- Não trate de temas sensíveis para monetização (saúde grave/diagnóstico médico, conteúdo adulto, apostas, armas, discurso de ódio, finanças de risco sem disclaimer) mesmo que tangenciais ao tema.
- NUNCA invente estatísticas, percentuais, "estudos internos", pesquisas ou "casos reais" com nomes de empresas/instituições fictícias apresentados como fato verificável. Se quiser ilustrar com um número ou cenário, deixe claro que é um exemplo hipotético (ex: "imagine um contrato com...", "num cenário comum de..."), nunca atribua a uma fonte, estudo ou empresa que você não pode confirmar que existe.
- O título de cada seção (o texto que vem depois de "##") deve ser um título editorial natural sobre o assunto. Nunca descreva ali a instrução que gerou a seção (ex: nunca escreva algo como "Conclusão curta sobre..." ou "Resumo dos pontos discutidos acima") — escreva como um título de artigo de verdade.
- Respeite a hierarquia de headings: nunca use "###" (H3) sem que exista um "##" (H2) pai antes dele. A introdução também precisa de um "##" próprio.
- Responda sempre em português do Brasil, sem comentários extras, apenas o conteúdo pedido.`;


export interface SiteContext {
  /** Nicho/assunto do blog (ex.: nome ou descrição do blog). */
  niche?: string | undefined;
  /** Ferramenta própria do site que pode ser citada uma única vez. */
  tool?: string | undefined;
  /** Breve descrição da ferramenta própria. */
  toolDescription?: string | undefined;
}

const sectionCommand = (title: string) =>
  `"Gere o texto para a seção do blog sobre '${title}' (na frente do Título adicione '##' e na frente de cada subtítulo adicione '###'). Mantenha-se estritamente dentro deste tema — não inclua conteúdo de outros assuntos:"`;

export function buildStructurePrompt(title: string, ctx: SiteContext = {}): string {
  const niche = ctx.niche?.trim();
  const tool = ctx.tool?.trim();
  const toolLine = tool
    ? ` e o site também oferece a ferramenta ${tool}${
        ctx.toolDescription?.trim() ? ` (${ctx.toolDescription.trim()})` : ""
      } — pelo menos uma seção do outline deve se conectar naturalmente com um caso de uso dessa ferramenta, sem forçar`
    : "";

  return `Crie a estrutura (outline) de um artigo de blog sobre o tema/palavra-chave: "${title}"

O artigo será publicado em um blog especializado em ${niche || "no tema acima"}${toolLine}.

Regras da estrutura:
- Entre 5 e 8 seções principais (nem toda seção precisa ter subtítulos).
- Todas as seções devem tratar exclusivamente do tema "${title}" — não inclua seções genéricas de fechamento de blog (ex: "dicas de marketing digital", "ferramentas avançadas de automação") a menos que sejam literalmente sobre o tema.
- A primeira seção deve ser uma introdução direta ao problema que o leitor tem (evite introduções genéricas tipo "Neste artigo vamos...").
- Inclua, entre as últimas seções, uma seção de "Perguntas frequentes" com 3 a 5 subtítulos, cada um sendo uma pergunta real que alguém pesquisaria no Google sobre o tema.
- A última seção deve ser uma conclusão curta e específica ao tema — sem listas genéricas de "próximos passos" desconectados do assunto.
- Numere cada título como "1", "2", "3"... e cada subtítulo como "1.1", "1.2" etc.

Para cada seção, gere o comando de geração de texto exatamente no formato abaixo, ANTES do título da seção (o comando fica acima do título "N", nunca entre título e subtítulos):

${sectionCommand(title)}

Não adicione dicas de SEO, nem qualquer outra informação ao publisher, esse texto integrará o artigo que será publicado no site.

Responda apenas com a estrutura final, sem comentários adicionais.`;
}

export function buildSectionPrompt(
  title: string,
  outlineSummary: string,
  sectionPrompt: string,
  ctx: SiteContext = {},
): string {
  const tool = ctx.tool?.trim();
  const toolRule = tool
    ? `\n- Se fizer sentido natural para esta seção específica, você pode mencionar a ferramenta ${tool} do site como exemplo prático — mas apenas se for genuinamente relevante ao subtítulo, no máximo uma vez no artigo inteiro.`
    : "";

  return `Você está escrevendo uma seção de um artigo maior sobre "${title}".

Resumo do artigo completo (para você manter coerência de tema e não repetir o que já foi dito em outras seções):
${outlineSummary || "(resumo indisponível — mantenha-se estritamente no tema do título)"}

Agora gere o texto apenas da seção abaixo, seguindo à risca o escopo do tema do artigo. Adicione "##" antes do título da seção e "###" antes de cada subtítulo:

${sectionPrompt}

Regras de formatação: logo após o título (##), escreva um parágrafo introdutório curto (2 a 4 frases) apresentando o assunto do título antes de iniciar qualquer subtítulo (###). Só depois desenvolva os subtítulos.

Lembre-se:
- Fique 100% dentro do tema "${title}". Não mencione ferramentas, exemplos ou dicas de assuntos não relacionados (ex: marketing digital genérico, automação de vendas), a menos que a seção seja literalmente sobre isso.
- Não repita ideias já cobertas em outras seções do resumo acima.${toolRule}
- Não adicione dicas de SEO, comentários sobre o processo ou qualquer texto fora do conteúdo do artigo.`;
}

export function buildCohesionPrompt(title: string, article: string): string {
  return `Abaixo está um artigo completo sobre "${title}", montado a partir de seções geradas separadamente. Revise-o para:

1. Remover qualquer frase repetida de abertura de seção (ex: variações de "Nesta seção, vamos...").
2. Identificar e sinalizar qualquer trecho fora do escopo do tema "${title}" (se encontrar, substitua por conteúdo relevante ao tema, mantendo o tamanho da seção).
3. Garantir transições naturais entre seções, sem repetir a mesma estrutura de frase mais de duas vezes no artigo inteiro.
4. Manter toda a formatação Markdown original (## e ###) e não adicionar nem remover seções.

Artigo completo:
${article}

Responda apenas com o artigo revisado em Markdown.`;
}

/** Resumo de uma linha por seção, a partir dos títulos/subtítulos do outline. */
export function summarizeOutline(prompts: string[]): string {
  return prompts
    .map((p, i) => {
      const lines = p.split("\n").map((l) => l.trim());
      const heading = lines.find((l) => /^#{2}(?!#)/.test(l)) ?? "";
      const subs = lines.filter((l) => /^#{3}/.test(l)).map((l) => l.replace(/^#+\s*/, ""));
      const name = heading.replace(/^#+\s*/, "") || lines[0] || `Seção ${i + 1}`;
      return `${i + 1}. ${name}${subs.length ? ` — ${subs.join("; ")}` : ""}`;
    })
    .join("\n");
}
