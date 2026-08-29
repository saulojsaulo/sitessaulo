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
- Cuidado especial com perguntas que começam sem o verbo "ser": escreva "É possível fazer X?" e nunca "possível fazer X?". Releia mentalmente cada pergunta de FAQ antes de finalizar para garantir que é uma frase completa e gramaticalmente correta.
- Preste atenção à ortografia de palavras parecidas: "seção" é uma parte do texto e "sessão" é uma reunião/encontro — nunca troque uma pela outra. O mesmo vale para pares como "a fim/afim" e "mas/mais".
- Nunca afirme uma convenção, padrão de nomenclatura ou regra de negócio (ex: "a razão social segue o padrão NOME – MEI") como fato oficial se não tiver certeza de que existe assim. Descreva o conceito sem inventar o formato exato, ou apresente como exemplo explicitamente hipotético.
- Coerência factual é obrigatória: nunca contradiga um fato, prazo, valor ou descrição de processo que já foi afirmado antes no mesmo artigo (ex: se algo foi descrito como "gerado em tempo real", não fale depois de um prazo de dias para o mesmo evento).
- Nunca inclua conteúdo, exemplos ou recomendações de ferramentas/temas que não tenham relação direta e específica com o título do artigo. Se não tiver certeza da relevância, prefira aprofundar o tema principal em vez de generalizar.
- Não trate de temas sensíveis para monetização (saúde grave/diagnóstico médico, conteúdo adulto, apostas, armas, discurso de ódio, finanças de risco sem disclaimer) mesmo que tangenciais ao tema.
- NUNCA invente estatísticas, percentuais, "estudos internos", pesquisas, casos reais com nomes de empresas/instituições fictícias, ou códigos/padrões/normas técnicas apresentados como se fossem oficiais (ex: tabelas de códigos numéricos, fórmulas, classificações) sem ter certeza de que existem de fato. Se quiser ilustrar com um número, código ou cenário, deixe claro que é um exemplo hipotético (ex: "imagine um contrato com...", "num cenário comum de...", "suponha que o código exibido seja..."), nunca atribua a uma fonte, estudo, empresa ou padrão oficial que você não pode confirmar que existe.
- Cuidado redobrado com fatos sensíveis ao tempo: regras, produtos, taxas, prazos ou serviços (especialmente em temas financeiros, tributários, jurídicos ou regulados) podem ter mudado ou sido descontinuados depois do seu treinamento. Ao mencionar algo desse tipo, prefira formulações que não dependam de estar 100% atual (descreva o conceito sem afirmar categoricamente que ainda está em vigor) ou sinalize que a informação deve ser confirmada em fonte oficial antes da publicação.
- O título de cada seção (o texto que vem depois de "##") deve ser um título editorial natural sobre o assunto. Nunca descreva ali a instrução que gerou a seção (ex: nunca escreva algo como "Conclusão curta sobre..." ou "Resumo dos pontos discutidos acima") — escreva como um título de artigo de verdade.
- Respeite a hierarquia de headings: nunca use "###" (H3) sem que exista um "##" (H2) pai antes dele. A introdução também precisa de um "##" próprio.
- Responda sempre em português do Brasil, sem comentários extras, apenas o conteúdo pedido.`;


/** Regras extras aplicadas quando o modelo tem busca web real (ex.: groq/compound). */
export const WEB_SEARCH_SYSTEM_ADDENDUM = `

Você tem acesso a busca na web. Use-a sempre que for incluir uma estatística, percentual, resultado de pesquisa, dado técnico específico (ex: comportamento de uma função, atalho de um software, limite de uma ferramenta) ou qualquer afirmação que dependa de uma fonte externa para ser verdadeira.

Regras para uso da busca:
- Se encontrar um dado real e relevante, cite a informação de forma natural no texto, em português, sem colar trechos longos da fonte (parafraseie).
- Se a busca não retornar nada relevante ou confiável, NÃO invente um número, estudo ou fonte no lugar. Nesse caso, escreva a ideia de forma qualitativa (sem número específico) ou como exemplo claramente hipotético.
- Nunca atribua um dado a uma empresa, escritório ou instituição fictícia. Se não pesquisou uma fonte real para aquele dado específico, não cite fonte nenhuma.
- Responda apenas com o conteúdo final pedido, sem descrever buscas feitas, links de referência em bloco ou notas de processo.`;

/** Regra extra no prompt de seção quando há busca web disponível. */
export const WEB_SEARCH_SECTION_ADDENDUM = `

