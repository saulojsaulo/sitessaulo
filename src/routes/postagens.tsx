import { createFileRoute } from "@tanstack/react-router";
import { PostsPage, validatePostsSearch } from "@/components/posts-page";

export const Route = createFileRoute("/postagens")({
  validateSearch: validatePostsSearch,
  head: () => ({
    meta: [
      { title: "Postagens — PostFlow" },
      {
        name: "description",
        content: "Cadastre postagens com editor rico, tags, capa, status e data de publicação.",
      },
      { property: "og:title", content: "Postagens — PostFlow" },
      {
        property: "og:description",
        content: "Liste, filtre e ordene todas as postagens dos seus blogs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostsRoute,
});

function PostsRoute() {
  return <PostsPage />;
}
