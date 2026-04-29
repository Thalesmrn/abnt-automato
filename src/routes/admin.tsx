import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, FileText, Shield, ChevronDown, ChevronUp, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — TCCFlow" }] }),
  component: AdminPage,
});

interface AdminUser {
  id: string; email: string; created_at: string; last_sign_in_at: string | null;
  roles: string[]; tcc_count: number;
}
interface Tcc { id: string; title: string; theme: string; status: string; created_at: string; }
interface TccWithAuthor extends Tcc { user_id: string; author_email: string; }

function AdminPage() {
  const { user, loading } = useAuth();
  const { isAdmin, checking } = useIsAdmin();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [fetching, setFetching] = useState(true);
  const [openUser, setOpenUser] = useState<string | null>(null);
  const [userTccs, setUserTccs] = useState<Record<string, Tcc[]>>({});
  const [allTccs, setAllTccs] = useState<TccWithAuthor[]>([]);
  const [view, setView] = useState<"users" | "tccs">("users");

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);
  useEffect(() => { if (!loading && !checking && !isAdmin) navigate({ to: "/dashboard" }); }, [isAdmin, checking, loading, navigate]);

  const load = async () => {
    setFetching(true);
    const { data, error } = await supabase.functions.invoke("admin-list-users");
    if (error || (data as any)?.error) { toast.error(error?.message || (data as any)?.error); setFetching(false); return; }
    const list: AdminUser[] = (data as any).users ?? [];
    setUsers(list);
    // Fetch all TCCs (admin RLS allows it) and join author email locally
    const { data: tccs } = await supabase
      .from("tccs")
      .select("id,title,theme,status,created_at,user_id")
      .order("created_at", { ascending: false });
    const emailById = new Map(list.map((u) => [u.id, u.email]));
    setAllTccs((tccs ?? []).map((t: any) => ({ ...t, author_email: emailById.get(t.user_id) ?? "—" })));
    setFetching(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const toggleUser = async (uid: string) => {
    if (openUser === uid) { setOpenUser(null); return; }
    setOpenUser(uid);
    if (!userTccs[uid]) {
      const { data, error } = await supabase.from("tccs").select("id,title,theme,status,created_at").eq("user_id", uid).order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setUserTccs((s) => ({ ...s, [uid]: data ?? [] }));
    }
  };

  const sendReset = async (email: string) => {
    const redirectTo = `${window.location.origin}/account`;
    const { data, error } = await supabase.functions.invoke("admin-reset-password", { body: { email, redirectTo } });
    if (error || (data as any)?.error) return toast.error(error?.message || (data as any)?.error);
    toast.success(`Link de redefinição enviado para ${email}`);
  };

  if (loading || checking) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Painel Admin</h1>
        </div>
        <p className="text-muted-foreground mb-8">Gerencie usuários e visualize todos os TCCs da plataforma.</p>

        <div className="flex gap-2 mb-6">
          <Button size="sm" variant={view === "users" ? "default" : "outline"} onClick={() => setView("users")}>
            <Users className="h-4 w-4 mr-1" /> Usuários
          </Button>
          <Button size="sm" variant={view === "tccs" ? "default" : "outline"} onClick={() => setView("tccs")}>
            <FileText className="h-4 w-4 mr-1" /> Todos os TCCs
          </Button>
        </div>

        {fetching ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : view === "tccs" ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{allTccs.length} TCC(s) na plataforma</p>
            {allTccs.map((t) => (
              <Card key={t.id} className="p-3">
                <Link to="/tcc/$id" params={{ id: t.id }} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      <span className="text-primary font-semibold">[{t.author_email}]</span>{" "}
                      {t.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.theme}
                      {" · "}{formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                    t.status === "done" ? "bg-green-100 text-green-700" :
                    t.status === "error" ? "bg-red-100 text-red-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {t.status === "done" ? "Pronto" : t.status === "error" ? "Erro" : "Gerando"}
                  </span>
                </Link>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{users.length} usuário(s)</p>
            {users.map((u) => (
              <Card key={u.id} className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{u.email}</span>
                      {u.roles.includes("admin") && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Admin</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Criado {formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: ptBR })}
                      {" · "}{u.tcc_count} TCC(s)
                      {u.last_sign_in_at && ` · último acesso ${formatDistanceToNow(new Date(u.last_sign_in_at), { addSuffix: true, locale: ptBR })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => sendReset(u.email)}>
                      <Mail className="h-4 w-4 mr-1" /> Redefinir senha
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleUser(u.id)}>
                      <FileText className="h-4 w-4 mr-1" />
                      TCCs
                      {openUser === u.id ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                    </Button>
                  </div>
                </div>
                {openUser === u.id && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    {(userTccs[u.id] ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum TCC.</p>
                    ) : (
                      (userTccs[u.id] ?? []).map((t) => (
                        <Link key={t.id} to="/tcc/$id" params={{ id: t.id }} className="flex items-center justify-between gap-3 py-2 px-3 rounded hover:bg-muted">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{t.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{t.theme}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                            t.status === "done" ? "bg-green-100 text-green-700" :
                            t.status === "error" ? "bg-red-100 text-red-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            {t.status === "done" ? "Pronto" : t.status === "error" ? "Erro" : "Gerando"}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}