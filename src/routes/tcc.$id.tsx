import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Download, ArrowLeft, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { generateAbntPdf } from "@/lib/abnt-pdf";

export const Route = createFileRoute("/tcc/$id")({
  head: () => ({ meta: [{ title: "TCC — TCCFlow" }] }),
  component: TccView,
});

function TccView() {
  const { id } = useParams({ from: "/tcc/$id" });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tcc, setTcc] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await supabase.from("tccs").select("*").eq("id", id).single();
      if (error) toast.error(error.message);
      setTcc(data);
      setFetching(false);
    };
    load();
    const ch = supabase
      .channel(`tcc_${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tccs", filter: `id=eq.${id}` }, (p) => setTcc(p.new))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, user]);

  const download = async () => {
    if (!tcc?.content) return;
    setDownloading(true);
    try {
      await generateAbntPdf(tcc);
      toast.success("PDF gerado!");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar PDF");
    } finally {
      setDownloading(false);
    }
  };

  const retry = async () => {
    await supabase.from("tccs").update({ status: "pending", progress: 0, error_message: null }).eq("id", id);
    supabase.functions.invoke("generate-tcc", { body: { tccId: id } }).catch(console.error);
    toast.info("Tentando novamente...");
  };

  if (loading || fetching) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!tcc) return <div className="min-h-screen flex items-center justify-center">TCC não encontrado</div>;

  const c = tcc.content || {};

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10 max-w-4xl">
        <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-3xl font-bold">{tcc.title}</h1>
            <p className="text-muted-foreground mt-1">{tcc.theme}</p>
          </div>
          {tcc.status === "done" && (
            <Button onClick={download} disabled={downloading} size="lg" style={{ background: "var(--gradient-hero)" }}>
              {downloading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
              Baixar PDF (ABNT)
            </Button>
          )}
        </div>

        {(tcc.status === "pending" || tcc.status === "generating") && (
          <Card className="p-12 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Gerando seu TCC...</h2>
            <p className="text-muted-foreground mb-6">Pode levar 2-5 minutos. Não feche esta página.</p>
            <div className="max-w-md mx-auto">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full transition-all" style={{ width: `${tcc.progress}%`, background: "var(--gradient-hero)" }} />
              </div>
              <p className="text-sm text-muted-foreground mt-2">{tcc.progress}%</p>
            </div>
          </Card>
        )}

        {tcc.status === "error" && (
          <Card className="p-8 border-destructive/50">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-destructive shrink-0" />
              <div className="flex-1">
                <h2 className="font-semibold">Erro na geração</h2>
                <p className="text-sm text-muted-foreground mt-1">{tcc.error_message}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={retry}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
                </Button>
              </div>
            </div>
          </Card>
        )}

        {tcc.status === "done" && c.sections && (
          <div className="space-y-8">
            <Section title="Resumo" body={c.sections.resumo} keywords={c.outline?.resumo_keywords} />
            <Section title="Abstract" body={c.sections.abstract} keywords={c.outline?.resumo_keywords} keywordLabel="Keywords" italic />
            <Section title="1 Introdução" body={c.sections.introducao} />
            <Section title="2 Referencial Teórico" body={c.sections.referencial} />
            <Section title="3 Metodologia" body={c.sections.metodologia} />
            {(c.chapters || []).map((ch: any, i: number) => (
              <Card key={i} className="p-6">
                <h2 className="text-xl font-bold mb-4">{4 + i} {ch.titulo}</h2>
                <Prose text={ch.body} />
                {ch.image && (
                  <figure className="mt-6 text-center">
                    <p className="text-sm font-medium mb-2">Figura {i + 1} – {ch.imagem_descricao}</p>
                    <img src={ch.image} alt={ch.imagem_descricao} className="mx-auto max-w-md rounded-lg border" />
                    <figcaption className="text-xs text-muted-foreground mt-2">Fonte: Elaborado pelo autor ({tcc.year ?? new Date().getFullYear()}).</figcaption>
                  </figure>
                )}
              </Card>
            ))}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">{4 + (c.chapters?.length || 0)} Resultados e Discussão</h2>
              <Prose text={c.sections.resultados} />
              {c.table && (
                <div className="mt-6">
                  <p className="text-sm font-medium text-center mb-2">Tabela 1 – {c.table.titulo}</p>
                  <table className="w-full border-collapse text-sm">
                    <thead><tr>{c.table.headers.map((h: string, i: number) => <th key={i} className="border-b-2 border-foreground p-2 text-center font-semibold">{h}</th>)}</tr></thead>
                    <tbody>{c.table.rows.map((row: string[], i: number) => <tr key={i}>{row.map((cell, j) => <td key={j} className="border-b p-2 text-center">{cell}</td>)}</tr>)}</tbody>
                  </table>
                  <p className="text-xs text-center text-muted-foreground mt-2">Fonte: {c.table.fonte}</p>
                </div>
              )}
            </Card>
            <Section title={`${5 + (c.chapters?.length || 0)} Considerações Finais`} body={c.sections.conclusao} />
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Referências</h2>
              <div className="space-y-2 text-sm">
                {(c.sections.referencias || "").split("\n").filter((l: string) => l.trim()).map((l: string, i: number) => (
                  <p key={i} className="text-justify">{l}</p>
                ))}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function Section({ title, body, keywords, keywordLabel = "Palavras-chave", italic }: any) {
  return (
    <Card className="p-6">
      <h2 className={`text-xl font-bold mb-4 ${italic ? "italic" : ""}`}>{title}</h2>
      <Prose text={body} italic={italic} />
      {keywords && (
        <p className={`mt-4 text-sm ${italic ? "italic" : ""}`}><strong>{keywordLabel}:</strong> {keywords.join("; ")}.</p>
      )}
    </Card>
  );
}

function Prose({ text, italic }: { text?: string; italic?: boolean }) {
  if (!text) return null;
  return (
    <div className={`space-y-4 text-justify leading-relaxed ${italic ? "italic" : ""}`}>
      {text.split(/\n\s*\n/).map((p, i) => <p key={i} className="indent-8">{p}</p>)}
    </div>
  );
}