# PostFlow — o que foi melhorado

Verificado: `tsc` sem erros, `vite build` ok, e teste direto do servidor compilado
(HTML, 404 e rota de cron). **Não** foi testado contra o seu Supabase real nem visualmente
em um navegador.

## O que você precisa fazer (2 passos)

1. **Rodar `supabase-melhorias.sql`** no SQL Editor do Supabase (seguro rodar mais de uma vez).
   Corrige o registro de uso de IA e cria índices.
2. **Para o agendador automático (03:00) funcionar:**
   - definir a secret `CRON_SECRET` no servidor (um valor longo e aleatório);
   - criar o cron no Supabase com o bloco comentado em `supabase-schema.sql`
     (já atualizado, usando o mesmo valor no header `Authorization`).

## Layout / experiência

| Mudança | Arquivo |
| --- | --- |
| Menu agrupado (Conteúdo / Produção / Resultados / Configurações) em vez de 9 itens soltos | `app-shell.tsx` |
| "Agendador" e "Agendadas" confundiam: agora **Agendador (IA)** e **Fila WordPress** | `app-shell.tsx`, `agendador.tsx`, `agendadas.tsx` |
| Selo vermelho no menu com o nº de publicações WordPress que falharam | `app-shell.tsx` |
| Cabeçalho mostra a página atual e o blog ativo (antes: texto fixo) | `app-shell.tsx` |
| Item do menu ativo também em sub-rotas | `app-shell.tsx` |
| Link "Pular para o conteúdo" (acessibilidade/teclado) | `app-shell.tsx` |
| Bloco **"Precisa de atenção"** no dashboard: falhas de publicação, conexões com erro, artigos prontos para publicar, artigos aguardando revisão | `routes/index.tsx` |
| Cartões do dashboard agora são links (Publicadas já abre filtrada) | `routes/index.tsx` |
| "Postagens por status" virou **Funil de produção** com os 7 estágios (antes omitia 2) | `routes/index.tsx` |
| **Bug:** miniaturas das postagens recentes nunca apareciam (a capa não é carregada na carga inicial); agora são buscadas sob demanda | `routes/index.tsx` |
| Sem "flash" branco ao abrir no modo escuro; o `ThemeProvider` também sobrescrevia a preferência salva na montagem | `__root.tsx`, `theme.tsx` |
| `lang="pt-BR"`; telas de 404 e erro em português | `__root.tsx`, `error-page.ts` |

## Processos / robustez

| Problema | Correção | Arquivo |
| --- | --- | --- |
| **O cron apontava para `/api/public/scheduler/run`, que não existia.** O agendamento automático não tinha como rodar | Rota criada, protegida por `CRON_SECRET`; fecha por padrão (503) se o segredo não estiver configurado | `routes/api/public/scheduler/run.ts` |
| Trava do agendador era "ler e depois gravar": duas execuções simultâneas podiam passar | Trava atômica (UPDATE condicional + INSERT com chave única) | `scheduler.server.ts` |
| Cada etapa do pipeline baixava **todas** as postagens com conteúdo completo | Carrega só a postagem e o blog da etapa | `scheduler.server.ts` |
| Se um salvamento falhava, a tela mostrava a mudança como feita e o erro ia só pro console | Aviso na tela + recarga do banco para não exibir dado não salvo | `store.tsx` |
| `ai_usage.post_id` era `uuid`, mas os IDs das postagens são texto: o consumo de IA de várias postagens não era registrado | Migração SQL + fallback no código para nunca perder o registro | `supabase-melhorias.sql`, `ai-usage.server.ts` |
| IDs novos usavam `Math.random()` | `crypto.randomUUID()` | `store.tsx` |
| Lint: `prefer-const` e dependências de `useMemo` | Corrigidos | `content-workspace.ts`, `posts-page.tsx`, `ai-usage-panel.tsx` |

## Redesenho de layout (segunda rodada)

| Mudança | Onde |
| --- | --- |
| Tela de Analytics refeita: cartões com superfície própria (as classes `tech-card`/`animate-tech-in` não existiam no CSS), variações com cor correta (rejeição menor = verde), taxas em pontos percentuais, mini-gráficos, tempo real mais limpo, barra de filtros com intervalo de datas | `analytics.tsx`, `metric-bits.tsx` |
| Barra lateral **recolhível em modo ícones**, com dicas ao passar o mouse | `app-shell.tsx` |
| **Paleta de comandos** (Ctrl/⌘ + K): ir para qualquer página, trocar de blog, nova postagem, alternar tema | `app-shell.tsx` |
| Botão **Nova postagem** sempre visível no cabeçalho (abre o editor via `/postagens?novo=1`) | `app-shell.tsx`, `posts-page.tsx` |
| Cabeçalho com trilha "Grupo / Página", busca e blog ativo | `app-shell.tsx` |
| Transição suave entre páginas (respeita "reduzir movimento" do sistema) | `app-shell.tsx`, `styles.css` |
| **Tons semânticos** (`tone-success/warning/cyan/danger/primary/pink`) com contraste legível em claro e escuro; aplicados em status, tags, variações, avisos de Conexões, Fila, Workspace e uso de IA | `styles.css`, `ui-bits.tsx` e demais |
| `PageHeader` e `EmptyState` mais sóbrios (título em peso semibold, divisor, estado vazio sem pulso) | `ui-bits.tsx` |
| Rolagem fina, cor de seleção de texto e `prefers-reduced-motion` | `styles.css` |

## Receita de anúncios — Adsterra (Analytics → aba "Receita (Adsterra)")

Nova aba em `/analytics` (link direto: `/analytics?aba=receita`; também na paleta Ctrl+K).

