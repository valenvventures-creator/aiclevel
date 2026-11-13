import type { Metadata } from "next";
import { listCompanyFiles } from "@/server/files/service";
import { NewSessionForm } from "@/components/sessions/new-session-form";
import { PageHeader } from "@/components/ui/primitives";
import { SESSION_MODES } from "@/config/sessions/modes";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { authorize } from "@/server/organizations/service";

export const metadata: Metadata = { title: "New C-Level Session" };

export default async function NewSessionPage({ searchParams }: PageProps<"/sessions/new">) {
  const sp = await searchParams;
  const ctx = await authorize("sessions.create");
  const orgId = ctx.organization.id;
  const [execs, projects, files] = await Promise.all([AIExecutiveRegistry.getAllExecutives(orgId), db().projects.list(orgId), listCompanyFiles(orgId, { limit: 30 })]);
  return (
    <div>
      <PageHeader eyebrow="C-Level Session" title="Convene your C-Level" description="Define the question, choose who sits at the table and how they should work together." />
      <NewSessionForm
        execs={execs.map((e) => ({ id: e.id, title: e.title, short_title: e.short_title, avatar_url: e.avatar_url, accent: e.accent, role_code: e.role_code }))}
        modes={Object.values(SESSION_MODES).map((m) => ({ mode: m.mode, label: m.label, description: m.description }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        files={files.map((f) => ({ id: f.id, filename: f.filename }))}
        defaults={{ objective: typeof sp.objective === "string" ? sp.objective : undefined, with: typeof sp.with === "string" ? sp.with : undefined }}
      />
    </div>
  );
}
