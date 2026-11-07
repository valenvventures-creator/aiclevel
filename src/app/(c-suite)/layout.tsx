import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/shell/app-shell";
import { dataMode } from "@/lib/env";
import { logoutAction } from "@/server/auth/actions";
import { ORG_COOKIE } from "@/server/auth/session";
import { ensureDemoSeeded } from "@/server/db/demo-seed";
import { db, nowIso } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { listMembershipsForUser, requireContext } from "@/server/organizations/service";
import { providerStatus } from "@/server/ai/gateway";

async function switchOrgAction(fd: FormData) {
  "use server";
  const ctx = await requireContext();
  const target = String(fd.get("organization_id") ?? "");
  const memberships = await listMembershipsForUser(ctx.user.id);
  if (!memberships.some((m) => m.organization.id === target)) return; // never trust the browser
  (await cookies()).set(ORG_COOKIE, target, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/hq");
}

async function markNotificationsReadAction() {
  "use server";
  const ctx = await requireContext();
  const d = db();
  const unread = await d.notifications.list(ctx.organization.id, { where: { user_id: ctx.user.id, read_at: null } });
  await Promise.all(unread.map((n) => d.notifications.update(ctx.organization.id, n.id, { read_at: nowIso() })));
  revalidatePath("/", "layout");
}

export default async function CSuiteLayout({ children }: { children: React.ReactNode }) {
  await ensureDemoSeeded();
  const ctx = await requireContext();
  if (!ctx.user.onboarding_completed && ctx.role === "OWNER" && !ctx.organization.is_demo) redirect("/onboarding");
  const [executives, notifications] = await Promise.all([
    AIExecutiveRegistry.getAllExecutives(ctx.organization.id),
    db().notifications.list(ctx.organization.id, { where: { user_id: ctx.user.id }, orderBy: "created_at", desc: true, limit: 15 }),
  ]);
  return (
    <AppShell
      user={{ first_name: ctx.user.first_name, last_name: ctx.user.last_name, email: ctx.user.email, email_verified: ctx.user.email_verified }}
      organization={{ id: ctx.organization.id, name: ctx.organization.name, is_demo: ctx.organization.is_demo }}
      memberships={ctx.memberships.map((m) => ({ id: m.organization.id, name: m.organization.name }))}
      role={ctx.role}
      executives={executives.map((e) => ({ id: e.id, slug: e.slug, title: e.title, short_title: e.short_title, avatar_url: e.avatar_url, accent: e.accent, status: e.status }))}
      notifications={notifications}
      providers={providerStatus()}
      dataMode={dataMode()}
      logoutAction={logoutAction}
      switchOrgAction={switchOrgAction}
      markNotificationsReadAction={markNotificationsReadAction}
    >
      {children}
    </AppShell>
  );
}
