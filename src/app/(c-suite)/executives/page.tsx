import type { Metadata } from "next";
import { Users } from "lucide-react";
import { ExecutiveCard } from "@/components/executives/executive-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatRelative } from "@/lib/utils";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { requireContext } from "@/server/organizations/service";

export const metadata: Metadata = { title: "Executive Offices" };

export default async function ExecutivesPage() {
  const ctx = await requireContext();
  const orgId = ctx.organization.id;
  const execs = await AIExecutiveRegistry.getAllExecutives(orgId);
  const [personas, convs] = await Promise.all([
    db().personas.list(orgId),
    db().conversations.list(orgId, { where: { user_id: ctx.user.id }, orderBy: "updated_at", desc: true, limit: 50 }),
  ]);
  const q = new Map(personas.map((p) => [p.executive_id, p.primary_question]));
  return (
    <div>
      <PageHeader
        eyebrow="Executive Offices"
        title="Your A.I. C-Suite"
        description="Seven executives, one organization, shared intelligence. Open an office to work one-on-one, or convene several in a C-Suite Session."
        actions={<ButtonLink href="/sessions/new"><Users className="size-4" /> Convene a session</ButtonLink>}
      />
      {execs.length === 0 ? (
        <EmptyState title="No executives configured" body="Your C-Suite has not been initialized for this organization." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {execs.map((e) => {
            const last = convs.find((c) => c.executive_id === e.id);
            return <ExecutiveCard key={e.id} exec={e} primaryQuestion={q.get(e.id) ?? ""} activity={last ? `${last.title} · ${formatRelative(last.updated_at)}` : undefined} />;
          })}
        </div>
      )}
    </div>
  );
}
