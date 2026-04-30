// @ts-nocheck
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const esc = (value: string) => value.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
const has = (text: string, pattern: RegExp) => pattern.test(text);

function localReview(text: string, fileName?: string, reason = "") {
  const clean = text.replace(/\s+/g, " ").trim();
  const lower = clean.toLowerCase();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [];
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const longSentences = sentences.filter((s) => s.split(/\s+/).length > 38).slice(0, 6);
  const structureChecks = [
    ["Resumo", /\bresumo\b/i], ["Sumário", /\bsum[áa]rio\b/i], ["Introdução", /\bintrodu[çc][ãa]o\b/i],
    ["Objetivos", /\bobjetiv[oa]s?\b/i], ["Metodologia", /\bmetodologia\b/i], ["Conclusão", /\bconclus[ãa]o\b/i],
    ["Referências", /\brefer[êe]ncias\b/i], ["Citações autor-data", /\([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}[^)]*\d{4}\)/],
  ] as const;
  const missing = structureChecks.filter(([, pattern]) => !has(text, pattern)).map(([label]) => label);
  const weakTerms = ["muito", "coisa", "coisas", "vários", "diversos", "importante", "atualmente", "basicamente"];
  const foundWeak = weakTerms.filter((term) => new RegExp(`\\b${term}\\b`, "i").test(lower));
  const grammarRules = [
    [/\bnao\b/gi, "não", "Acentuação"], [/\btambem\b/gi, "também", "Acentuação"], [/\bvoce\b/gi, "você", "Acentuação"],
    [/\batravez\b/gi, "através", "Grafia correta"], [/\bderrepente\b/gi, "de repente", "Expressão correta"],
    [/\bcom certeza\b/gi, "com certeza", "Evite grafias como “conceteza” ou “concerteza”"], [/\bpor que\?*/gi, "por que / porque / por quê / porquê", "Revise o uso conforme o sentido"],
    [/\s{2,}/g, "espaço simples", "Remover espaços duplicados"], [/\s+([,.;:!?])/g, "$1", "Remover espaço antes da pontuação"],
  ];
  const issues: string[] = [];
  for (const [pattern, correction, motive] of grammarRules) {
    const match = clean.match(pattern)?.[0];
    if (match && issues.length < 18) issues.push(`| ${esc(match)} | ${esc(correction)} | ${motive} |`);
  }
  for (const sentence of longSentences.slice(0, 8)) issues.push(`| ${esc(sentence.slice(0, 180))}${sentence.length > 180 ? "..." : ""} | Dividir em 2 frases menores | Período longo reduz clareza e coesão |`);
  if (!issues.length) issues.push("| Não foram detectados erros ortográficos evidentes por revisão automática local | Fazer revisão humana/IA detalhada | A análise local identifica apenas padrões objetivos |.");

  const firstLong = longSentences[0] ?? sentences.find((s) => s.split(/\s+/).length > 24) ?? sentences[0] ?? "";
  const rewrite = firstLong ? `**Original:** ${firstLong.trim()}\n\n**Sugestão:** Reescreva o trecho dividindo a ideia principal, explicitando o sujeito da ação e conectando causa, evidência e conclusão em frases menores.` : "Inclua trechos com argumentos completos para receber sugestões de reescrita mais específicas.";
  const density = paragraphs.length ? Math.round(clean.split(/\s+/).length / paragraphs.length) : 0;
  return `# Relatório de revisão — ${fileName ?? "TCC"}\n\n${reason ? `> Revisão gerada por análise local porque a IA não respondeu no momento (${reason}).\n\n` : ""}## 1. Visão geral\nO texto possui aproximadamente ${clean.split(/\s+/).filter(Boolean).length} palavras e ${paragraphs.length} parágrafos. A revisão local avaliou estrutura acadêmica, sinais de ABNT, clareza frasal, termos genéricos e possíveis problemas ortográficos objetivos.\n\n${density > 180 ? "Os parágrafos parecem longos; recomenda-se quebrá-los em blocos menores, com uma ideia central por parágrafo." : "A extensão média dos parágrafos parece administrável, mas ainda vale revisar se cada parágrafo apresenta uma ideia central clara."}\n\n## 2. Pontos fortes\n- O arquivo foi lido com sucesso e há conteúdo textual suficiente para revisão.\n- A análise identificou elementos estruturais e trechos que merecem atenção antes da entrega.\n- O relatório abaixo prioriza ajustes práticos de escrita, clareza e adequação acadêmica.\n\n## 3. Pontos a melhorar\n${missing.length ? missing.map((m) => `- Verifique se há uma seção explícita de **${m}** ou se ela precisa ser padronizada no documento.`).join("\n") : "- A estrutura básica esperada foi encontrada; revise a padronização dos títulos e a ordem das seções."}\n${foundWeak.length ? `\n- Reduza termos genéricos encontrados no texto: ${foundWeak.map((t) => `“${t}”`).join(", ")}. Prefira termos técnicos e evidências.` : "\n- Evite generalizações e sustente afirmações com autores, dados ou resultados."}\n\n## 4. Erros ortográficos e gramaticais\n| Trecho original | Correção sugerida | Motivo |\n|---|---|---|\n${issues.join("\n")}\n\n## 5. Sugestões de reescrita\n${rewrite}\n\n## 6. ABNT e estrutura\n- Confirme margens, fonte, espaçamento, numeração, sumário automático e títulos conforme o manual da instituição.\n- Garanta que toda citação direta ou indireta apareça nas referências e que todas as referências sejam citadas no texto.\n- Verifique capa, folha de rosto, resumo, palavras-chave, sumário, introdução, desenvolvimento, conclusão e referências.\n\n## 7. Próximos passos\n- Corrigir os itens da tabela de escrita.\n- Quebrar períodos longos e parágrafos extensos.\n- Substituir termos vagos por conceitos técnicos.\n- Conferir citações e referências em padrão ABNT.\n- Fazer uma última leitura em voz alta para encontrar repetições e falhas de coesão.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const { text, fileName } = await req.json();
    if (!text || typeof text !== "string") throw new Error("Texto do TCC ausente");
    const trimmed = text.slice(0, 60000); // reduz custo por revisão e evita payloads muito grandes

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ review: localReview(trimmed, fileName, "configuração indisponível"), fallback: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

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
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Arquivo: ${fileName ?? "tcc.txt"}\n\nConteúdo do TCC:\n\n${trimmed}` },
        ],
      }),
    });

    if (r.status === 429) return new Response(JSON.stringify({ review: localReview(trimmed, fileName, "limite temporário de requisições"), fallback: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    if (r.status === 402) return new Response(JSON.stringify({ review: localReview(trimmed, fileName, "saldo de IA não reconhecido pelo gateway"), fallback: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    if (!r.ok) return new Response(JSON.stringify({ review: localReview(trimmed, fileName, `serviço de IA indisponível (${r.status})`), fallback: true }), { headers: { ...cors, "Content-Type": "application/json" } });

    const data = await r.json();
    const review = data.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ review }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("review-tcc error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Erro" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});