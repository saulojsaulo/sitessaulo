# Sites Saulo

Prompt para o Lovable

Crie um sistema de controle de postagens para blogs com as seguintes características:

Funcionalidades principais

Gestão de múltiplos blogs

Permitir cadastrar, editar e excluir vários blogs.

Cada blog deve ter: nome, URL/domínio, descrição curta e um ícone ou logo.

Um seletor (dropdown ou sidebar) para alternar entre os blogs cadastrados.

Gestão de categorias

Cada blog pode ter suas próprias categorias.

CRUD completo de categorias (criar, editar, excluir).

Exibir contagem de postagens por categoria.

Cadastro de postagens

Campos: título, conteúdo (editor de texto rico), categoria (vinculada ao blog selecionado), palavras-chave/tags (múltiplas, com autocomplete), status (rascunho, agendado, publicado), data de publicação.

Upload de imagem de capa da postagem, com preview antes de salvar.

Contador de caracteres/palavras no editor.

Listagem e organização

Tabela ou grid de postagens com filtros por blog, categoria, status e palavra-chave.

Busca por título ou tag.

Ordenação por data, título ou status.

Dashboard

Visão geral com total de blogs, total de postagens, postagens por status e gráfico simples de postagens por categoria.

Requisitos de design (visual moderno e "top")

Layout limpo, com sidebar de navegação (Dashboard, Blogs, Categorias, Postagens).

Paleta de cores moderna com bom contraste (ex.: tons neutros + uma cor de destaque vibrante).

Cards com sombras suaves, cantos arredondados e espaçamento generoso (estilo SaaS moderno).

Modo claro e escuro (dark mode toggle).

Componentes responsivos (funcionando bem em desktop e mobile).

Micro-interações: hover states, transições suaves, feedback visual ao salvar/excluir.

Tipografia moderna e hierarquia visual clara entre títulos, subtítulos e textos.

Uso de ícones consistentes (ex.: Lucide icons) em toda a interface.

Estados vazios (empty states) ilustrados quando não houver blogs/postagens cadastradas.

Extras desejáveis

Miniaturas das imagens de capa na listagem de postagens.

Tags coloridas para palavras-chave.

Badge de status (rascunho, agendado, publicado) com cores diferentes.

Confirmação antes de excluir blogs, categorias ou postagens.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sitessaulo.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/19bb9d45-cf77-409a-821a-23001dc9845c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
