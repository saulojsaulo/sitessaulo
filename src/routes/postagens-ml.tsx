import { createFileRoute } from "@tanstack/react-router";
import { PostsPage, validatePostsSearch } from "@/components/posts-page";

export const Route = createFileRoute("/postagens-ml")({
  validateSearch: validatePostsSearch,
  head: () => ({
    meta: [
      { title: "Postagens ML — PostFlow" },
      {
        name: "description",
        content: "Artigos com links de afiliado do Mercado Livre e card de produto automático.",
      },
      { property: "og:title", content: "Postagens ML — PostFlow" },
      {
        property: "og:description",
        content: "Crie artigos de afiliado do Mercado Livre com IA e publique no WordPress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostsMlRoute,
});

function PostsMlRoute() {
  return <PostsPage ml />;
}
