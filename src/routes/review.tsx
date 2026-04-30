import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Upload, FileSearch, FileText, AlertCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { extractTextFromFile } from "@/lib/extract-text";

export const Route = createFileRoute("/review")({
  head: () => ({ meta: [{ title: "Revisar TCC — TCCFlow" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<string>("");
  const [error, setError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const onPick = (f: File | null) => {
    setReview(""); setError("");
    if (!f) return setFile(null);
    const ok = /\.(pdf|docx|txt|md)$/i.test(f.name);
    if (!ok) return toast.error("Use PDF, DOCX ou TXT");
    if (f.size > 15 * 1024 * 1024) return toast.error("Arquivo muito grande (máx 15MB)");
    setFile(f);
  };

  const submit = async () => {
    if (!file) return;
    setExtracting(true); setError(""); setReview("");
    let text = "";
    try {
      text = await extractTextFromFile(file);
      if (!text.trim()) throw new Error("Não foi possível extrair texto do arquivo.");
    } catch (e: any) {
      setExtracting(false);
      return toast.error(e.message ?? "Falha ao ler o arquivo");
    }
    setExtracting(false);
    setReviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke("review-tcc", {
        body: { text, fileName: file.name },
      });
      if (error) throw new Error(error.message || "Erro na análise");
      if ((data as any)?.error) {
        setError((data as any).error);
        toast.error((data as any).error);
        return;
      }
      setReview((data as any)?.review ?? "");
      toast.success("Revisão concluída!");
    } catch (e: any) {
      setError(e.message ?? "Erro na análise");
      toast.error(e.message ?? "Erro na análise");
    } finally {
      setReviewing(false);
    }
  };

  const downloadReview = () => {
    const blob = new Blob([review], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revisao-${(file?.name ?? "tcc").replace(/\.[^.]+$/, "")}.md`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 5000);
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  const busy = extracting || reviewing;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Revisar TCC existente</h1>
        <p className="text-muted-foreground mb-8">
          Anexe seu TCC (PDF, DOCX ou TXT) e a IA vai apontar melhorias, erros ortográficos e sugestões de reescrita.
        </p>

        <Card className="p-6">
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files?.[0] ?? null); }}
            className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            {file ? (
              <div>
                <p className="font-medium flex items-center justify-center gap-2"><FileText className="h-4 w-4" /> {file.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(0)} KB — clique para trocar</p>
              </div>
            ) : (
              <div>
                <p className="font-medium">Clique ou arraste o arquivo aqui</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOCX ou TXT — até 15MB</p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
          </div>

          <Button
            onClick={submit}
            disabled={!file || busy}
            size="lg"
            className="w-full mt-5"
            style={{ background: "var(--gradient-hero)" }}
          >
            {extracting ? (<><Loader2 className="animate-spin mr-2 h-4 w-4" /> Lendo arquivo...</>)
              : reviewing ? (<><Loader2 className="animate-spin mr-2 h-4 w-4" /> Analisando com IA...</>)
              : (<><FileSearch className="mr-2 h-4 w-4" /> Analisar e sugerir melhorias</>)}
          </Button>

          {error && (
            <div className="mt-4 flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" /> {error}
            </div>
          )}
        </Card>

        {review && (
          <Card className="p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Relatório da revisão</h2>
              <Button variant="outline" size="sm" onClick={downloadReview}>
                <Download className="h-4 w-4 mr-1" /> Baixar (.md)
              </Button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{review}</pre>
          </Card>
        )}
      </main>
    </div>
  );
}