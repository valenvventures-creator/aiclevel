import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { db } from "@/server/db/store";
import { slugify } from "@/lib/utils";

export async function GET(_: Request, { params }: RouteContext<"/api/reports/[id]/export">) {
  try {
    const ctx = await authorize("reports.read");
    const { id } = await params;
    const r = await db().reports.get(ctx.organization.id, id);
    if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const head = `${r.simulated ? "<!-- Simulated demo content — not live A.I. output -->\n" : ""}<!-- ${r.report_type} · v${r.version} · ${r.created_at} -->\n\n`;
    return new NextResponse(head + r.content, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${slugify(r.title) || "report"}.md"`, "cache-control": "private, no-store" } });
  } catch (err) {
    return apiError(err);
  }
}
