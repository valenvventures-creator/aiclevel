import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { rateLimit } from "@/server/auth/rate-limit";
import { advanceProductionJob } from "@/server/studio/service";

/** Each call runs ONE bounded production step (well under the host's 60 s request limit). */
export const maxDuration = 60;

export async function POST(_: Request, { params }: RouteContext<"/api/studio/[id]/advance">) {
  try {
    const ctx = await authorize("studio.request");
    const { id } = await params;
    if (!rateLimit(`studio-step:${ctx.user.id}`, 40, 60_000).ok) return NextResponse.json({ state: "busy" }, { status: 429 });
    const result = await advanceProductionJob({ organization: ctx.organization, userId: ctx.user.id, viewerRole: ctx.role, jobId: id });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return apiError(err);
  }
}
