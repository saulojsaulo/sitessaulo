import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mlDb } from "@/lib/ml-auth";
import { MlSitesTab, MlProductsTab, MlMetricsTab } from "@/components/ml-affiliates";

export const Route = createFileRoute("/afiliados-ml")({
  head: () => ({
    meta: [
      { title: "Afiliados Mercado Livre — PostFlow" },
      { name: "description", content: "Controle privado dos sites, produtos e métricas do plugin de afiliados Mercado Livre." },
      { property: "og:title", content: "Afiliados Mercado Livre — PostFlow" },
      { property: "og:description", content: "Sites, produtos e métricas dos plugins de afiliados Mercado Livre." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AfiliadosPage,
});

function AfiliadosPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    mlDb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = mlDb.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return setAdmin(null);
    mlDb.rpc("ml_is_admin").then(({ data, error }) => setAdmin(!error && data === true));
  }, [session]);

  if (!ready) return <Loader2 className="mx-auto size-6 animate-spin" />;
  if (!session) return <LoginCard />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Afiliados Mercado Livre</h1>
          <p className="text-sm text-muted-foreground">Sites, produtos e métricas dos plugins WordPress.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mlDb.auth.signOut()}>
          <LogOut className="size-4" /> Sair
        </Button>
      </div>
      {admin === null ? (
        <Loader2 className="mx-auto size-6 animate-spin" />
      ) : !admin ? (
        <div className="rounded-lg border bg-card p-6 text-sm">
          <p className="font-medium">Sua conta ainda não tem acesso de administrador.</p>
          <p className="mt-2 text-muted-foreground">
            Rode no SQL Editor do banco (última linha do arquivo do módulo), com o e-mail {session.user.email}, e recarregue a página.
          </p>
        </div>
      ) : (
        <Tabs defaultValue="metricas">
          <TabsList>
            <TabsTrigger value="metricas">Métricas</TabsTrigger>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="sites">Sites</TabsTrigger>
          </TabsList>
          <TabsContent value="sites"><MlSitesTab /></TabsContent>
          <TabsContent value="produtos"><MlProductsTab /></TabsContent>
          <TabsContent value="metricas"><MlMetricsTab /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function LoginCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (signup: boolean) => {
    setBusy(true);
    const { error } = signup
      ? await mlDb.auth.signUp({ email, password })
      : await mlDb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else if (signup) toast.success("Conta criada. Se pedido, confirme o e-mail e entre.");
  };
  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-xl border bg-card p-6">
      <h1 className="font-display text-xl font-bold">Afiliados Mercado Livre</h1>
      <p className="text-sm text-muted-foreground">Área restrita. Entre com sua conta de administrador.</p>
      <div className="space-y-2">
        <Label htmlFor="ml-email">E-mail</Label>
        <Input id="ml-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ml-pass">Senha</Label>
        <Input id="ml-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={busy} onClick={() => submit(false)}>Entrar</Button>
        <Button variant="outline" disabled={busy} onClick={() => submit(true)}>Criar conta</Button>
      </div>
    </div>
  );
}
