import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";

// @ts-ignore
pdfMake.vfs = (pdfFonts as any).vfs ?? (pdfFonts as any).pdfMake?.vfs;

// ABNT: Times New Roman 12, espaço 1.5, margens 3/2/3/2cm, recuo 1.25cm
// pdfmake default font is Roboto; we use Times-like serif via built-in Times
pdfMake.fonts = {
  Times: {
    normal: "Times-Roman",
    bold: "Times-Bold",
    italics: "Times-Italic",
    bolditalics: "Times-BoldItalic",
  },
};

export interface TccData {
  title: string;
  theme: string;
  author_name?: string | null;
  institution?: string | null;
  course?: string | null;
  advisor?: string | null;
  city?: string | null;
  year?: number | null;
  content: any;
}

const CM = 28.346; // 1 cm in pt
const LH = 1.5;

function paragraphs(text: string, indent = true): Content[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({
      text: p,
      alignment: "justify",
      lineHeight: LH,
      margin: [indent ? CM * 1.25 : 0, 0, 0, 6] as [number, number, number, number],
      preserveLeadingSpaces: false,
      leadingIndent: 0,
    }));
}

function sectionTitle(num: string, title: string, level = 1): Content {
  return {
    text: `${num} ${title.toUpperCase()}`,
    bold: true,
    fontSize: level === 1 ? 14 : 12,
    margin: [0, 18, 0, 12],
    pageBreak: level === 1 ? "before" : undefined,
  };
}

function unnumberedTitle(title: string, pageBreak = true): Content {
  return {
    text: title.toUpperCase(),
    bold: true,
    fontSize: 14,
    alignment: "center",
    margin: [0, 0, 0, 24],
    pageBreak: pageBreak ? "before" : undefined,
  };
}

