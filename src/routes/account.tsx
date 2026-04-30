import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Minha conta — TCCFlow" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (next.length < 6) return toast.error("A nova senha deve ter pelo menos 6 caracteres.");
    if (next !== confirm) return toast.error("A confirmação não confere.");
    setBusy(true);
    const { error: upErr } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (upErr) return toast.error(upErr.message);
    setNext(""); setConfirm("");
    toast.success("Senha alterada com sucesso!");
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10 max-w-xl">
        <h1 className="text-3xl font-bold mb-2">Minha conta</h1>
        <p className="text-muted-foreground mb-8">{user.email}</p>
        <Card className="p-6">
          <h2 className="font-semibold text-lg mb-4">Redefinir senha</h2>
          <form onSubmit={submit} className="space-y-4">
            <div><Label>Nova senha (mín. 6)</Label><Input type="password" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} /></div>
            <div><Label>Confirmar nova senha</Label><Input type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
            <Button type="submit" disabled={busy} style={{ background: "var(--gradient-hero)" }}>
              {busy ? <Loader2 className="animate-spin h-4 w-4" /> : "Salvar nova senha"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}