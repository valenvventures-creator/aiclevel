import "server-only";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { db, newId, nowIso } from "@/server/db/store";
import { aiGateway } from "@/server/ai/gateway";
import { assembleExecutiveContext } from "@/server/ai/executives/context";
import { notify } from "@/server/notifications";
import type { Communication, Organization, Role } from "@/types/domain";

/**
 * Generates each addressed executive's reply to a communication thread.
 * Runs after the response is sent (next/server `after`). Bounded: one reply
 * per executive per message; executives never message each other in loops.
 */
export async function generateExecutiveReplies(args: { organization: Organization; userId: string; viewerRole: Role; communication: Communication }) {
  const orgId = args.organization.id;
  const d = db();
  const thread = await d.communications.list(orgId, { where: { thread_id: args.communication.thread_id }, orderBy: "created_at" });
  const transcript = thread.slice(-8).map((m) => `${m.sender_type === "USER" ? "Leadership" : "Executive"}: ${m.body}`).join("\n\n");
  const recipients = await AIExecutiveRegistry.resolveMany(orgId, args.communication.recipient_executive_ids);
  await Promise.all(
    recipients.map(async (exec) => {
      try {
        await d.executives.update(orgId, exec.id, { status: "WORKING" });
        const built = await assembleExecutiveContext({
          organization: args.organization,
          viewerRole: args.viewerRole,
          exec,
          query: `${args.communication.subject} ${args.communication.body}`,
          taskInstructions: `You are replying in Executive Comms (internal correspondence). Other recipients: ${recipients.filter((r) => r.id !== exec.id).map((r) => r.title).join(", ") || "none"}. Reply as a concise internal memo from your seat, signed with your title. Do not claim to have taken any external action.`,
        });
        const out = await aiGateway.generate({
          organizationId: orgId,
          userId: args.userId,
          executiveId: exec.id,
          executiveRole: exec.role_code,
          taskType: "comms_reply",
          system: built.system,
          messages: [{ role: "user", content: `Subject: ${args.communication.subject}\n\n${transcript}` }],
          modelPreference: { provider: exec.model.primary_provider, model: exec.model.primary_model, fallbackProvider: exec.model.fallback_provider, fallbackModel: exec.model.fallback_model, effort: "medium" },
          promptVersion: built.promptVersion,
        });
        const body = out.error ? `_${exec.title} could not complete a reply: ${out.error}_` : out.text;
        await d.communications.insert({
          id: newId(), organization_id: orgId, thread_id: args.communication.thread_id, subject: `Re: ${args.communication.subject.replace(/^Re:\s*/i, "")}`, body,
          sender_type: "EXECUTIVE", sender_id: exec.id, recipient_executive_ids: [], recipient_user_ids: [args.userId], is_draft: false, starred: false, archived: false,
          read_at: null, origin_type: null, origin_id: null, simulated: out.simulated, created_at: nowIso(),
        });
        await notify(orgId, args.userId, "comms.reply", "Executive response ready", `${exec.title} replied: ${args.communication.subject}`, `/comms?thread=${args.communication.thread_id}`);
      } catch (err) {
        console.error("[comms] reply failed", exec.role_code, err);
      } finally {
        await d.executives.update(orgId, exec.id, { status: "AVAILABLE" });
      }
    }),
  );
}
