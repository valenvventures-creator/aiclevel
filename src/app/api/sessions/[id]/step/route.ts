import { NextResponse } from "next/server";
import { apiError, ndjson } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { advanceSessionRun } from "@/server/ai/orchestration/csuite-orchestrator";
import { rateLimit } from "@/server/auth/rate-limit";

/** Each call runs ONE bounded step of the current round (well under the host's 60 s request limit), streamed as NDJSON. */
export const maxDuration = 60;

export async function POST(req: Request, { params }: RouteContext<"/api/sessions/[id]/step">) {
  try {
    const ctx = await authorize("sessions.create");
    const { id } = await params;
    if (!rateLimit(`session-step:${ctx.user.id}`, 60, 60_000).ok) return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
    const abort = new AbortController();
    req.signal.addEventListener("abort", () => abort.abort());
    const gen = advanceSessionRun({ organization: ctx.organization, userId: ctx.user.id, viewerRole: ctx.role, sessionId: id, signal: abort.signal });
    return ndjson(gen, () => abort.abort());
  } catch (err) {
    return apiError(err);
  }
}
