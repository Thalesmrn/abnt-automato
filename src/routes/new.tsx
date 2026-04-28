import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/new")({
  head: () => ({ meta: [{ title: "Novo TCC — TCCFlow" }] }),
  component: NewTcc,
});

function NewTcc() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "", theme: "", author_name: "", institution: "", course: "",
    advisor: "", city: "", year: new Date().getFullYear(), size: "medio",
  });

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.title.trim() || !form.theme.trim()) return toast.error("Preencha título e tema");
    setBusy(true);
    try {
      const { data, error } = await supabase.from("tccs").insert({
        ...form, user_id: user.id, year: Number(form.year),
      }).select("id").single();
      if (error) throw error;
      supabase.functions.invoke("generate-tcc", { body: { tccId: data.id } }).catch(console.error);
      toast.success("Geração iniciada! Pode levar alguns minutos.");
      navigate({ to: "/tcc/$id", params: { id: data.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar TCC");
      setBusy(false);
    }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Novo TCC</h1>
        <p className="text-muted-foreground mb-8">Preencha o tema. Os demais campos vão para a capa e folha de rosto.</p>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label>Título do TCC *</Label>
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: O impacto da inteligência artificial na educação superior" />
            </div>
            <div>
              <Label>Tema / Assunto *</Label>
              <Input required value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })}
                placeholder="Ex: Inteligência artificial aplicada à educação" />
              <p className="text-xs text-muted-foreground mt-1">A IA gera todo o conteúdo a partir daqui.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Tamanho</Label>
                <Select value={form.size} onValueChange={(v) => setForm({ ...form, size: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="curto">Curto (~15-25 págs)</SelectItem>
                    <SelectItem value="medio">Médio (~30-50 págs)</SelectItem>
                    <SelectItem value="longo">Longo (~60-80 págs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ano</Label>
                <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
              </div>
            </div>
            <div className="border-t pt-5 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Dados para capa (opcional)</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>Autor</Label><Input value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} /></div>
                <div><Label>Orientador(a)</Label><Input value={form.advisor} onChange={(e) => setForm({ ...form, advisor: e.target.value })} /></div>
                <div><Label>Instituição</Label><Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} /></div>
                <div><Label>Curso</Label><Input value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              </div>
            </div>
            <Button type="submit" disabled={busy} size="lg" className="w-full" style={{ background: "var(--gradient-hero)" }}>
              {busy ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Gerar TCC
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}