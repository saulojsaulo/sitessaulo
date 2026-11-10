import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { BLOG_COLORS, type Blog, type Category, type Post } from "./types";
import { supabase, type BlogRow, type CategoryRow, type PostRow } from "./supabase";

const ACTIVE_KEY = "postflow.activeBlogId";

interface Data {
  blogs: Blog[];
  categories: Category[];
  posts: Post[];
  activeBlogId: string | null;
}

const empty: Data = { blogs: [], categories: [], posts: [], activeBlogId: null };

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const fromBlog = (r: BlogRow): Blog => ({
  id: r.id,
  name: r.name,
  url: r.url,
  description: r.description ?? "",
  logo: r.logo ?? undefined,
  color: r.color,
  createdAt: r.created_at,
});

const fromCategory = (r: CategoryRow): Category => ({
  id: r.id,
  blogId: r.blog_id,
  name: r.name,
  description: r.description ?? undefined,
});

const fromPost = (r: PostRow): Post => ({
  id: r.id,
  blogId: r.blog_id,
  categoryId: r.category_id ?? undefined,
  title: r.title,
  content: r.content,
  tags: r.tags ?? [],
  status: r.status as Post["status"],
  publishDate: r.publish_date,
  cover: r.cover ?? undefined,
  createdAt: r.created_at,
});

const toBlogRow = (b: Blog): BlogRow => ({
  id: b.id,
  name: b.name,
  url: b.url,
  description: b.description ?? "",
  logo: b.logo ?? null,
  color: b.color,
  created_at: b.createdAt,
});

const toCategoryRow = (c: Category): CategoryRow => ({
  id: c.id,
  blog_id: c.blogId,
  name: c.name,
  description: c.description ?? "",
});

const toPostRow = (p: Post): PostRow => ({
  id: p.id,
  blog_id: p.blogId,
  category_id: p.categoryId ?? null,
  title: p.title,
  content: p.content,
  tags: p.tags,
  status: p.status,
  publish_date: p.publishDate,
  cover: p.cover ?? null,
  created_at: p.createdAt,
});

/** Colunas leves da postagem: `cover` (base64) é carregada sob demanda. */
const POST_COLUMNS = "id,blog_id,category_id,title,content,tags,status,publish_date,created_at";

const toPostPatch = (patch: Partial<Post>) => {
  const row: Record<string, unknown> = {};
  if ("blogId" in patch) row["blog_id"] = patch.blogId;
  if ("categoryId" in patch) row["category_id"] = patch.categoryId ?? null;
  if ("title" in patch) row["title"] = patch.title;
  if ("content" in patch) row["content"] = patch.content;
  if ("tags" in patch) row["tags"] = patch.tags ?? [];
  if ("status" in patch) row["status"] = patch.status;
  if ("publishDate" in patch) row["publish_date"] = patch.publishDate;
  if ("cover" in patch) row["cover"] = patch.cover ?? null;
  return row;
};

function logError(scope: string, error: unknown) {
  if (error) console.error(`[postflow] ${scope}`, error);
}

interface StoreValue extends Data {
  hydrated: boolean;
  activeBlog: Blog | null;
  setActiveBlogId: (id: string | null) => void;
  addBlog: (b: Omit<Blog, "id" | "createdAt" | "color"> & { color?: string }) => Blog;
  updateBlog: (id: string, patch: Partial<Blog>) => void;
  removeBlog: (id: string) => void;
  addCategory: (c: Omit<Category, "id">) => Category;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  removeCategory: (id: string) => void;
  addPost: (p: Omit<Post, "id" | "createdAt">) => void;
  updatePost: (id: string, patch: Partial<Post>) => void;
  removePost: (id: string) => void;
  loadCover: (id: string) => Promise<string | undefined>;
  allTags: string[];
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(empty);
  const [hydrated, setHydrated] = useState(false);

