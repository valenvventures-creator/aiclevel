import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { audit } from "@/server/audit";
import { SHEET_MIME, writeSheet, type SheetFormat } from "@/server/crm/spreadsheet";
import { exportRows, type CrmEntity } from "@/server/crm/transfer";

/**
 * Export the contact database or the pipeline as CSV, TSV or Excel (.xlsx).
 * `?template=1` returns just the header row, to fill in and import.
 */
export async function GET(req: Request) {
  try {
    const ctx = await authorize("crm.transfer");
    const url = new URL(req.url);
    const entity: CrmEntity = url.searchParams.get("entity") === "deals" ? "deals" : "contacts";
    const f = url.searchParams.get("format");
    const format: SheetFormat = f === "xlsx" || f === "tsv" ? f : "csv";
    const template = url.searchParams.get("template") === "1";
    const rows = await exportRows(ctx.organization.id, entity, { template });
    const bytes = await writeSheet(format, rows, entity === "contacts" ? "Contacts" : "Deals");
    if (!template) await audit(ctx.organization.id, ctx.user.id, "crm.export", entity, null, { format, rows: rows.length - 1 });
    const name = `aiclevel-${entity}${template ? "-template" : `-${new Date().toISOString().slice(0, 10)}`}.${format}`;
    return new Response(new Blob([new Uint8Array(bytes)]), {
      headers: { "content-type": SHEET_MIME[format], "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
    });
  } catch (err) {
    return apiError(err);
  }
}
