import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { audit } from "@/server/audit";
import { exportResponse, parseFormat } from "@/server/export/service";

/** GET /api/studio/[id]/export?v=&format=pdf|docx|md — export a version of Finished Work. */
export async function GET(req: Request, { params }: RouteContext<"/api/studio/[id]/export">) {
  try {
    const ctx = await authorize("reports.read");
    const { id } = await params;
    const url = new URL(req.url);
    const v = Number(url.searchParams.get("v") ?? "0");
    const format = parseFormat(url.searchParams.get("format"));
    const job = await db().productionJobs.get(ctx.organization.id, id);
    if (!job) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const arts = await db().artifacts.list(ctx.organization.id, { where: { job_id: id }, orderBy: "version", desc: true });
    const art = arts.find((a) => a.version === v) ?? arts[0];
    if (!art) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const execs = new Map((await AIExecutiveRegistry.getAllExecutives(ctx.organization.id)).map((e) => [e.id, e.title]));
    await audit(ctx.organization.id, ctx.user.id, "report.export", "production_job", job.id, { format, version: art.version });
    return exportResponse(
      {
        title: job.title,
        subtitle: `${job.artifact_type} · Version ${art.version}`,
        organization: ctx.organization.name,
        leadExecutive: execs.get(job.lead_executive_id) ?? null,
        contributors: job.contributor_executive_ids.map((c) => execs.get(c)).filter((t): t is string => Boolean(t)),
        createdAt: art.created_at,
        simulated: art.simulated,
      },
      art.content,
      format,
    );
  } catch (err) {
    return apiError(err);
  }
}
