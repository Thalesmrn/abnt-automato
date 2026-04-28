import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — TCCFlow" }, { name: "description", content: "Crie sua conta grátis na TCCFlow." }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: name },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu e-mail.");
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--gradient-soft)" }}>
      <header className="container mx-auto px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold">TCCFlow</span>
        </Link>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-center mb-1">Bem-vindo</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">Acesse sua conta ou crie uma nova</p>
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4 pt-4">
                <div><Label>E-mail</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label>Senha</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button className="w-full" disabled={busy} type="submit">{busy ? "..." : "Entrar"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4 pt-4">
                <div><Label>Nome completo</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><Label>E-mail</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label>Senha (mín. 6)</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button className="w-full" disabled={busy} type="submit">{busy ? "..." : "Criar conta"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}