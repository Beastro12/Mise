import "server-only";

export type FileKind = "pdf" | "docx" | "text" | "image" | "unsupported";

export function detectFileKind(filename: string, mime: string): FileKind {
  const f = filename.toLowerCase();
  if (mime === "application/pdf" || f.endsWith(".pdf")) return "pdf";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || f.endsWith(".docx")) return "docx";
  if (mime.startsWith("text/") || f.endsWith(".txt") || f.endsWith(".md") || f.endsWith(".markdown")) return "text";
  if (mime.startsWith("image/")) return "image";
  return "unsupported";
}

export async function docxToText(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const res = await mammoth.extractRawText({ buffer: buf });
  return res.value;
}

export async function pdfToText(buf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}
