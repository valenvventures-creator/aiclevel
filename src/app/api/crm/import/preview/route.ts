import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { rateLimit } from "@/server/auth/rate-limit";
import { CRM_LIMITS } from "@/config/crm";
import { formatFromFilename, readSheet } from "@/server/crm/spreadsheet";
import { suggestMapping, type CrmEntity } from "@/server/crm/transfer";

/**
 * Step 1 of a CRM import: read the uploaded spreadsheet (CSV, TSV or XLSX) and
 * return its columns, rows and a suggested column → field mapping. Nothing is
 * saved until the commit step.
 */
export async function POST(req: Request) {
  try {
    const ctx = await authorize("crm.transfer");
    if (!rateLimit(`crm-import:${ctx.user.id}`, 30, 60 * 60_000).ok) return NextResponse.json({ error: "Too many imports. Try again later." }, { status: 429 });
    const form = await req.formData();
    const file = form.get("file");
    const entity: CrmEntity = form.get("entity") === "deals" ? "deals" : "contacts";
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a spreadsheet to import." }, { status: 400 });
    if (file.size > CRM_LIMITS.IMPORT_BYTES) return NextResponse.json({ error: "Spreadsheets must be 5 MB or smaller." }, { status: 413 });
    const format = formatFromFilename(file.name);
    if (!format) return NextResponse.json({ error: "Use a CSV, TSV or Excel (.xlsx) file." }, { status: 400 });
    let rows;
    try {
      rows = await readSheet(format, new Uint8Array(await file.arrayBuffer()));
    } catch {
      return NextResponse.json({ error: "That file could not be read. Save it again as CSV or Excel (.xlsx) and retry." }, { status: 422 });
    }
    if (rows.length < 2) return NextResponse.json({ error: "The spreadsheet needs a header row and at least one data row." }, { status: 422 });
    const headers = rows[0].map((h) => h.trim());
    const width = Math.max(headers.length, ...rows.slice(1, 50).map((r) => r.length));
    while (headers.length < width) headers.push(`Column ${headers.length + 1}`);
    const data = rows.slice(1, CRM_LIMITS.IMPORT_ROWS + 1).map((r) => headers.map((_, i) => (r[i] ?? "").slice(0, 5000)));
    return NextResponse.json({ entity, filename: file.name, headers, rows: data, total: rows.length - 1, truncated: rows.length - 1 > CRM_LIMITS.IMPORT_ROWS, mapping: suggestMapping(headers, entity) });
  } catch (err) {
    return apiError(err);
  }
}
