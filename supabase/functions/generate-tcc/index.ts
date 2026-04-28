// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SIZE_CONFIG = {
  curto: { wordsPerSection: 450, chapters: 2 },
  medio: { wordsPerSection: 800, chapters: 3 },
  longo: { wordsPerSection: 1400, chapters: 4 },
};

async function callAI(messages: any[], json = false): Promise<string> {
  const body: any = {
    model: "google/gemini-2.5-flash",
    messages,
  };
  if (json) body.response_format = { type: "json_object" };

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AI ${r.status}: ${t}`);
  }
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function generateImage(prompt: string): Promise<string | null> {
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: `Diagrama acadêmico ilustrativo, estilo limpo, fundo branco, infográfico simples sobre: ${prompt}. Sem texto.` }],
        modalities: ["image", "text"],
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    return url ?? null;
  } catch (e) {
    console.error("img err", e);
    return null;
  }
}

function stripCodeFence(s: string): string {
  return s.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tccId } = await req.json();
    if (!tccId) throw new Error("tccId required");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: tcc, error } = await admin.from("tccs").select("*").eq("id", tccId).single();
    if (error || !tcc) throw new Error("TCC not found");

    await admin.from("tccs").update({ status: "generating", progress: 5, error_message: null }).eq("id", tccId);

    const cfg = SIZE_CONFIG[tcc.size as keyof typeof SIZE_CONFIG] ?? SIZE_CONFIG.medio;

    // 1. Outline
    const outlineRaw = await callAI([
      { role: "system", content: "Você é um orientador acadêmico brasileiro especialista em normas ABNT. Sempre responda em JSON válido em português do Brasil." },
      { role: "user", content: `Crie a estrutura de um TCC sobre "${tcc.theme}" (título: "${tcc.title}").
Retorne APENAS JSON com este formato exato:
{
  "resumo_keywords": ["palavra1","palavra2","palavra3","palavra4","palavra5"],
  "objetivo_geral": "texto",
  "objetivos_especificos": ["obj1","obj2","obj3","obj4"],
  "problema": "texto da pergunta de pesquisa",
  "justificativa_pontos": ["ponto1","ponto2","ponto3"],
  "capitulos_desenvolvimento": [
    {"titulo": "Título do Capítulo 1", "subtopicos": ["sub1","sub2","sub3"], "imagem_descricao": "descrição curta de uma figura ilustrativa"}
  ]
}
Inclua exatamente ${cfg.chapters} capítulos de desenvolvimento.` },
    ], true);

    const outline = JSON.parse(stripCodeFence(outlineRaw));
    await admin.from("tccs").update({ progress: 15 }).eq("id", tccId);

    // 2. Generate sections in parallel
    const sysAcad = `Você é um pesquisador acadêmico brasileiro. Escreva texto formal, em português do Brasil, seguindo normas ABNT, com citações no formato (AUTOR, ANO). Não use markdown, apenas parágrafos separados por quebras duplas. Aproximadamente ${cfg.wordsPerSection} palavras.`;

    const taskList = [
      { key: "resumo", prompt: `Escreva o RESUMO (em português) de um TCC sobre "${tcc.theme}" (título "${tcc.title}"). Objetivo: ${outline.objetivo_geral}. Problema: ${outline.problema}. Estrutura: contexto, objetivo, metodologia, resultados esperados, conclusão. Texto único, parágrafo único, ~250 palavras. Sem markdown.` },
      { key: "abstract", prompt: `Translate this Portuguese academic abstract to formal English (single paragraph, ~250 words) about "${tcc.theme}". Theme: ${outline.objetivo_geral}. No markdown.` },
      { key: "introducao", prompt: `Escreva a INTRODUÇÃO de um TCC sobre "${tcc.theme}". Aborde: contextualização do tema, problema de pesquisa (${outline.problema}), objetivo geral (${outline.objetivo_geral}), objetivos específicos (${outline.objetivos_especificos.join("; ")}), justificativa (${outline.justificativa_pontos.join("; ")}), e estrutura do trabalho. Use citações fictícias mas plausíveis no formato (SOBRENOME, ANO).` },
      { key: "referencial", prompt: `Escreva o REFERENCIAL TEÓRICO de um TCC sobre "${tcc.theme}". Aborde os principais autores, conceitos e teorias da área. Use diversas citações no formato (SOBRENOME, ANO) e citações diretas com aspas quando apropriado. Desenvolva ${Math.max(2, cfg.chapters)} subtemas relevantes.` },
      { key: "metodologia", prompt: `Escreva a METODOLOGIA de um TCC sobre "${tcc.theme}". Aborde: tipo de pesquisa (qualitativa/quantitativa/mista), natureza, abordagem, procedimentos técnicos, instrumentos de coleta de dados, universo e amostra, e técnicas de análise. Cite GIL, LAKATOS, MARCONI ou similares no formato (SOBRENOME, ANO).` },
      ...outline.capitulos_desenvolvimento.map((c: any, i: number) => ({
        key: `cap_${i}`,
        prompt: `Escreva o capítulo "${c.titulo}" de um TCC sobre "${tcc.theme}". Desenvolva os subtópicos: ${c.subtopicos.join("; ")}. Use citações (SOBRENOME, ANO) e dados/exemplos plausíveis. Inclua referências a uma figura ilustrativa (Figura ${i + 1}) sobre ${c.imagem_descricao}.`,
      })),
      { key: "resultados", prompt: `Escreva a seção RESULTADOS E DISCUSSÃO de um TCC sobre "${tcc.theme}". Apresente resultados plausíveis (com números, percentuais, exemplos), discuta-os à luz da literatura citada, com citações (SOBRENOME, ANO). Mencione a Tabela 1 com dados.` },
      { key: "conclusao", prompt: `Escreva as CONSIDERAÇÕES FINAIS de um TCC sobre "${tcc.theme}". Retome o objetivo (${outline.objetivo_geral}), sintetize os principais achados, aponte limitações e sugira pesquisas futuras. ~${Math.round(cfg.wordsPerSection * 0.6)} palavras.` },
      { key: "referencias", prompt: `Liste 15 referências bibliográficas REAIS e VERIFICÁVEIS no formato ABNT (NBR 6023) sobre "${tcc.theme}".

REGRAS OBRIGATÓRIAS — não invente nada:
1. Use APENAS obras que você tem certeza de que existem (livros clássicos da área, autores reconhecidos, artigos amplamente citados, normas ABNT, dissertações/teses já publicadas, manuais oficiais).
2. Priorize autores brasileiros consagrados da área e clássicos internacionais traduzidos.
3. Inclua de forma equilibrada:
   - Livros de metodologia científica reais (ex.: Antonio Carlos Gil — "Como Elaborar Projetos de Pesquisa", Atlas; Marina de Andrade Marconi e Eva Maria Lakatos — "Fundamentos de Metodologia Científica", Atlas; Pedro Demo; Minayo).
   - Livros e artigos clássicos específicos do tema "${tcc.theme}" — apenas autores e títulos que você conhece de verdade.
   - Quando incluir artigo de periódico, use revistas brasileiras reais (ex.: SciELO, Revista Brasileira de..., Cadernos de Saúde Pública, RAE, RAUSP, Educação & Sociedade) ou periódicos internacionais conhecidos.
   - Quando incluir documento oficial, use órgãos reais (IBGE, MEC, Ministério da Saúde, OMS, ABNT — NBR 6023:2018, NBR 14724:2011, NBR 10520:2023).

4. NÃO invente:
   - títulos de livros que não existam,
   - artigos com volume/número/páginas fictícios,
   - DOIs ou URLs. NÃO inclua links/URLs/DOIs nas referências — deixe apenas a referência textual.
   - editoras inexistentes ou cidades erradas para a editora.

5. Se tiver dúvida sobre a existência exata de uma obra, prefira não incluí-la e use outra que você conheça com segurança.

Formato exato (uma referência por linha, sem numeração, sem marcadores, sem markdown, ordenadas alfabeticamente pelo sobrenome):
SOBRENOME, Nome. Título da obra. Edição. Cidade: Editora, Ano.
SOBRENOME, Nome. Título do artigo. Nome da Revista, v. X, n. Y, p. ZZ-ZZ, Ano.

Retorne SOMENTE as 15 linhas de referências.` },
    ];

    const results = await Promise.all(
      taskList.map(async (t) => {
        const txt = await callAI([
          { role: "system", content: sysAcad },
          { role: "user", content: t.prompt },
        ]);
        return [t.key, txt.trim()] as const;
      })
    );
    const sections = Object.fromEntries(results);

    await admin.from("tccs").update({ progress: 70 }).eq("id", tccId);

    // 3. Generate images for each chapter
    const images = await Promise.all(
      outline.capitulos_desenvolvimento.map((c: any) => generateImage(c.imagem_descricao))
    );

    await admin.from("tccs").update({ progress: 90 }).eq("id", tccId);

    // 4. Generate a simple table of data for results
    const tableRaw = await callAI([
      { role: "system", content: "Responda apenas em JSON válido." },
      { role: "user", content: `Gere uma tabela plausível de dados para a seção de resultados de um TCC sobre "${tcc.theme}". JSON:
{"titulo":"Título descritivo da tabela","headers":["Coluna 1","Coluna 2","Coluna 3"],"rows":[["a","b","c"],["d","e","f"],["g","h","i"],["j","k","l"]],"fonte":"Elaborado pelo autor (${tcc.year ?? new Date().getFullYear()})"}` },
    ], true);
    const table = JSON.parse(stripCodeFence(tableRaw));

    const content = {
      outline,
      sections,
      chapters: outline.capitulos_desenvolvimento.map((c: any, i: number) => ({
        ...c,
        body: sections[`cap_${i}`],
        image: images[i],
      })),
      table,
    };

    await admin
      .from("tccs")
      .update({ status: "done", progress: 100, content, updated_at: new Date().toISOString() })
      .eq("id", tccId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-tcc error", e);
    try {
      const { tccId } = await req.clone().json();
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await admin.from("tccs").update({ status: "error", error_message: String(e) }).eq("id", tccId);
    } catch {}
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});