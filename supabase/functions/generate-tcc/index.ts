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

// ===== Real references via OpenAlex + CrossRef =====
const MESES_PT = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
function dataAcessoHoje(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")} ${MESES_PT[d.getMonth()]} ${d.getFullYear()}`;
}
function splitAuthor(full: string): { sobrenome: string; nomes: string } {
  const clean = (full || "").trim().replace(/\s+/g, " ");
  if (!clean) return { sobrenome: "AUTOR DESCONHECIDO", nomes: "" };
  const parts = clean.split(" ");
  const sobrenome = parts.pop()!.toUpperCase();
  return { sobrenome, nomes: parts.join(" ") };
}
function formatAuthors(authors: string[]): string {
  if (!authors.length) return "AUTOR DESCONHECIDO";
  const fmt = (a: string) => {
    const { sobrenome, nomes } = splitAuthor(a);
    return nomes ? `${sobrenome}, ${nomes}` : sobrenome;
  };
  if (authors.length === 1) return fmt(authors[0]);
  if (authors.length <= 3) return authors.map(fmt).join("; ");
  return `${fmt(authors[0])} et al.`;
}
function formatAbnt(ref: {
  authors: string[];
  year?: number | string;
  title: string;
  venue?: string;
  volume?: string | number;
  issue?: string | number;
  pages?: string;
  doi?: string;
  url?: string;
}): string {
  const autores = formatAuthors(ref.authors);
  const ano = ref.year ?? "s.d.";
  const titulo = (ref.title || "Sem título").trim().replace(/\s+/g, " ");
  let s = `${autores}. ${titulo}. `;
  if (ref.venue) {
    s += `${ref.venue}`;
    if (ref.volume) s += `, v. ${ref.volume}`;
    if (ref.issue) s += `, n. ${ref.issue}`;
    if (ref.pages) s += `, p. ${ref.pages}`;
    s += `, ${ano}.`;
  } else {
    s += `${ano}.`;
  }
  const link = ref.doi ? `https://doi.org/${ref.doi.replace(/^https?:\/\/doi\.org\//, "")}` : ref.url;
  if (link) s += ` Disponível em: ${link}. Acesso em: ${dataAcessoHoje()}.`;
  return s;
}

async function fetchOpenAlex(theme: string, perPage = 12): Promise<any[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(theme)}&per-page=${perPage}&sort=cited_by_count:desc&filter=has_doi:true`;
    const r = await fetch(url, { headers: { "User-Agent": "tcc-generator (mailto:contato@example.com)" } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.results || []).map((w: any) => ({
      authors: (w.authorships || []).map((a: any) => a.author?.display_name).filter(Boolean),
      year: w.publication_year,
      title: w.title,
      venue: w.primary_location?.source?.display_name || w.host_venue?.display_name,
      volume: w.biblio?.volume,
      issue: w.biblio?.issue,
      pages: w.biblio?.first_page && w.biblio?.last_page ? `${w.biblio.first_page}-${w.biblio.last_page}` : undefined,
      doi: w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//, "") : undefined,
      url: w.primary_location?.landing_page_url || w.id,
    }));
  } catch (e) {
    console.error("openalex err", e);
    return [];
  }
}
async function fetchCrossRef(theme: string, rows = 8): Promise<any[]> {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(theme)}&rows=${rows}&sort=is-referenced-by-count&order=desc`;
    const r = await fetch(url, { headers: { "User-Agent": "tcc-generator (mailto:contato@example.com)" } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.message?.items || []).map((it: any) => ({
      authors: (it.author || []).map((a: any) => `${a.given ?? ""} ${a.family ?? ""}`.trim()).filter(Boolean),
      year: it.issued?.["date-parts"]?.[0]?.[0],
      title: Array.isArray(it.title) ? it.title[0] : it.title,
      venue: Array.isArray(it["container-title"]) ? it["container-title"][0] : it["container-title"],
      volume: it.volume,
      issue: it.issue,
      pages: it.page,
      doi: it.DOI,
      url: it.URL,
    }));
  } catch (e) {
    console.error("crossref err", e);
    return [];
  }
}
function dedupeRefs(refs: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const r of refs) {
    const key = (r.doi || r.title || "").toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (r.title && r.authors?.length) out.push(r);
  }
  return out;
}
async function buildRealReferences(theme: string): Promise<{ text: string; citations: { sobrenome: string; ano: string | number }[] }> {
  const [oa, cr] = await Promise.all([fetchOpenAlex(theme, 12), fetchCrossRef(theme, 8)]);
  const all = dedupeRefs([...oa, ...cr]).slice(0, 15);
  if (all.length === 0) return { text: "", citations: [] };
  const formatted = all.map(formatAbnt).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const citations = all.map((r) => {
    const { sobrenome } = splitAuthor(r.authors[0] || "");
    return { sobrenome: sobrenome.charAt(0) + sobrenome.slice(1).toLowerCase(), ano: r.year ?? "s.d." };
  });
  return { text: formatted.join("\n"), citations };
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

    // 1.5 Fetch REAL references from OpenAlex + CrossRef
    const realRefs = await buildRealReferences(tcc.theme);
    const citationPool = realRefs.citations.length
      ? realRefs.citations.map((c) => `(${c.sobrenome}, ${c.ano})`).join(", ")
      : "";
    const citationInstr = citationPool
      ? `Use SOMENTE citações no formato (Sobrenome, Ano) escolhidas EXCLUSIVAMENTE desta lista de autores reais já presentes nas referências do trabalho: ${citationPool}. Não invente outros autores.`
      : `Use citações no formato (Sobrenome, Ano) com autores plausíveis.`;
    await admin.from("tccs").update({ progress: 20 }).eq("id", tccId);

    // 2. Generate sections in parallel
    const sysAcad = `Você é um pesquisador acadêmico brasileiro. Escreva texto formal, em português do Brasil, seguindo normas ABNT. ${citationInstr} NUNCA inclua, ao final da seção, blocos como "Referências", "Referências Bibliográficas", "Bibliografia" ou listas de obras completas — a lista de referências completa só aparecerá em uma seção dedicada do TCC. Não use markdown, apenas parágrafos separados por quebras duplas. Aproximadamente ${cfg.wordsPerSection} palavras.`;

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

    // Override referencias with real data when available
    if (realRefs.text) {
      sections.referencias = realRefs.text;
    } else {
      // Fallback: ask the AI as before
      sections.referencias = await callAI([
        { role: "system", content: sysAcad },
        { role: "user", content: `Liste 15 referências reais em formato ABNT sobre "${tcc.theme}". Uma por linha, sem numeração, ordenadas alfabeticamente. Inclua apenas obras que você tem certeza de existir.` },
      ]);
    }

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