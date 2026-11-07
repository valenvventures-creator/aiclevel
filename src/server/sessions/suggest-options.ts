import "server-only";
import { aiGateway } from "@/server/ai/gateway";
import { fill, PromptRegistry } from "@/server/ai/prompts/registry";
import { assembleExecutiveContext } from "@/server/ai/executives/context";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { db } from "@/server/db/store";
import type { Organization, Role } from "@/types/domain";

export interface SuggestedOptions { options: { id: string; label: string }[]; simulated: boolean; error?: string }

/** Reads "A: <option>" lines (2–6, lettered in order); anything else is ignored. */
export function parseSuggestedOptions(text: string): { id: string; label: string }[] {
  const labels: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(?:[-*]\s*)?(?:\*\*)?(?:option\s+)?[A-F](?:\*\*)?\s*[:.)\u2013\u2014-]\s*(.+)$/i);
    const label = m?.[1].replace(/\*\*/g, "").trim();
    if (label) labels.push(label.slice(0, 200));
  }
  return labels.slice(0, 6).map((label, i) => ({ id: String.fromCharCode(65 + i), label }));
}

/** The session chair drafts ballot options for a question (fast utility model, through the gateway). */
export async function suggestVoteOptions(args: { organization: Organization; userId: string; viewerRole: Role; sessionId: string; question: string }): Promise<SuggestedOptions> {
  const orgId = args.organization.id;
  const session = await db().sessions.get(orgId, args.sessionId);
  if (!session) return { options: [], simulated: false, error: "Session not found." };
  const chairId = session.chair_executive_id ?? (await AIExecutiveRegistry.getByRole(orgId, "CEO"))?.id ?? "";
  const chair = await AIExecutiveRegistry.resolve(orgId, chairId);
  if (!chair) return { options: [], simulated: false, error: "No chair is available for this session." };
  const template = await PromptRegistry.resolve(orgId, "suggest_vote_options");
  const task = fill(template.content, { objective: session.objective, question: args.question });
  const built = await assembleExecutiveContext({ organization: args.organization, viewerRole: args.viewerRole, exec: chair, query: `${session.objective} ${args.question}`, taskInstructions: task });
  const out = await aiGateway.generate({
    organizationId: orgId,
    userId: args.userId,
    executiveId: chair.id,
    executiveRole: chair.role_code,
    taskType: "vote_options",
    system: built.system,
    messages: [{ role: "user", content: args.question }],
    promptVersion: template.versionTag,
  });
  if (out.error && !out.text.trim()) return { options: [], simulated: out.simulated, error: "Options could not be suggested right now. Please enter them yourself." };
  const options = parseSuggestedOptions(out.text);
  if (options.length < 2) return { options: [], simulated: out.simulated, error: "No usable options came back. Please enter them yourself." };
  return { options, simulated: out.simulated };
}
