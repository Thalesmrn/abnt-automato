// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

async function callAI(messages: any[]): Promise<string> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const { tccId, sectionKey, instruction, chapterIndex } = await req.json();
    if (!tccId || !sectionKey || !instruction) throw new Error("tccId, sectionKey e instruction são obrigatórios");

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Permissão: dono ou admin
    const { data: tcc, error: terr } = await admin.from("tccs").select("*").eq("id", tccId).single();
    if (terr || !tcc) throw new Error("TCC não encontrado");
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", ures.user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!roleRow;
    if (tcc.user_id !== ures.user.id && !isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const content = tcc.content ?? {};
    let originalText = "";
    if (sectionKey === "chapter" && typeof chapterIndex === "number") {
      originalText = content.chapters?.[chapterIndex]?.body ?? "";
    } else {
      originalText = content.sections?.[sectionKey] ?? "";
    }

    const sysAcad = `Você é um pesquisador acadêmico brasileiro. Reescreva o texto seguindo a instrução do usuário, mantendo formato acadêmico ABNT, português do Brasil, citações no formato (AUTOR, ANO), parágrafos separados por quebras duplas, sem markdown. Mantenha tamanho similar ao original, exceto se a instrução pedir para encurtar/alongar.`;

    const userMsg = `TEMA DO TCC: ${tcc.theme}
TÍTULO: ${tcc.title}
SEÇÃO: ${sectionKey}${typeof chapterIndex === "number" ? ` (capítulo ${chapterIndex + 1})` : ""}

INSTRUÇÃO DO USUÁRIO:
${instruction}

TEXTO ORIGINAL:
${originalText}

Retorne SOMENTE o novo texto reescrito, sem comentários ou explicações.`;

    const newText = (await callAI([
      { role: "system", content: sysAcad },
      { role: "user", content: userMsg },
    ])).trim();

    const newContent = JSON.parse(JSON.stringify(content));
    if (sectionKey === "chapter" && typeof chapterIndex === "number") {
      if (!newContent.chapters) newContent.chapters = [];
      if (!newContent.chapters[chapterIndex]) newContent.chapters[chapterIndex] = {};
      newContent.chapters[chapterIndex].body = newText;
    } else {
      if (!newContent.sections) newContent.sections = {};
      newContent.sections[sectionKey] = newText;
    }

    const { error: uerr } = await admin
      .from("tccs")
      .update({ content: newContent, updated_at: new Date().toISOString() })
      .eq("id", tccId);
    if (uerr) throw uerr;

    return new Response(JSON.stringify({ success: true, newText }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});