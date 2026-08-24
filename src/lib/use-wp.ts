import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "./supabase";
import { getWpSiteMeta } from "./wp.functions";
import type {
  WpConnectionRow,
  WpConnectionStatus,
  WpPublicationRow,
  WpPublicationStatus,
} from "./wp-types";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const CONNECTIONS_KEY = ["wp_connections"];
export const PUBLICATIONS_KEY = ["wp_publications"];

export function useWpConnections() {
  return useQuery({
    queryKey: CONNECTIONS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wp_connections")
        .select("*")
        .order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as WpConnectionRow[];
    },
  });
}

export function useWpPublications() {
  return useQuery({
    queryKey: PUBLICATIONS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wp_publications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as WpPublicationRow[];
    },
  });
}

export interface ConnectionInput {
  name: string;
  site_url: string;
  username: string;
  app_password: string;
  status?: WpConnectionStatus;
  last_error?: string | null;
  last_tested_at?: string | null;
}

export function useConnectionMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: CONNECTIONS_KEY });

  const create = useMutation({
    mutationFn: async (input: ConnectionInput) => {
      const row = { id: uid(), created_at: new Date().toISOString(), ...input };
      const { error } = await supabase.from("wp_connections").insert(row);
      if (error) throw new Error(error.message);
      return row;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ConnectionInput> }) => {
      const { error } = await supabase.from("wp_connections").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wp_connections").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: PUBLICATIONS_KEY });
    },
  });

  return { create, update, remove };
}

export interface PublicationInput {
  post_id: string;
  connection_id: string;
  title: string;
  wp_post_id?: number | null;
  wp_link?: string | null;
  status: WpPublicationStatus;
  scheduled_at?: string | null;
  error?: string | null;
}

export function usePublicationMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: PUBLICATIONS_KEY });

  const save = useMutation({
    mutationFn: async (input: PublicationInput) => {
      const now = new Date().toISOString();
      const { data: existing } = await supabase
        .from("wp_publications")
        .select("id")
        .eq("post_id", input.post_id)
        .eq("connection_id", input.connection_id)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("wp_publications")
          .update({ ...input, updated_at: now })
          .eq("id", (existing as { id: string }).id);
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await supabase
        .from("wp_publications")
        .insert({ id: uid(), created_at: now, updated_at: now, ...input });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wp_publications").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return { save, remove };
}

/** Categorias, tags e autores do site selecionado (cache de 5 min). */
export function useWpSiteMeta(connectionId: string | null) {
  const fetchMeta = useServerFn(getWpSiteMeta);
  return useQuery({
    queryKey: ["wp_site_meta", connectionId],
    enabled: Boolean(connectionId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchMeta({ data: { connectionId: connectionId! } }),
  });
}
