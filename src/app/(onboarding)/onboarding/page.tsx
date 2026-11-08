import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/brand";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { requireUser } from "@/server/auth/session";
import { getConstitution, listMembershipsForUser } from "@/server/organizations/service";
import { logoutAction } from "@/server/auth/actions";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const memberships = await listMembershipsForUser(user.id);
  const owned = memberships.find((m) => m.member.role === "OWNER" && !m.organization.is_demo);
  if (user.onboarding_completed && memberships.length) redirect("/hq");
  // Invited members of an existing organization skip organizational onboarding.
  if (!owned && memberships.length) redirect("/hq");
  const constitution = owned ? await getConstitution(owned.organization.id) : null;
  return (
    <div className="min-h-dvh">
      <div aria-hidden className="bg-grid pointer-events-none fixed inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_top,#000,transparent_70%)]" />
      <header className="relative border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Wordmark />
          <form action={logoutAction}>
            <button className="text-sm text-ivory-muted hover:text-ivory">Sign out</button>
          </form>
        </div>
      </header>
      <main id="main" className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="eyebrow">Welcome, {user.first_name}</p>
        <p className="mt-2 max-w-2xl text-sm text-ivory-muted">Brief your C-Level. What you share here becomes your Organization Constitution — the shared context every A.I. Executive reads before advising you.</p>
        <div className="mt-10">
          <OnboardingWizard
            defaults={{
              first_name: user.first_name,
              last_name: user.last_name,
              title: owned?.member.title ?? "",
              org_name: owned?.organization.name ?? "",
              industry: owned?.organization.industry ?? "",
              constitution: (constitution ?? {}) as unknown as Record<string, string>,
              startStep: owned ? 2 : 0,
            }}
          />
        </div>
      </main>
    </div>
  );
}
