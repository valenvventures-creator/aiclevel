import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { audit } from "@/server/audit";
import { CRM_LIMITS } from "@/config/crm";
import { columnsFor, importRows } from "@/server/crm/transfer";

const Body = z.object({
  entity: z.enum(["contacts", "deals"]),
  headers: z.array(z.string().max(200)).min(1).max(100),
  rows: z.array(z.array(z.string().max(5000)).max(100)).min(1).max(CRM_LIMITS.IMPORT_ROWS),
  mapping: z.array(z.string().max(40)).max(100),
  duplicates: z.enum(["skip", "update"]).default("skip"),
});

/** Step 2 of a CRM import: validate every row with the chosen mapping and save. */
export async function POST(req: Request) {
  try {
    const ctx = await authorize("crm.transfer");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "The import request was incomplete. Start the import again." }, { status: 400 });
    const b = parsed.data;
    const keys = new Set(columnsFor(b.entity).map((c) => c.key));
    if (b.mapping.some((m) => m && !keys.has(m))) return NextResponse.json({ error: "Unknown field in the column mapping." }, { status: 400 });
    if (new Set(b.mapping.filter(Boolean)).size !== b.mapping.filter(Boolean).length) return NextResponse.json({ error: "Each field can be matched to only one column." }, { status: 400 });
    const required = b.entity === "contacts" ? b.mapping.includes("last_name") || b.mapping.includes("full_name") : b.mapping.includes("name");
    if (!required) return NextResponse.json({ error: b.entity === "contacts" ? "Match a column to Last Name (or Full Name)." : "Match a column to Deal Name." }, { status: 400 });

    const result = await importRows(ctx.organization.id, ctx.user.id, b);
    await audit(ctx.organization.id, ctx.user.id, "crm.import", b.entity, null, { rows: b.rows.length, created: result.created, updated: result.updated, skipped: result.skipped });
    revalidatePath("/crm");
    revalidatePath("/crm/contacts");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return apiError(err);
  }
}
