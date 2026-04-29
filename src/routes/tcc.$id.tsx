import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Download, ArrowLeft, AlertCircle, RefreshCw, Pencil, Sparkles, X, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
  const [editing, setEditing] = useState<{ kind: "section" | "chapter"; key: string; index?: number } | null>(null);
  const [editText, setEditText] = useState("");
  const [editMode, setEditMode] = useState<"manual" | "ai">("manual");
  const [aiInstruction, setAiInstruction] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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

  const openEditor = (kind: "section" | "chapter", key: string, index?: number) => {
    const original = kind === "chapter" ? (c.chapters?.[index!]?.body ?? "") : (c.sections?.[key] ?? "");
    setEditing({ kind, key, index });
    setEditText(original);
    setEditMode("manual");
    setAiInstruction("");
  };

  const closeEditor = () => { setEditing(null); setEditText(""); setAiInstruction(""); };

  const saveManual = async () => {
    if (!editing) return;
    setSavingEdit(true);
    const newContent = JSON.parse(JSON.stringify(c));
    if (editing.kind === "chapter" && typeof editing.index === "number") {
      if (!newContent.chapters) newContent.chapters = [];
      newContent.chapters[editing.index] = { ...(newContent.chapters[editing.index] ?? {}), body: editText };
    } else {
      if (!newContent.sections) newContent.sections = {};
      newContent.sections[editing.key] = editText;
    }
    const { error } = await supabase.from("tccs").update({ content: newContent, updated_at: new Date().toISOString() }).eq("id", id);
    setSavingEdit(false);
    if (error) return toast.error(error.message);
    setTcc({ ...tcc, content: newContent });
    toast.success("Seção atualizada!");
    closeEditor();
  };

  const askAI = async () => {
    if (!editing || !aiInstruction.trim()) return toast.error("Descreva o que deseja alterar.");
    setSavingEdit(true);
    const sectionKey = editing.kind === "chapter" ? "chapter" : editing.key;
    const { data, error } = await supabase.functions.invoke("edit-tcc-section", {
      body: { tccId: id, sectionKey, instruction: aiInstruction, chapterIndex: editing.index },
    });
    setSavingEdit(false);
    if (error || (data as any)?.error) return toast.error(error?.message || (data as any)?.error);
    // Recarrega
    const { data: fresh } = await supabase.from("tccs").select("*").eq("id", id).single();
    if (fresh) setTcc(fresh);
    toast.success("Seção reescrita pela IA!");
    closeEditor();
  };

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
            <Section title="Resumo" body={c.sections.resumo} keywords={c.outline?.resumo_keywords} onEdit={() => openEditor("section", "resumo")} />
            <Section title="Abstract" body={c.sections.abstract} keywords={c.outline?.resumo_keywords} keywordLabel="Keywords" italic onEdit={() => openEditor("section", "abstract")} />
            <Section title="1 Introdução" body={c.sections.introducao} onEdit={() => openEditor("section", "introducao")} />
            <Section title="2 Referencial Teórico" body={c.sections.referencial} onEdit={() => openEditor("section", "referencial")} />
            <Section title="3 Metodologia" body={c.sections.metodologia} onEdit={() => openEditor("section", "metodologia")} />
            {(c.chapters || []).map((ch: any, i: number) => (
              <Card key={i} className="p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h2 className="text-xl font-bold">{4 + i} {ch.titulo}</h2>
                  <Button size="sm" variant="ghost" onClick={() => openEditor("chapter", "chapter", i)}><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button>
                </div>
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
              <div className="flex items-start justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold">{4 + (c.chapters?.length || 0)} Resultados e Discussão</h2>
                <Button size="sm" variant="ghost" onClick={() => openEditor("section", "resultados")}><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button>
              </div>
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
            <Section title={`${5 + (c.chapters?.length || 0)} Considerações Finais`} body={c.sections.conclusao} onEdit={() => openEditor("section", "conclusao")} />
            <Card className="p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold">Referências</h2>
                <Button size="sm" variant="ghost" onClick={() => openEditor("section", "referencias")}><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button>
              </div>
              <div className="space-y-2 text-sm">
                {(c.sections.referencias || "").split("\n").filter((l: string) => l.trim()).map((l: string, i: number) => (
                  <p key={i} className="text-justify">{l}</p>
                ))}
              </div>
            </Card>
          </div>
        )}

        {editing && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closeEditor}>
            <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Editar seção</h3>
                <Button size="icon" variant="ghost" onClick={closeEditor}><X className="h-4 w-4" /></Button>
              </div>
              <div className="flex gap-2 mb-4">
                <Button size="sm" variant={editMode === "manual" ? "default" : "outline"} onClick={() => setEditMode("manual")}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar manualmente
                </Button>
                <Button size="sm" variant={editMode === "ai" ? "default" : "outline"} onClick={() => setEditMode("ai")}>
                  <Sparkles className="h-3.5 w-3.5 mr-1" /> Pedir à IA
                </Button>
              </div>
              {editMode === "manual" ? (
                <>
                  <p className="text-xs text-muted-foreground mb-2">Use linhas em branco para separar parágrafos. Sem markdown.</p>
                  <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={20} className="font-mono text-sm" />
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={closeEditor} disabled={savingEdit}>Cancelar</Button>
                    <Button onClick={saveManual} disabled={savingEdit} style={{ background: "var(--gradient-hero)" }}>
                      {savingEdit ? <Loader2 className="animate-spin h-4 w-4" /> : <><Save className="h-4 w-4 mr-1" /> Salvar</>}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">Descreva o que mudar (ex.: "deixe mais formal", "acrescente um parágrafo sobre X", "encurte para 200 palavras").</p>
                  <Textarea value={aiInstruction} onChange={(e) => setAiInstruction(e.target.value)} rows={5} placeholder="Ex.: Reescreva mantendo o sentido, mas com tom mais técnico e adicione exemplos do contexto brasileiro." />
                  <details className="mt-3 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Ver texto atual</summary>
                    <pre className="mt-2 p-3 bg-muted rounded whitespace-pre-wrap text-xs max-h-60 overflow-y-auto">{editText}</pre>
                  </details>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={closeEditor} disabled={savingEdit}>Cancelar</Button>
                    <Button onClick={askAI} disabled={savingEdit || !aiInstruction.trim()} style={{ background: "var(--gradient-hero)" }}>
                      {savingEdit ? <Loader2 className="animate-spin h-4 w-4" /> : <><Sparkles className="h-4 w-4 mr-1" /> Reescrever com IA</>}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function Section({ title, body, keywords, keywordLabel = "Palavras-chave", italic, onEdit }: any) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className={`text-xl font-bold ${italic ? "italic" : ""}`}>{title}</h2>
        {onEdit && <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button>}
      </div>
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