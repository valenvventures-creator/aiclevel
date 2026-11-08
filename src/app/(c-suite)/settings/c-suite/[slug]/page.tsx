import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { ActionForm } from "@/components/settings/action-form";
import { Card, Input, Label, SectionTitle, Select, Textarea } from "@/components/ui/primitives";
import { TOOL_REGISTRY } from "@/config/tools/registry";
import { MEMORY_CATEGORIES } from "@/types/domain";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { authorize } from "@/server/organizations/service";
import { updateExecutiveConfigAction } from "@/server/settings/actions";

export const metadata: Metadata = { title: "Configure executive" };

export default async function ConfigureExecutivePage({ params }: PageProps<"/settings/c-suite/[slug]">) {
  const { slug } = await params;
  const ctx = await authorize("executives.configure");
  const e = await AIExecutiveRegistry.resolve(ctx.organization.id, slug);
  if (!e) notFound();
  const p = e.persona;
  return (
    <div className="space-y-6">
      <Link href="/settings/c-suite" className="text-xs text-ivory-muted hover:text-ivory">← A.I. C-Suite</Link>
      <div className="flex items-center gap-4">
        <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={56} />
        <div><h2 className="font-heading text-2xl font-semibold">{e.title}</h2><p className="text-xs text-ivory-muted">Database-driven configuration · prompt {e.model.prompt_key}_v1</p></div>
      </div>
      <p className="text-sm text-ivory-muted">
        To make the {e.short_title} more knowledgeable, add to its <Link href={`/executives/${e.slug}?tab=library`} className="text-gold-300 underline-offset-2 hover:underline">Library</Link>; to correct how it works, use its <Link href={`/executives/${e.slug}?tab=learning`} className="text-gold-300 underline-offset-2 hover:underline">Learning</Link> lessons.
      </p>
      <ActionForm action={updateExecutiveConfigAction} submit="Save executive configuration">
        <input type="hidden" name="executive_id" value={e.id} />
        <Card className="space-y-4">
          <SectionTitle>Identity</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="title">Title</Label><Input id="title" name="title" defaultValue={e.title} required /></div>
            <div><Label htmlFor="display_name">Display name (optional)</Label><Input id="display_name" name="display_name" defaultValue={e.display_name ?? ""} /></div>
            <div><Label htmlFor="functional_mandate">Functional mandate</Label><Input id="functional_mandate" name="functional_mandate" defaultValue={e.functional_mandate} required /></div>
            <div><Label htmlFor="avatar_url">Portrait URL</Label><Input id="avatar_url" name="avatar_url" defaultValue={e.avatar_url ?? ""} /></div>
          </div>
          <T n="description" l="Executive description" v={e.description} />
        </Card>
        <Card className="space-y-4">
          <SectionTitle>Persona & reasoning</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <T n="primary_question" l="Core question" v={p.primary_question} />
            <T n="north_star" l="North star" v={p.north_star} />
            <T n="core_belief" l="Core belief" v={p.core_belief} />
            <T n="leadership_promise" l="Leadership promise" v={p.leadership_promise} />
            <T n="personality" l="Personality" v={p.personality} />
            <T n="communication_style" l="Communication style" v={p.communication_style} />
            <T n="decision_style" l="Decision framework" v={p.decision_style} />
            <T n="reasoning_guidelines" l="Reasoning framework" v={p.reasoning_guidelines} />
            <T n="output_preferences" l="Output preferences" v={p.output_preferences} />
            <T n="risk_constraints" l="Risk constraints" v={p.risk_constraints} />
          </div>
          <T n="biography" l="Biography" v={p.biography} rows={3} />
          <T n="system_instructions" l="System instructions" v={p.system_instructions} rows={5} />
        </Card>
        <Card className="space-y-4">
          <SectionTitle>Model</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="pp">Primary provider</Label><Select id="pp" name="primary_provider" defaultValue={e.model.primary_provider}><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option></Select></div>
            <div><Label htmlFor="pm">Primary model</Label><Input id="pm" name="primary_model" defaultValue={e.model.primary_model} /></div>
            <div><Label htmlFor="ef">Reasoning effort</Label><Select id="ef" name="effort" defaultValue={e.model.effort}>{["low", "medium", "high", "xhigh", "max"].map((x) => <option key={x}>{x}</option>)}</Select></div>
            <div><Label htmlFor="fp">Fallback provider</Label><Select id="fp" name="fallback_provider" defaultValue={e.model.fallback_provider ?? ""}><option value="">None</option><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option></Select></div>
            <div><Label htmlFor="fm">Fallback model</Label><Input id="fm" name="fallback_model" defaultValue={e.model.fallback_model ?? ""} /></div>
            <div><Label htmlFor="tb">Token budget</Label><Input id="tb" name="token_budget" type="number" defaultValue={e.model.token_budget} /></div>
          </div>
        </Card>
        <Card className="space-y-3">
          <SectionTitle>Skills</SectionTitle>
          <p className="text-xs text-ivory-muted">The expertise this executive brings. One skill per line, written as “Name — what it covers”. Shown on the Executive Profile and given to the executive as its areas of expertise.</p>
          <Textarea id="skills" name="skills" aria-label="Skills" rows={Math.min(12, Math.max(4, e.skills.length + 1))} defaultValue={e.skills.map((s) => (s.description ? `${s.name} — ${s.description}` : s.name)).join("\n")} placeholder="Scenario modeling — base, upside and downside cases with explicit drivers" />
        </Card>
        <Card className="space-y-3">
          <SectionTitle>Memory areas</SectionTitle>
          <p className="text-xs text-ivory-muted">Which parts of C-Suite Memory this executive searches when answering. Approved decisions are always shared with every executive.</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="memory_scope" value="ALL" defaultChecked={e.model.memory_categories === "ALL"} className="accent-gold-400" /> All areas</label>
            <label className="flex items-center gap-2"><input type="radio" name="memory_scope" value="SELECTED" defaultChecked={e.model.memory_categories !== "ALL"} className="accent-gold-400" /> Only the areas ticked below</label>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {MEMORY_CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs">
                <input type="checkbox" name="memory_categories" value={c} defaultChecked={e.model.memory_categories === "ALL" || e.model.memory_categories.includes(c)} className="accent-gold-400" />
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </label>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle>Tools</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.values(TOOL_REGISTRY).map((t) => (
              <label key={t.key} className="flex items-start gap-2.5 rounded-xl border border-line p-3 text-sm">
                <input type="checkbox" name="tools" value={t.key} defaultChecked={e.model.tool_permissions.includes(t.key)} className="mt-0.5 accent-gold-400" />
                <span><span className="font-medium">{t.label}</span>{t.requiresApproval && <span className="text-warn"> · requires approval</span>}<span className="block text-xs text-ivory-muted">{t.description}</span></span>
              </label>
            ))}
          </div>
        </Card>
      </ActionForm>
    </div>
  );
}

function T({ n, l, v, rows = 2 }: { n: string; l: string; v: string; rows?: number }) {
  return (
    <div><Label htmlFor={n}>{l}</Label><Textarea id={n} name={n} defaultValue={v} rows={rows} /></div>
  );
}
