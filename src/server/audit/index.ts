import "server-only";
import { dataMode } from "@/lib/env";
import { db, newId, nowIso } from "@/server/db/store";
import { supabaseAdmin } from "@/server/db/supabase";

export type AuditEvent =
  | "auth.login" | "auth.logout" | "auth.signup" | "auth.password_change" | "auth.password_reset" | "auth.login_failed"
  | "team.invite" | "team.invite_accepted" | "team.role_change" | "team.remove"
  | "org.create" | "org.update" | "constitution.update"
  | "executive.config_change" | "prompt.publish" | "provider.change" | "credential.change"
  | "memory.create" | "memory.edit" | "memory.verify" | "memory.delete" | "memory.archive"
  | "file.upload" | "file.delete"
  | "session.create" | "session.run" | "session.stop" | "report.create" | "report.export" | "report.delete" | "studio.job_create" | "studio.revision"
  | "approval.action" | "ceo_intelligence.change" | "comms.send"
  | "executive.feedback" | "executive.lesson" | "executive.library";

/** Append-only audit trail. Failures are logged loudly but never block the user action. */
export async function audit(
  organizationId: string | null,
  actorId: string | null,
  event_type: AuditEvent,
  entity_type: string,
  entity_id: string | null,
  metadata: Record<string, unknown> = {},
) {
  try {
    if (!organizationId && dataMode() === "supabase") {
      // Platform-level auth events (login, signup) are written with the service role and a null organization.
      await supabaseAdmin().from("audit_logs").insert({ organization_id: null, actor_id: actorId, event_type, entity_type, entity_id, metadata });
      return;
    }
    await db().audit.insert({
      id: newId(),
      organization_id: organizationId ?? "platform",
      actor_id: actorId,
      event_type,
      entity_type,
      entity_id,
      metadata,
      timestamp: nowIso(),
    });
  } catch (err) {
    console.error("[audit] failed to record event", event_type, err);
  }
}
