import "server-only";
import { db, newId, nowIso } from "@/server/db/store";

export async function notify(organizationId: string, userId: string, type: string, title: string, message: string, target_url: string | null) {
  try {
    await db().notifications.insert({ id: newId(), organization_id: organizationId, user_id: userId, type, title, message, target_url, read_at: null, created_at: nowIso() });
  } catch (err) {
    console.error("[notifications] failed", err);
  }
}
