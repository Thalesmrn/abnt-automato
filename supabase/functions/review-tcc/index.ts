// @ts-nocheck
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Lovable AI não está configurado.");

    const { text, fileName } = await req.json();
    if (!text || typeof text !== "string") throw new Error("Texto do TCC ausente");
    const trimmed = text.slice(0, 60000); // reduz custo por revisão e evita payloads muito grandes

    const system = `Você é um revisor acadêmico sênior brasileiro, especialista em normas ABNT, redação científica e ortografia. Analise o TCC enviado pelo aluno e devolva um relatório estruturado em Markdown com as seções:

## 1. Visão geral
Resumo crítico (2-4 parágrafos) sobre clareza, coerência, profundidade e adequação acadêmica.

## 2. Pontos fortes
Lista com bullets.

## 3. Pontos a melhorar
Lista com bullets, indicando capítulo/seção quando possível.

## 4. Erros ortográficos e gramaticais
Tabela em markdown com colunas: Trecho original | Correção sugerida | Motivo. Inclua até 30 ocorrências mais relevantes.

## 5. Sugestões de reescrita
Apresente 3 a 6 trechos originais e sua versão reescrita com mais clareza, coesão e tom acadêmico. Use blocos:
**Original:** ...
**Sugestão:** ...

## 6. ABNT e estrutura
Aponte problemas de formatação, citação, referências, capa, sumário, etc.

## 7. Próximos passos
Checklist objetivo do que o aluno deve revisar antes de entregar.

Seja direto, técnico e construtivo. Não invente conteúdo que não esteja no texto.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Arquivo: ${fileName ?? "tcc.txt"}\n\nConteúdo do TCC:\n\n${trimmed}` },
        ],
      }),
    });

    if (r.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns instantes." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
    if (r.status === 402) return new Response(JSON.stringify({ error: "Saldo do Lovable AI esgotado. Os créditos de edição/build não são o mesmo saldo da IA do app; adicione saldo em Settings > Cloud & AI balance." }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
    if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);

    const data = await r.json();
    const review = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ review }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("review-tcc error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Erro" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});