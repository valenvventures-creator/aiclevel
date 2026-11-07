import "server-only";
import { NextResponse } from "next/server";
import { exportFilename, parseMarkdown, type ExportDocument } from "./document";
import { renderPdf } from "./pdf";
import { renderDocx } from "./docx";

export const EXPORT_FORMATS = ["pdf", "docx", "md"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function parseFormat(value: string | null): ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value ?? "") ? (value as ExportFormat) : "pdf";
}

const MIME: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  md: "text/markdown; charset=utf-8",
};

/** Renders a document in the requested format as a private, non-cacheable download. */
export async function exportResponse(meta: Omit<ExportDocument, "blocks">, markdown: string, format: ExportFormat): Promise<NextResponse> {
  let body: Uint8Array | string;
  if (format === "md") {
    body = `${meta.simulated ? "<!-- Simulated demo content — not live A.I. output -->\n" : ""}# ${meta.title}\n\n_${meta.subtitle} · ${meta.organization}_\n\n${markdown}`;
  } else {
    const doc: ExportDocument = { ...meta, blocks: parseMarkdown(markdown) };
    body = format === "pdf" ? await renderPdf(doc) : await renderDocx(doc);
  }
  const filename = exportFilename(meta.title, format);
  return new NextResponse(typeof body === "string" ? body : Buffer.from(body), {
    headers: {
      "content-type": MIME[format],
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
