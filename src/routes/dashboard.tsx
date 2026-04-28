import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, FileText, Loader2, AlertCircle, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Painel — TCCFlow" }] }),
  component: Dashboard,
});

interface Tcc {
  id: string; title: string; theme: string; status: string;
  progress: number; created_at: string; error_message: string | null;
}

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tccs, setTccs] = useState<Tcc[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await supabase.from("tccs").select("id,title,theme,status,progress,created_at,error_message").order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setTccs(data ?? []);
      setFetching(false);
    };
    load();
    const ch = supabase
      .channel("tccs_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tccs" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const remove = async (id: string) => {
    if (!confirm("Excluir este TCC?")) return;
    const { error } = await supabase.from("tccs").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("TCC excluído");
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Meus TCCs</h1>
            <p className="text-muted-foreground mt-1">Gere, acompanhe e baixe seus trabalhos</p>
          </div>
          <Button onClick={() => navigate({ to: "/new" })} size="lg" style={{ background: "var(--gradient-hero)" }}>
            <Plus className="mr-2 h-4 w-4" /> Novo TCC
          </Button>
        </div>

        {fetching ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : tccs.length === 0 ? (
          <Card className="p-16 text-center border-dashed">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nenhum TCC ainda</h2>
            <p className="text-muted-foreground mb-6">Crie seu primeiro trabalho em poucos minutos.</p>
            <Button onClick={() => navigate({ to: "/new" })} style={{ background: "var(--gradient-hero)" }}>
              <Plus className="mr-2 h-4 w-4" /> Criar TCC
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {tccs.map((t) => (
              <Card key={t.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <Link to="/tcc/$id" params={{ id: t.id }} className="block">
                      <h3 className="font-semibold text-lg truncate hover:text-primary transition-colors">{t.title}</h3>
                      <p className="text-sm text-muted-foreground truncate mt-1">{t.theme}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </Link>
                    {(t.status === "generating" || t.status === "pending") && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Gerando... {t.progress}%
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full transition-all" style={{ width: `${t.progress}%`, background: "var(--gradient-hero)" }} />
                        </div>
                      </div>
                    )}
                    {t.status === "error" && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3" /> {t.error_message?.slice(0, 100)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      t.status === "done" ? "bg-green-100 text-green-700" :
                      t.status === "error" ? "bg-red-100 text-red-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {t.status === "done" ? "Pronto" : t.status === "error" ? "Erro" : "Gerando"}
                    </span>
                    {t.status === "done" && (
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/tcc/$id" params={{ id: t.id }}><Download className="h-4 w-4" /></Link>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}