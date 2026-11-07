import Link from "next/link";
import type { Metadata } from "next";
import { Users } from "lucide-react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatRelative } from "@/lib/utils";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { requireContext } from "@/server/organizations/service";
import { SESSION_MODES } from "@/config/sessions/modes";

export const metadata: Metadata = { title: "C-Suite Sessions" };

export default async function SessionsPage() {
  const ctx = await requireContext();
  const [sessions, execs] = await Promise.all([db().sessions.list(ctx.organization.id, { orderBy: "created_at", desc: true }), AIExecutiveRegistry.getAllExecutives(ctx.organization.id)]);
  const map = new Map(execs.map((e) => [e.id, e]));
  return (
    <div>
      <PageHeader eyebrow="C-Suite Session" title="Convene leadership" description="Bring one business question to two or more executives. Independent positions, specialty reviews, challenge, CEO synthesis — and a decision record." actions={<ButtonLink href="/sessions/new"><Users className="size-4" /> New C-Suite Session</ButtonLink>} />
      {sessions.length === 0 ? (
        <EmptyState icon={<Users className="size-5" />} title="No C-Suite Sessions yet." body="Convene your first session to see how your executives think together." action={<ButtonLink href="/sessions/new" size="sm">Convene a session</ButtonLink>} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/sessions/${s.id}`} className="plate block p-5 transition hover:-translate-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="gold">{SESSION_MODES[s.mode].label}</Badge>
                  <span className="font-mono text-[10px] text-ivory-faint">{formatRelative(s.created_at)}</span>
                </div>
                <h2 className="mt-3 font-heading text-xl font-semibold">{s.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-ivory-muted">{s.objective}</p>
                <div className="mt-4 flex -space-x-2">
                  {s.participant_executive_ids.map((id) => map.get(id)).filter(Boolean).map((e) => <ExecutiveAvatar key={e!.id} src={e!.avatar_url} shortTitle={e!.short_title} accent={e!.accent} size={28} ring={false} className="rounded-full ring-2 ring-ink-900" />)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