export async function generateAbntPdf(t: TccData): Promise<void> {
  const c = t.content || {};
  const year = t.year ?? new Date().getFullYear();
  const author = t.author_name || "AUTOR";
  const institution = t.institution || "INSTITUIÇÃO DE ENSINO";
  const course = t.course || "Curso";
  const advisor = t.advisor || "Orientador(a)";
  const city = t.city || "Cidade";

  const cover: Content[] = [
    { text: institution.toUpperCase(), alignment: "center", bold: true, fontSize: 12 },
    { text: course.toUpperCase(), alignment: "center", fontSize: 12, margin: [0, 4, 0, 0] },
    { text: author.toUpperCase(), alignment: "center", fontSize: 12, margin: [0, 120, 0, 0] },
    { text: t.title, alignment: "center", bold: true, fontSize: 14, margin: [0, 140, 0, 0] },
    { text: city.toUpperCase(), alignment: "center", fontSize: 12, margin: [0, 200, 0, 0], absolutePosition: undefined },
    { text: String(year), alignment: "center", fontSize: 12, margin: [0, 4, 0, 0] },
  ];

  const folha: Content[] = [
    { text: author.toUpperCase(), alignment: "center", bold: true, fontSize: 12, pageBreak: "before" },
    { text: t.title, alignment: "center", bold: true, fontSize: 14, margin: [0, 100, 0, 0] },
    {
      text: `Trabalho de Conclusão de Curso apresentado ao curso de ${course} da ${institution} como requisito parcial para obtenção do título de graduado(a).`,
      alignment: "justify",
      margin: [CM * 7, 80, 0, 0],
      lineHeight: 1.2,
    },
    {
      text: `Orientador(a): ${advisor}`,
      alignment: "justify",
      margin: [CM * 7, 12, 0, 0],
    },
    { text: city.toUpperCase(), alignment: "center", fontSize: 12, margin: [0, 200, 0, 0] },
    { text: String(year), alignment: "center", fontSize: 12, margin: [0, 4, 0, 0] },
  ];

  const resumo: Content[] = [
    unnumberedTitle("Resumo"),
    ...paragraphs(c.sections?.resumo || "", false),
    {
      text: [
        { text: "Palavras-chave: ", bold: true },
        { text: (c.outline?.resumo_keywords || []).join("; ") + "." },
      ],
      margin: [0, 12, 0, 0],
      alignment: "justify",
    },
  ];

  const abstract: Content[] = [
    unnumberedTitle("Abstract"),
    ...paragraphs(c.sections?.abstract || "", false),
    {
      text: [
        { text: "Keywords: ", bold: true, italics: true },
        { text: (c.outline?.resumo_keywords || []).join("; ") + ".", italics: true },
      ],
      margin: [0, 12, 0, 0],
      alignment: "justify",
    },
  ];

  // Sumário (manual, simples)
  const tocItems: Content[] = [];
  const pushToc = (num: string, title: string) =>
    tocItems.push({
      columns: [
        { text: `${num} ${title.toUpperCase()}`, width: "*" },
        { text: "", width: "auto" },
      ],
      margin: [0, 0, 0, 6],
    });
  pushToc("1", "Introdução");
  pushToc("2", "Referencial Teórico");
  pushToc("3", "Metodologia");
  (c.chapters || []).forEach((ch: any, i: number) => pushToc(`${4 + i}`, ch.titulo || `Capítulo ${i + 1}`));
  const numResultados = 4 + (c.chapters?.length || 0);
  pushToc(String(numResultados), "Resultados e Discussão");
  pushToc(String(numResultados + 1), "Considerações Finais");
  tocItems.push({ text: "REFERÊNCIAS", bold: true, margin: [0, 6, 0, 0] });

  const sumario: Content[] = [unnumberedTitle("Sumário"), ...tocItems];

  const intro: Content[] = [sectionTitle("1", "Introdução"), ...paragraphs(c.sections?.introducao || "")];
  const ref: Content[] = [sectionTitle("2", "Referencial Teórico"), ...paragraphs(c.sections?.referencial || "")];
  const met: Content[] = [sectionTitle("3", "Metodologia"), ...paragraphs(c.sections?.metodologia || "")];

  const chapters: Content[] = [];
  (c.chapters || []).forEach((ch: any, i: number) => {
    chapters.push(sectionTitle(String(4 + i), ch.titulo || `Capítulo ${i + 1}`));
    chapters.push(...paragraphs(ch.body || ""));
    if (ch.image) {
      chapters.push({ text: `Figura ${i + 1} – ${ch.imagem_descricao || ch.titulo}`, alignment: "center", fontSize: 10, margin: [0, 12, 0, 4] });
      chapters.push({ image: ch.image, width: 380, alignment: "center" });
      chapters.push({ text: `Fonte: Elaborado pelo autor (${year}).`, alignment: "center", fontSize: 10, margin: [0, 4, 0, 12] });
    }
  });

  // Resultados + tabela
  const resultados: Content[] = [
    sectionTitle(String(numResultados), "Resultados e Discussão"),
    ...paragraphs(c.sections?.resultados || ""),
  ];
  if (c.table) {
    resultados.push({ text: `Tabela 1 – ${c.table.titulo}`, alignment: "center", fontSize: 10, margin: [0, 12, 0, 4] });
    resultados.push({
      table: {
        headerRows: 1,
        widths: c.table.headers.map(() => "*"),
        body: [
          c.table.headers.map((h: string) => ({ text: h, bold: true, alignment: "center" })),
          ...c.table.rows.map((r: string[]) => r.map((cell) => ({ text: cell, alignment: "center" }))),
        ],
      },
      layout: "lightHorizontalLines",
    });
    resultados.push({ text: `Fonte: ${c.table.fonte}`, alignment: "center", fontSize: 10, margin: [0, 4, 0, 12] });
  }

  const conclusao: Content[] = [
    sectionTitle(String(numResultados + 1), "Considerações Finais"),
    ...paragraphs(c.sections?.conclusao || ""),
  ];

  const referencias: Content[] = [
    unnumberedTitle("Referências"),
    ...((c.sections?.referencias || "")
      .split("\n")
      .map((l: string) => l.trim())
      .filter(Boolean)
      .map((l: string) => ({
        text: l,
        alignment: "justify",
        margin: [0, 0, 0, 6] as [number, number, number, number],
        lineHeight: 1.0,
      }))),
  ];

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [CM * 3, CM * 3, CM * 2, CM * 2],
    defaultStyle: { font: "Times", fontSize: 12, lineHeight: LH },
    content: [
      ...cover,
      ...folha,
      ...resumo,
      ...abstract,
      ...sumario,
      ...intro,
      ...ref,
      ...met,
      ...chapters,
      ...resultados,
      ...conclusao,
      ...referencias,
    ],
    footer: (currentPage, pageCount) => {
      // ABNT: numeração só a partir da introdução, mas mantemos simples no canto superior direito
      if (currentPage <= 5) return "";
      return { text: String(currentPage), alignment: "right", margin: [0, 10, CM * 2, 0], fontSize: 10 };
    },
  };

  const safeName = t.title.replace(/[^a-zA-Z0-9-_ ]/g, "").slice(0, 60).trim() || "TCC";
  pdfMake.createPdf(docDefinition).download(`${safeName}.pdf`);
}