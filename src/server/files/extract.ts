import "server-only";

/**
 * Plain-text extraction for uploaded documents, so executives can read them
 * (Executive Library, C-Level Memory, session attachments).
 *
 * Supported: TXT, MD, CSV, PDF, DOCX, PPTX, XLSX. Images, audio and video
 * have no text to extract. Returns null when a format has no text or the
 * document cannot be read; extraction never throws.
 */
export const MAX_EXTRACTED_CHARS = 200_000;
const EXTRACT_TIMEOUT_MS = 20_000;

export const EXTRACTABLE = ["txt", "md", "csv", "pdf", "docx", "pptx", "xlsx"] as const;

export function canExtract(ext: string): boolean {
  return (EXTRACTABLE as readonly string[]).includes(ext);
}

export async function extractText(ext: string, bytes: Uint8Array): Promise<string | null> {
  if (!canExtract(ext)) return null;
  try {
    const text = await Promise.race([extract(ext, bytes), new Promise<null>((r) => setTimeout(() => r(null), EXTRACT_TIMEOUT_MS))]);
    const clean = text ? tidy(text) : "";
    return clean ? clean.slice(0, MAX_EXTRACTED_CHARS) : null;
  } catch {
    return null;
  }
}

async function extract(ext: string, bytes: Uint8Array): Promise<string | null> {
  switch (ext) {
    case "txt":
    case "md":
    case "csv":
      return new TextDecoder().decode(bytes);
    case "pdf": {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await pdfText(pdf, { mergePages: false });
      return (Array.isArray(text) ? text : [text]).join("\n\n");
    }
    case "docx": {
      const mammoth = (await import("mammoth")).default;
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return value;
    }
    case "pptx":
      return pptxText(bytes);
    case "xlsx":
      return xlsxText(bytes);
    default:
      return null;
  }
}

async function zip(bytes: Uint8Array) {
  const JSZip = (await import("jszip")).default;
  return JSZip.loadAsync(bytes);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()] ?? "",
  );
}

/** Text runs (<a:t>) of each slide, in slide order, one paragraph per line. */
async function pptxText(bytes: Uint8Array): Promise<string> {
  const z = await zip(bytes);
  const slides = Object.keys(z.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
  const out: string[] = [];
  for (const [i, name] of slides.entries()) {
    const xml = await z.file(name)!.async("string");
    const paras = xml.split(/<\/a:p>/).map((p) => [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1])).join("")).filter((p) => p.trim());
    if (paras.length) out.push(`Slide ${i + 1}\n${paras.join("\n")}`);
  }
  return out.join("\n\n");
}

/** Each worksheet as tab-separated rows (shared strings and inline values). */
async function xlsxText(bytes: Uint8Array): Promise<string> {
  const z = await zip(bytes);
  const sharedXml = (await z.file("xl/sharedStrings.xml")?.async("string")) ?? "";
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => decodeXml(t[1])).join(""));
  const workbook = (await z.file("xl/workbook.xml")?.async("string")) ?? "";
  const names = [...workbook.matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) => decodeXml(m[1]));
  const sheets = Object.keys(z.files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
  const out: string[] = [];
  for (const [i, name] of sheets.entries()) {
    const xml = await z.file(name)!.async("string");
    const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) =>
      [...r[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
        .map((c) => {
          const attrs = c[1];
          const inner = c[2] ?? "";
          const v = /<v>([^<]*)<\/v>/.exec(inner)?.[1];
          if (/t="s"/.test(attrs)) return v !== undefined ? shared[Number(v)] ?? "" : "";
          if (/t="inlineStr"/.test(attrs)) return [...inner.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => decodeXml(t[1])).join("");
          return v !== undefined ? decodeXml(v) : "";
        })
        .join("\t")
        .replace(/\t+$/, ""),
    ).filter((r) => r.trim());
    if (rows.length) out.push(`Sheet: ${names[i] ?? `Sheet ${i + 1}`}\n${rows.join("\n")}`);
  }
  return out.join("\n\n");
}

/** Normalizes line endings and collapses runs of blank lines and spaces. */
function tidy(s: string): string {
  return s.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").replace(/[ \t ]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