Antes de afirmar qualquer número, estatística ou resultado de pesquisa nesta seção, pesquise na web para confirmar. Se não encontrar uma fonte real e relevante, não inclua a afirmação como fato — reformule como exemplo hipotético ou remova o número.`;

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
- A primeira seção deve ser uma introdução direta ao problema que o leitor tem (evite introduções genéricas tipo "Neste artigo vamos...") e também deve ter um título numerado "1" (H2) — nunca subtítulos "###" soltos sem um "##" pai.
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
  previousText = "",
): string {
  const tool = ctx.tool?.trim();
  const toolRule = tool
    ? `\n- Se fizer sentido natural para esta seção específica, você pode mencionar a ferramenta ${tool} do site como exemplo prático — mas apenas se for genuinamente relevante ao subtítulo, no máximo uma vez no artigo inteiro.`
    : "";

  const previousBlock = previousText.trim()
    ? `\nTexto já gerado das seções anteriores (leia com atenção: não contradiga nenhum fato, prazo, valor ou processo já descrito, e não repita o que já foi dito):\n${previousText.trim()}\n`
    : "";

  return `Você está escrevendo uma seção de um artigo maior sobre "${title}".

Resumo do artigo completo (para você manter coerência de tema e não repetir o que já foi dito em outras seções):
${outlineSummary || "(resumo indisponível — mantenha-se estritamente no tema do título)"}
${previousBlock}
Agora gere o texto apenas da seção abaixo, seguindo à risca o escopo do tema do artigo. Adicione "##" antes do título da seção e "###" antes de cada subtítulo:

${sectionPrompt}