**Para ativar:** defina a variável de ambiente `ADSTERRA_API_KEY` no servidor (mesmo lugar de `OPENAI_API_KEY`).
O token **não está no código** e nunca vai ao navegador. Sem ele, a aba mostra um passo a passo de configuração.

| Recurso | Detalhe |
| --- | --- |
| Métricas | Receita (US$), impressões, cliques, CTR e CPM, cada um comparado ao período imediatamente anterior |
| Filtros | Hoje, Ontem, 7/14/30 dias, Este mês · todos os sites ou um site específico |
| Gráfico diário | Alternável entre receita, impressões, cliques e CPM (dias sem dado entram como zero) |
| Placements | Tabela com impressões, cliques, CTR, CPM e receita (+ participação), com nome do placement e do site |
| Países | Maiores origens de receita |
| Atualização | Automática a cada 60 s (a Adsterra guarda cada resposta por 60 s, então mais rápido não traz dado novo), com contagem regressiva, chave "Ao vivo" e botão "Atualizar" |
| Robustez | Cache de 55 s no servidor, no máximo 3 consultas de estatística simultâneas (limite da Adsterra: 5), nova tentativa em 429, mensagens claras para 401/403/404/429, blocos opcionais que falham viram aviso sem derrubar o painel |
| Cálculo | CTR e CPM são recalculados a partir dos totais (somar razões diárias daria resultado errado) |

Arquivos: `adsterra.server.ts`, `adsterra.functions.ts`, `adsterra-types.ts`, `use-adsterra.ts`,
`adsterra-panel.tsx`, `analytics-bits.tsx` (componentes compartilhados extraídos de `analytics.tsx`).

**Limites desta entrega:** o formato exato do JSON da Adsterra não estava na documentação pública acessível e o ambiente
de desenvolvimento não alcança `api3.adsterratools.com`, então a leitura é tolerante a variações de nome de campo e foi
testada com respostas simuladas. Se algum número vier estranho, abra "Diagnóstico da resposta" no fim da aba e me envie.
As datas são enviadas à Adsterra em UTC.

**Segurança:** o token foi colado no chat; depois de configurá-lo no servidor, gere um novo na Adsterra
(Settings → API → Generate new token) e atualize a variável. Lembre também que, sem login no app (risco crítico abaixo),
qualquer pessoa com a URL consegue chamar essa consulta e ver a sua receita.

### Card "Conversão para real" (dentro da aba Receita)

Fica ao lado do gráfico diário (empilha no celular) e acompanha o período e o site selecionados.
O cartão "Receita" também mostra a estimativa em reais ("≈ R$ …").

| Item | Detalhe |
| --- | --- |
| Receita em reais | Receita do período × cotação de **compra** (o que o mercado paga por 1 US$), mais o CPM médio em reais |
| Dólar agora | Cotação, variação do dia (%), venda, máxima e mínima |
| Simulador | Digite qualquer valor em US$ (aceita `1.234,56` e `1234.56`) e veja em R$; atalhos de US$ 10/100/1.000 |
| Referência oficial | PTAX do Banco Central (último fechamento) |
| Atualização | A cada 60 s junto com a chave "Ao vivo" |
| Fontes | **Principal:** AwesomeAPI (dólar comercial, sem chave). **Reserva:** PTAX do BCB; se a principal cair, o card segue com a PTAX e avisa |
| Proteções | Cache de 30 s no servidor; valores fora de R$ 0,50–100 são descartados como dado corrompido; aviso quando a última cotação tem mais de 2 h (mercado fechado) |

Opcional: `AWESOMEAPI_KEY` (chave gratuita) para cotação em tempo real sem cache. Sem ela tudo funciona.

Arquivos: `fx.server.ts`, `fx.functions.ts`, `fx-types.ts`, `fx-format.ts`, `use-fx.ts`, `fx-card.tsx`.

**Limite:** é uma cotação de referência. O valor que cai na sua conta depende do câmbio e das tarifas do banco ou
meio de pagamento (isso aparece também no rodapé do card). Testado com respostas simuladas das duas APIs; não consegui
chamar as APIs reais a partir do ambiente de desenvolvimento.

## ⚠️ Risco crítico que NÃO alterei (precisa de decisão sua)

**Se o banco está como em `supabase-schema.sql`, qualquer pessoa com a URL do app tem acesso total.**

- As tabelas têm política `using (true)` para `anon`, e a chave publishable está no código do navegador.
- `wp_connections` guarda a **Application Password de cada WordPress em texto puro**, legível por essa chave.
- As server functions (`publishWpPost`, `generateText`, `runPostPipeline`…) não exigem login: dá para publicar/apagar nos 10 blogs e gastar créditos da OpenAI.

Só o módulo "Afiliados ML" tem login. Não corrigi às cegas porque trancar o banco sem poder testar contra o seu Supabase pode derrubar o app inteiro (o servidor hoje também usa a chave `anon`).

**Plano sugerido:**

1. Exigir login em todo o app (Supabase Auth; reaproveitar o padrão `ml_admins`).
2. Trocar as políticas por `to authenticated using (ml_is_admin())` e revogar `anon`.
3. Servidor usar a `service_role` (secret), não a publishable.
4. Middleware nas server functions validando a sessão.
5. Nunca enviar `app_password` ao navegador (ler só no servidor; idealmente criptografar).
6. `/api/public/wp-sync` continua por `site_key` via RPC.

## Observado, mas deixado como está

- Capas de postagens em **base64 dentro da tabela** `posts`: pesado; o ideal é Supabase Storage.
- `generateWithGemini` e os planos em `.lovable/` falam de Gemini, mas o código usa OpenAI.
- `README.md` é só o prompt original.
- ~350 avisos de formatação do Prettier em arquivos que não alterei: `npm run format` resolve (só estilo).
