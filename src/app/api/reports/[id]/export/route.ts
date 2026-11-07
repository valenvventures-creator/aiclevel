import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { audit } from "@/server/audit";
import { exportResponse, parseFormat } from "@/server/export/service";

/** GET /api/reports/[id]/export?format=pdf|docx|md — branded, authorized download. */
export async function GET(req: Request, { params }: RouteContext<"/api/reports/[id]/export">) {
  try {
    const ctx = await authorize("reports.read");
    const { id } = await params;
    const format = parseFormat(new URL(req.url).searchParams.get("format"));
    const r = await db().reports.get(ctx.organization.id, id);
    if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const execs = new Map((await AIExecutiveRegistry.getAllExecutives(ctx.organization.id)).map((e) => [e.id, e.title]));
    await audit(ctx.organization.id, ctx.user.id, "report.export", "report", r.id, { format });
    return exportResponse(
      {
        title: r.title,
        subtitle: `${r.report_type} · Version ${r.version}`,
        organization: ctx.organization.name,
        leadExecutive: execs.get(r.lead_executive_id) ?? null,
        contributors: r.contributing_executive_ids.map((c) => execs.get(c)).filter((t): t is string => Boolean(t)),
        createdAt: r.created_at,
        simulated: r.simulated,
      },
      r.content,
      format,
    );
  } catch (err) {
    return apiError(err);
  }
}
