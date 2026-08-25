# Painel de Uso de IA

Registrar cada geração feita com o Gemini e mostrar consumo (chamadas, tokens, custo estimado em créditos) dentro do sistema.

## O que você vai ver

- Nova seção **Uso de IA** (dentro de Analytics, como uma aba/bloco no topo).
- Cartões: chamadas hoje, chamadas nos últimos 30 dias, tokens de entrada/saída, custo estimado.
- Gráfico de barras de chamadas por dia (últimos 30 dias).
- Tabela das últimas 50 gerações: data/hora, tipo (Estrutura / Sessão), postagem, tokens, duração, status (ok/erro) e mensagem de erro quando houver.
- Filtro por período (7 / 30 dias) e por tipo de geração.

## Como funciona

Toda geração já passa pelo servidor (`generateWithGemini`). Vamos aproveitar esse ponto único para gravar um registro por chamada, sem mudar nada no fluxo que você usa hoje.

## Detalhes técnicos

1. **Nova tabela `ai_usage`** (SQL para você rodar no Supabase, no mesmo padrão das outras: grants para `anon`/`authenticated`, RLS com policy pública):
   - `id uuid`, `created_at timestamptz`, `kind text` (`estrutura` | `sessao`), `post_id uuid null`, `post_title text null`,
     `model text`, `prompt_tokens int`, `completion_tokens int`, `total_tokens int`, `duration_ms int`,
     `ok boolean`, `error text null`.

2. **Captura de tokens** em `src/lib/ai.server.ts`: a chamada é streaming, então adiciono
   `stream_options: { include_usage: true }` no corpo da requisição e leio o bloco `usage` do último
   evento SSE. Se o provedor não devolver `usage`, faço uma estimativa por caracteres (~4 chars/token)
   e marco o registro como estimado.

3. **Gravação** em `src/lib/ai.server.ts` (ou um `ai-usage.server.ts`), usando o cliente Supabase do
   servidor. A gravação é best-effort: falha ao registrar nunca quebra a geração.

4. **Metadados**: `src/lib/ai.functions.ts` passa a aceitar `kind`, `postId` e `postTitle` no input;
   `content-workspace.tsx` (sessões) e `postagens.tsx` (estrutura) enviam esses campos ao chamar `askGemini`.

5. **Leitura**: nova função de servidor `getAiUsage({ days, kind })` retornando agregados por dia +
   as últimas linhas; consumida com `useQuery` na tela.

6. **Custo estimado**: tabela de preço por milhão de tokens do `google/gemini-3.7-flash` como constante
   no código, convertida em créditos Lovable. Fica rotulado como **estimativa** — os valores oficiais
   continuam no painel de créditos da Lovable.

## Fora do escopo

- Nenhum limite ou bloqueio automático de uso (você pediu para deixar assim por ora).
- Nenhuma mudança no comportamento dos botões de geração.
