// Extrai texto de PDF, DOCX ou TXT no browser
export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return await file.text();
  }

  if (name.endsWith(".docx")) {
    // @ts-expect-error - sem types para o build browser
    const mammoth = await import("mammoth/mammoth.browser");
    const arrayBuffer = await file.arrayBuffer();
    const result = await (mammoth as any).extractRawText({ arrayBuffer });
    return result.value || "";
  }

  if (name.endsWith(".pdf")) {
    // @ts-expect-error - sem types para esse subpath
    const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
    // worker via CDN para evitar problemas de bundling
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let full = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((it: any) => it.str).join(" ");
      full += pageText + "\n\n";
    }
    return full;
  }

  throw new Error("Formato não suportado. Use PDF, DOCX ou TXT.");
}