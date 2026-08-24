# Guia de conexão WordPress na tela Conexões

Adicionar um passo-a-passo visual dentro da página **Conexões**, para que cada blog possa ser conectado sem sair do sistema.

## O que será adicionado

### 1. Card "Como conectar um blog" (topo da página)
Um painel recolhível (aberto por padrão enquanto não houver nenhuma conexão) com os passos numerados:

1. Abrir o `wp-admin` do blog como Administrador — com botão direto para o painel do blog selecionado.
2. Conferir requisitos: WordPress 5.6+, site em HTTPS e permalinks amigáveis.
3. Ir em **Usuários → Perfil → Senhas de aplicativo** (link direto para `/wp-admin/profile.php#application-passwords`).
4. Criar a senha com o nome `PostFlow` e copiar o valor gerado (aparece só uma vez).
5. Copiar o **login** do usuário (não o e-mail).
6. Voltar ao PostFlow, clicar em **Nova conexão**, escolher o blog, colar usuário e senha.
7. Clicar em **Testar conexão** e salvar.

Inclui um bloco de solução de problemas: seção de senhas de aplicativo ausente (HTTP/plugin de segurança bloqueando `/wp-json/`), `rest_no_route` (permalinks), credenciais inválidas, usuário sem permissão de publicar.

### 2. Lista de progresso por blog
Abaixo do guia, uma grade compacta com todos os blogs cadastrados mostrando:
- Nome do blog + status (Conectado / Erro / Não testado / Sem conexão).
- Botão **Abrir senhas de aplicativo** (link para `profile.php#application-passwords` do site).
- Botão **Conectar** que já abre o modal de nova conexão com aquele blog pré-selecionado.

Assim dá para percorrer os 10 blogs em sequência e ver o que falta.

### 3. Ajudas dentro do modal
- Mini-lembrete no modal com link "abrir senhas de aplicativo neste site" (aparece após escolher o blog).
- Texto de apoio no campo Application Password explicando que espaços podem ser mantidos.

## Detalhes técnicos

- Arquivo alterado: `src/routes/conexoes.tsx` (apenas apresentação).
- Novo componente local `SetupGuide` + `BlogChecklist` no mesmo arquivo, usando os componentes existentes (`surface`, `Button`, `StatusPill`) e ícones Lucide.
- Estado de recolher/expandir do guia via `useState`, com persistência simples em `localStorage` (`postflow.wpGuide.open`).
- Links do wp-admin gerados a partir da URL normalizada do blog (mesmo helper já usado hoje para `/wp-admin`).
- `startCreate` passa a aceitar um `blogId` opcional para pré-selecionar o blog vindo da checklist.
- Sem mudanças em banco, server functions ou lógica de publicação.