  const loadAll = useCallback(async (isCancelled: () => boolean = () => false) => {
    const stored = (() => {
      try {
        return localStorage.getItem(ACTIVE_KEY);
      } catch {
        return null;
      }
    })();

    const [blogsRes, catsRes, postsRes] = await Promise.all([
      supabase.from("blogs").select("*").order("created_at"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("posts").select(POST_COLUMNS).order("created_at"),
    ]);
    logError("load blogs", blogsRes.error);
    logError("load categories", catsRes.error);
    logError("load posts", postsRes.error);
    if (blogsRes.error || catsRes.error || postsRes.error) {
      toast.error("Não foi possível carregar todos os dados. Verifique a conexão e recarregue.");
    }
    if (isCancelled()) return;

    const blogs = ((blogsRes.data ?? []) as BlogRow[]).map(fromBlog);
    setData({
      blogs,
      categories: ((catsRes.data ?? []) as CategoryRow[]).map(fromCategory),
      posts: ((postsRes.data ?? []) as PostRow[]).map(fromPost),
      activeBlogId: blogs.some((b) => b.id === stored) ? stored : (blogs[0]?.id ?? null),
    });
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadAll(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  /**
   * Toda gravação é otimista (a tela atualiza na hora). Se o banco recusar, avisamos e
   * recarregamos do servidor para a tela nunca mostrar algo que não foi salvo.
   */
  const persistFailed = useCallback(
    (what: string, error: { message?: string } | null) => {
      if (!error) return;
      console.error(`[postflow] ${what}`, error);
      toast.error(`Não foi possível salvar: ${what}.`, {
        description: "Os dados foram recarregados do servidor.",
      });
      void loadAll();
    },
    [loadAll],
  );

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (data.activeBlogId) localStorage.setItem(ACTIVE_KEY, data.activeBlogId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* storage full */
    }
  }, [data.activeBlogId, hydrated]);

  const setActiveBlogId = useCallback((id: string | null) => {
    setData((d) => ({ ...d, activeBlogId: id }));
  }, []);

  const addBlog: StoreValue["addBlog"] = useCallback(
    (input) => {
      const blog: Blog = {
        id: uid(),
        createdAt: new Date().toISOString(),
        color:
          input.color ??
          BLOG_COLORS[Math.floor(Math.random() * BLOG_COLORS.length)] ??
          BLOG_COLORS[0]!,
        name: input.name,
        url: input.url,
        description: input.description,
        logo: input.logo,
      };
      setData((d) => ({
        ...d,
        blogs: [...d.blogs, blog],
        activeBlogId: d.activeBlogId ?? blog.id,
      }));
      void supabase
        .from("blogs")
        .insert(toBlogRow(blog))
        .then(({ error }) => persistFailed("novo blog", error));
      return blog;
    },
    [persistFailed],
  );

  const updateBlog = useCallback(
    (id: string, patch: Partial<Blog>) => {
      setData((d) => {
        const next = d.blogs.map((b) => (b.id === id ? { ...b, ...patch } : b));
        const row = next.find((b) => b.id === id);
        if (row)
          void supabase
            .from("blogs")
            .update(toBlogRow(row))
            .eq("id", id)
            .then(({ error }) => persistFailed("alteração do blog", error));
        return { ...d, blogs: next };
      });
    },
    [persistFailed],
  );

  const removeBlog = useCallback(
    (id: string) => {
      void supabase
        .from("blogs")
        .delete()
        .eq("id", id)
        .then(({ error }) => persistFailed("exclusão do blog", error));
      setData((d) => {
        const blogs = d.blogs.filter((b) => b.id !== id);
        return {
          blogs,
          categories: d.categories.filter((c) => c.blogId !== id),
          posts: d.posts.filter((p) => p.blogId !== id),
          activeBlogId: d.activeBlogId === id ? (blogs[0]?.id ?? null) : d.activeBlogId,
        };
      });
    },
    [persistFailed],
  );

  const addCategory = useCallback(
    (c: Omit<Category, "id">): Category => {
      const category: Category = { ...c, id: uid() };
      void supabase
        .from("categories")
        .insert(toCategoryRow(category))
        .then(({ error }) => persistFailed("nova categoria", error));
      setData((d) => ({ ...d, categories: [...d.categories, category] }));
      return category;
    },
    [persistFailed],
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<Category>) => {
      setData((d) => {
        const next = d.categories.map((c) => (c.id === id ? { ...c, ...patch } : c));
        const row = next.find((c) => c.id === id);
        if (row)
          void supabase
            .from("categories")
            .update(toCategoryRow(row))
            .eq("id", id)
            .then(({ error }) => persistFailed("alteração da categoria", error));
        return { ...d, categories: next };
      });
    },
    [persistFailed],
  );

  const removeCategory = useCallback(
    (id: string) => {
      void supabase
        .from("categories")
        .delete()
        .eq("id", id)
        .then(({ error }) => persistFailed("exclusão da categoria", error));
      setData((d) => ({
        ...d,
        categories: d.categories.filter((c) => c.id !== id),
        posts: d.posts.map((p) => (p.categoryId === id ? { ...p, categoryId: undefined } : p)),
      }));
    },
    [persistFailed],
  );

  const addPost = useCallback(
    (p: Omit<Post, "id" | "createdAt">) => {
      const post: Post = { ...p, id: uid(), createdAt: new Date().toISOString() };
      void supabase
        .from("posts")
        .insert(toPostRow(post))
        .then(({ error }) => persistFailed("nova postagem", error));
      setData((d) => ({ ...d, posts: [...d.posts, post] }));
    },
    [persistFailed],
  );

  const updatePost = useCallback(
    (id: string, patch: Partial<Post>) => {
      void supabase
        .from("posts")
        .update(toPostPatch(patch))
        .eq("id", id)
        .then(({ error }) => persistFailed("alteração da postagem", error));
      setData((d) => ({
        ...d,
        posts: d.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));
    },
    [persistFailed],
  );

  const coversRef = useRef(new Map<string, Promise<string | undefined>>());

  const loadCover = useCallback(async (id: string) => {
    const cached = coversRef.current.get(id);
    if (cached) return cached;
    const p = (async () => {
      const { data: row, error } = await supabase
        .from("posts")
        .select("cover")
        .eq("id", id)
        .maybeSingle();
      logError("load cover", error);
      return ((row as { cover?: string | null } | null)?.cover ?? undefined) || undefined;
    })();
    coversRef.current.set(id, p);
    return p;
  }, []);

  const removePost = useCallback(
    (id: string) => {
      void supabase
        .from("posts")
        .delete()
        .eq("id", id)
        .then(({ error }) => persistFailed("exclusão da postagem", error));
      setData((d) => ({ ...d, posts: d.posts.filter((p) => p.id !== id) }));
    },
    [persistFailed],
  );

  const value = useMemo<StoreValue>(() => {
    const activeBlog = data.blogs.find((b) => b.id === data.activeBlogId) ?? null;
    const allTags = Array.from(new Set(data.posts.flatMap((p) => p.tags))).sort();
    return {
      ...data,
      hydrated,
      activeBlog,
      setActiveBlogId,
      addBlog,
      updateBlog,
      removeBlog,
      addCategory,
      updateCategory,
      removeCategory,
      addPost,
      updatePost,
      removePost,
      loadCover,
      allTags,
    };
  }, [
    data,
    hydrated,
    setActiveBlogId,
    addBlog,
    updateBlog,
    removeBlog,
    addCategory,
    updateCategory,
    removeCategory,
    addPost,
    updatePost,
    removePost,
    loadCover,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
