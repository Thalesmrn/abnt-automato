import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { GraduationCap, Sparkles, FileText, Image as ImageIcon, BookOpen, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--gradient-hero)" }}>
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">TCCFlow</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Button onClick={() => navigate({ to: "/dashboard" })}>Meu painel</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate({ to: "/auth" })}>Entrar</Button>
                <Button onClick={() => navigate({ to: "/auth" })}>Começar grátis</Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-60"
          style={{ background: "var(--gradient-soft)" }}
        />
        <div className="container mx-auto px-4 py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-6">
            <Sparkles className="h-4 w-4" />
            Gerado por IA · Normas ABNT · PDF pronto
          </div>
          <h1 className="mx-auto max-w-4xl text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
            Seu TCC completo,{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-hero)" }}
            >
              em minutos
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg md:text-xl text-muted-foreground">
            Digite o tema. A plataforma escreve introdução, referencial teórico, metodologia,
            resultados, figuras, tabelas e referências — tudo formatado em ABNT.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="h-12 px-8 text-base shadow-lg"
              style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}
              onClick={() => navigate({ to: user ? "/dashboard" : "/auth" })}
            >
              <Zap className="mr-2 h-5 w-5" />
              Gerar meu TCC agora
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: BookOpen, t: "Estrutura completa", d: "Capa, folha de rosto, resumo, abstract, sumário, introdução, referencial, metodologia, resultados, conclusão e referências." },
            { icon: ImageIcon, t: "Figuras e tabelas", d: "Geração automática de figuras ilustrativas com IA e tabelas de dados, com legendas e fontes em ABNT." },
            { icon: FileText, t: "PDF pronto em ABNT", d: "Times 12, espaço 1.5, margens 3/2/3/2 cm, recuo 1.25 cm, citações e referências formatadas." },
          ].map((f, i) => (
            <div key={i} className="rounded-2xl border bg-card p-6 shadow-sm transition-all hover:shadow-md">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-24">
        <div
          className="rounded-3xl p-12 text-center"
          style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground">Pronto para entregar seu TCC?</h2>
          <p className="mt-3 text-primary-foreground/80 max-w-xl mx-auto">
            Crie sua conta grátis e gere seu primeiro trabalho em poucos minutos.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="mt-8 h-12 px-8"
            onClick={() => navigate({ to: user ? "/dashboard" : "/auth" })}
          >
            Começar agora
          </Button>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TCCFlow · Conteúdo gerado por IA — sempre revise antes de entregar.
      </footer>
    </div>
  );
}
