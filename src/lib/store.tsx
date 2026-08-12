import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BLOG_COLORS, type Blog, type Category, type Post } from "./types";

const KEY = "postflow.data.v1";

interface Data {
  blogs: Blog[];
  categories: Category[];
  posts: Post[];
  activeBlogId: string | null;
}

const empty: Data = { blogs: [], categories: [], posts: [], activeBlogId: null };

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

interface StoreValue extends Data {
  hydrated: boolean;
  activeBlog: Blog | null;
  setActiveBlogId: (id: string | null) => void;
  addBlog: (b: Omit<Blog, "id" | "createdAt" | "color"> & { color?: string }) => Blog;
  updateBlog: (id: string, patch: Partial<Blog>) => void;
  removeBlog: (id: string) => void;
  addCategory: (c: Omit<Category, "id">) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  removeCategory: (id: string) => void;
  addPost: (p: Omit<Post, "id" | "createdAt">) => void;
  updatePost: (id: string, patch: Partial<Post>) => void;
  removePost: (id: string) => void;
  allTags: string[];
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(empty);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setData({ ...empty, ...(JSON.parse(raw) as Data) });
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* storage full */
    }
  }, [data, hydrated]);

  const setActiveBlogId = useCallback((id: string | null) => {
    setData((d) => ({ ...d, activeBlogId: id }));
  }, []);

  const addBlog: StoreValue["addBlog"] = useCallback((input) => {
    const blog: Blog = {
      id: uid(),
      createdAt: new Date().toISOString(),
      color: input.color ?? BLOG_COLORS[Math.floor(Math.random() * BLOG_COLORS.length)],
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
    return blog;
  }, []);

  const updateBlog = useCallback((id: string, patch: Partial<Blog>) => {
    setData((d) => ({
      ...d,
      blogs: d.blogs.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }, []);

  const removeBlog = useCallback((id: string) => {
    setData((d) => {
      const blogs = d.blogs.filter((b) => b.id !== id);
      return {
        blogs,
        categories: d.categories.filter((c) => c.blogId !== id),
        posts: d.posts.filter((p) => p.blogId !== id),
        activeBlogId: d.activeBlogId === id ? (blogs[0]?.id ?? null) : d.activeBlogId,
      };
    });
  }, []);

  const addCategory = useCallback((c: Omit<Category, "id">) => {
    setData((d) => ({ ...d, categories: [...d.categories, { ...c, id: uid() }] }));
  }, []);

  const updateCategory = useCallback((id: string, patch: Partial<Category>) => {
    setData((d) => ({
      ...d,
      categories: d.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const removeCategory = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      categories: d.categories.filter((c) => c.id !== id),
      posts: d.posts.map((p) => (p.categoryId === id ? { ...p, categoryId: undefined } : p)),
    }));
  }, []);

  const addPost = useCallback((p: Omit<Post, "id" | "createdAt">) => {
    setData((d) => ({
      ...d,
      posts: [...d.posts, { ...p, id: uid(), createdAt: new Date().toISOString() }],
    }));
  }, []);

  const updatePost = useCallback((id: string, patch: Partial<Post>) => {
    setData((d) => ({
      ...d,
      posts: d.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, []);

  const removePost = useCallback((id: string) => {
    setData((d) => ({ ...d, posts: d.posts.filter((p) => p.id !== id) }));
  }, []);

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
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}