Regras de formatação: logo após o título (##), escreva um parágrafo introdutório curto (2 a 4 frases) apresentando o assunto do título antes de iniciar qualquer subtítulo (###). Só depois desenvolva os subtítulos. Nunca use "###" sem que o "##" da seção venha antes.

Lembre-se:
- Fique 100% dentro do tema "${title}". Não mencione ferramentas, exemplos ou dicas de assuntos não relacionados (ex: marketing digital genérico, automação de vendas), a menos que a seção seja literalmente sobre isso.
- Não repita ideias já cobertas em outras seções do resumo acima.${toolRule}
- Não contradiga nenhum fato, prazo ou descrição de processo já afirmado no texto das seções anteriores.
- Evite afirmar prazos, percentuais, padrões de nomenclatura ou regras de processo muito específicos como se fossem garantidos ("normalmente até 30 dias", "o sistema concatena X com Y", "a razão social segue o padrão NOME – MEI"), a menos que tenha certeza — prefira formulações cautelosas ("costuma", "pode variar conforme o órgão ou a instituição").
- Não invente estatísticas, estudos, pesquisas, "casos reais" de empresas nem códigos/padrões técnicos apresentados como oficiais. Use apenas exemplos claramente hipotéticos.
- Se mencionar regras, produtos, taxas, prazos ou serviços que podem ter mudado (temas financeiros, tributários, jurídicos ou regulados), não afirme categoricamente que continuam vigentes — descreva o conceito de forma atemporal.
- Mantenha os exemplos ilustrativos internamente consistentes (nomes e gênero gramatical coerentes, valores que fecham nas contas, datas coerentes entre si).
- Se a seção tiver FAQ, garanta que cada pergunta é uma frase completa (ex: "É possível...", "É necessário...", nunca "possível...").
- Escreva "seção" ao se referir a uma parte do texto (nunca "sessão").
- O título depois de "##" deve ser editorial e natural; nunca ecoe a instrução recebida (ex: "Conclusão curta sobre...").
- Não adicione dicas de SEO, comentários sobre o processo ou qualquer texto fora do conteúdo do artigo.`;
}

/** Número mínimo de palavras exigido no artigo após a revisão de coesão. */
export const MIN_ARTICLE_WORDS = 2000;

export const countWords = (text: string) =>
  text
    .replace(/<[^>]*>/g, " ")
    .replace(/[#*`>|_-]+/g, " ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export function buildCohesionPrompt(title: string, article: string): string {
  return `Abaixo está um artigo completo sobre "${title}", montado a partir de seções geradas separadamente. Revise-o para:

1. Remover qualquer frase repetida de abertura de seção (ex: variações de "Nesta seção, vamos...").
2. Identificar e sinalizar qualquer trecho fora do escopo do tema "${title}" (se encontrar, substitua por conteúdo relevante ao tema, mantendo o tamanho da seção).
3. Garantir transições naturais entre seções, sem repetir a mesma estrutura de frase mais de duas vezes no artigo inteiro.
4. Corrigir qualquer erro de gramática, concordância, ortografia ou frase incompleta/quebrada (ex: uma pergunta ou frase que começa faltando um verbo ou sujeito).
5. Localizar qualquer estatística, percentual, "estudo", "pesquisa", "caso real" ou código/padrão técnico apresentado como oficial, com fonte não verificável. Se a fonte não for verificável ou parecer inventada, reescreva o trecho como exemplo claramente hipotético (ex: "imagine um cenário em que...") ao invés de apresentá-lo como fato ocorrido.
6. Verificar se algum título de seção descreve a própria instrução que o gerou (ex: "Conclusão curta sobre...", "Resumo dos pontos discutidos"). Se encontrar, reescreva como um título editorial natural.
7. Confirmar que a introdução (antes da primeira seção numerada) não tem "###" solto sem um "##" pai correspondente.
8. Revisar a consistência interna dos exemplos ilustrativos (nomes, gênero gramatical, valores que devem bater com contas simples, datas coerentes entre si). Corrija qualquer detalhe que não faça sentido lógico dentro do próprio exemplo.
9. Sinalizar qualquer afirmação sobre regras, produtos, taxas, prazos ou serviços (especialmente financeiros, tributários, jurídicos ou regulados) que dependa de estar atualizada — especialmente se o artigo tratar algo como "atual" ou "padrão" sem qualificar. Adicione um comentário <!-- VERIFICAR: [trecho] --> logo antes dessas frases para revisão humana antes de publicar, sem alterar o texto visível.
10. Procurar contradições factuais entre seções diferentes (ex: uma seção diz que algo acontece "em tempo real" e outra menciona um prazo de dias para o mesmo evento). Se encontrar, ajuste a seção mais tardia para ficar consistente com a primeira, ou marque com <!-- VERIFICAR: contradição sobre [assunto] entre a seção X e a seção Y -->.
11. Verificar especificamente se cada pergunta do FAQ é uma frase completa e gramaticalmente correta — atenção redobrada em perguntas que deveriam começar com "É" (ex: "É possível registrar...", "É necessário...") e que às vezes saem sem o verbo ("possível registrar..."). Corrija todas.
12. Corrigir confusões ortográficas entre palavras parecidas — em especial "seção" (parte do texto) usado como "sessão" (reunião). Frases como "Nesta sessão, respondemos..." devem virar "Nesta seção...", e ainda melhor, ser reescritas sem abertura genérica.
13. Localizar convenções, padrões de nomenclatura ou regras de negócio afirmadas como oficiais (ex: "a razão social do MEI segue o padrão NOME – MEI"). Se não forem verificáveis, reescreva de forma cautelosa ou marque com <!-- VERIFICAR: [trecho] -->.
14. Manter toda a formatação Markdown original (## e ###) e não adicionar nem remover seções.

REQUISITO DE TAMANHO (obrigatório): o artigo revisado deve ter NO MÍNIMO ${MIN_ARTICLE_WORDS} palavras. O texto atual tem aproximadamente ${countWords(article)} palavras. Se estiver abaixo disso, aprofunde o conteúdo das seções existentes com explicações mais detalhadas, passos concretos e exemplos hipotéticos relevantes ao tema — sem criar novas seções, sem repetir ideias e sem enrolação.

Artigo completo:
${article}

Responda apenas com o artigo revisado em Markdown.`;
}

/** Segunda passada: pede expansão quando a revisão voltou curta. */
export function buildExpansionPrompt(title: string, article: string): string {
  return `O artigo abaixo, sobre "${title}", tem apenas ${countWords(article)} palavras e precisa de no mínimo ${MIN_ARTICLE_WORDS}.

Reescreva-o mais completo, aprofundando cada seção existente com detalhamento prático, passos, nuances e exemplos hipotéticos relevantes ao tema. Não crie nem remova seções, não repita ideias, não adicione enrolação nem comentários sobre o processo, e mantenha toda a formatação Markdown (## e ###) e a hierarquia de headings.

Artigo:
${article}

Responda apenas com o artigo final em Markdown, com ${MIN_ARTICLE_WORDS} palavras ou mais.`;
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
