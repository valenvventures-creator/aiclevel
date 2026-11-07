import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { ActionForm } from "@/components/settings/action-form";
import { TestConnection } from "@/components/settings/test-connection";
import { SETTINGS_SECTIONS, type SettingsSection } from "@/components/settings/nav";
import { Alert, Badge, Card, Input, Label, Select, SectionTitle, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import { dataMode } from "@/lib/env";
import { TOOL_REGISTRY } from "@/config/tools/registry";
import { PromptRegistry } from "@/server/ai/prompts/registry";
import { providerStatus } from "@/server/ai/gateway";
import { db } from "@/server/db/store";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { getConstitution, listTeam, requireContext, type RequestContext } from "@/server/organizations/service";
import { assignableRoles, can } from "@/server/auth/permissions";
import {
  addCeoIntelligenceAction, ceoIntelligenceOpAction, changePasswordAction, changeRoleAction, inviteMemberAction, removeMemberAction,
  revokeOtherSessionsAction, updateConstitutionAction, updateOrganizationAction, updateProfileAction,
} from "@/server/settings/actions";

export async function generateMetadata({ params }: PageProps<"/settings/[section]">): Promise<Metadata> {
  const { section } = await params;
  return { title: SETTINGS_SECTIONS.find(([k]) => k === section)?.[1] ?? "Settings" };
}

export default async function SettingsSectionPage({ params }: PageProps<"/settings/[section]">) {
  const { section } = await params;
  if (!SETTINGS_SECTIONS.some(([k]) => k === section)) notFound();
  const ctx = await requireContext();
  const s = section as SettingsSection;
  const label = SETTINGS_SECTIONS.find(([k]) => k === s)![1];
  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-semibold">{label}</h2>
      {s === "profile" && <Profile ctx={ctx} />}
      {s === "organization" && <Organization ctx={ctx} />}
      {s === "team" && <Team ctx={ctx} />}
      {s === "c-suite" && <CSuite ctx={ctx} />}
      {s === "ceo-intelligence" && <CeoIntelligence ctx={ctx} />}
      {s === "ai-models" && <AiModels ctx={ctx} />}
      {s === "tools" && <Tools ctx={ctx} />}
      {s === "security" && <Security ctx={ctx} />}
      {s === "developer" && <Developer ctx={ctx} />}
      {s === "billing" && <Billing ctx={ctx} />}
      {s === "voice" && <Voice ctx={ctx} />}
      {s === "integrations" && <Integrations />}
      {s === "api-connections" && <ApiConnections />}
      {s === "memory" && <Info title="Memory governance" points={["AI-generated conclusions are stored as PROPOSED and never become organizational truth automatically.", "Executives only retrieve memory in categories they are permitted to read (configure per executive in A.I. C-Suite).", "Visibility levels: Organization, Leadership only, Owner only.", "Every record keeps its provenance: source, creator, date, verification state and confidence."]} link={["/memory", "Open C-Suite Memory"]} />}
      {s === "files-storage" && <Info title="Files & storage" points={["Files are stored privately per organization (Supabase Storage bucket `organization-files`, path-prefixed by organization id with RLS).", "Downloads use authorized requests and 60-second signed URLs — never permanent public links.", "Supported: PDF, DOCX, PPTX, XLSX, CSV, TXT, MD, PNG, JPG, WEBP, common audio and video up to 20 MB.", "Plain-text formats are indexed immediately; binary formats are queued for the document-processing worker."]} link={["/files", "Open Files"]} />}
      {s === "data-privacy" && <Info title="Data & privacy" points={["Your organization's data is isolated server-side and by Row Level Security in the database.", "Data export: Owners can request a full organization export (JSON + files) — export job architecture is documented in docs/ARCHITECTURE.md.", "Deleting your individual account never deletes shared organization data.", "Organization deletion and ownership transfer are protected Owner actions and are audited."]} />}
      {s === "notifications" && <Info title="Notifications" points={["Executive response ready", "C-Suite Session report ready", "Finished Work ready", "Memory needs confirmation", "File processing complete", "Invitation accepted"]} />}
      {s === "appearance" && <Info title="Appearance" points={["Thought Authorities uses a single, calibrated dark theme designed for long executive sessions.", "Reduced-motion preferences from your operating system are respected automatically.", "Sidebar collapse state is remembered on this device."]} />}
    </div>
  );
}

type C = { ctx: RequestContext };

function Profile({ ctx }: C) {
  const u = ctx.user;
  return (
    <Card>
      <ActionForm action={updateProfileAction}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="fn">First name</Label><Input id="fn" name="first_name" defaultValue={u.first_name} required /></div>
          <div><Label htmlFor="ln">Last name</Label><Input id="ln" name="last_name" defaultValue={u.last_name} required /></div>
          <div><Label htmlFor="dn">Display name</Label><Input id="dn" name="display_name" defaultValue={u.display_name ?? ""} /></div>
          <div><Label htmlFor="tz">Timezone</Label><Input id="tz" name="timezone" defaultValue={u.timezone} /></div>
        </div>
        <p className="text-xs text-ivory-faint">Email: {u.email} {u.email_verified ? <Badge tone="ok">Verified</Badge> : <Link href="/verify-email" className="text-gold-300">Verify</Link>}</p>
      </ActionForm>
    </Card>
  );
}

async function Organization({ ctx }: C) {
  const c = await getConstitution(ctx.organization.id);
  const editable = can(ctx.role, "org.update");
  const fields: [keyof typeof c, string][] = [["mission", "Mission"], ["vision", "Vision"], ["values", "Values"], ["business_model", "Business model"], ["leadership_philosophy", "Leadership philosophy"], ["strategic_priorities", "Strategic priorities"], ["current_priorities", "Current priorities"], ["brand_voice", "Brand voice"], ["primary_audiences", "Primary audiences"], ["financial_objectives", "Financial objectives"], ["technology_objectives", "Technology objectives"], ["impact_objectives", "Impact objectives"], ["key_relationships", "Key relationships"], ["important_restrictions", "Important restrictions"], ["decision_principles", "Decision principles"], ["operating_philosophy", "Operating philosophy"]];
  return (
    <>
      <Card>
        <SectionTitle>Identity</SectionTitle>
        {editable ? (
          <ActionForm action={updateOrganizationAction}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="on">Organization name</Label><Input id="on" name="name" defaultValue={ctx.organization.name} required /></div>
              <div><Label htmlFor="oi">Industry</Label><Input id="oi" name="industry" defaultValue={ctx.organization.industry ?? ""} /></div>
            </div>
          </ActionForm>
        ) : <p className="text-sm">{ctx.organization.name}</p>}
      </Card>
      <Card>
        <SectionTitle>Organization Constitution</SectionTitle>
        <p className="mb-4 text-sm text-ivory-muted">The shared context every A.I. Executive reads before advising you.</p>
        <ActionForm action={updateConstitutionAction} submit="Save Constitution">
          <fieldset disabled={!editable} className="grid gap-4 md:grid-cols-2">
            {fields.map(([k, l]) => (
              <div key={k}><Label htmlFor={`c-${k}`}>{l}</Label><Textarea id={`c-${k}`} name={k} defaultValue={String(c[k] ?? "")} rows={3} /></div>
            ))}
            <div><Label htmlFor="c-risk">Risk tolerance</Label><Select id="c-risk" name="risk_tolerance" defaultValue={c.risk_tolerance}><option value="CONSERVATIVE">Conservative</option><option value="BALANCED">Balanced</option><option value="AGGRESSIVE">Aggressive</option></Select></div>
          </fieldset>
        </ActionForm>
      </Card>
    </>
  );
}

async function Team({ ctx }: C) {
  const [team, invites] = await Promise.all([listTeam(ctx.organization.id), db().invitations.list(ctx.organization.id, { orderBy: "created_at", desc: true })]);
  const roles = assignableRoles(ctx.role);
  return (
    <>
      {can(ctx.role, "team.invite") && (
        <Card>
          <SectionTitle>Invite a team member</SectionTitle>
          {!ctx.user.email_verified && <div className="mb-3"><Alert tone="info">Verify your email before inviting team members.</Alert></div>}
          <ActionForm action={inviteMemberAction} submit="Send invitation" className="grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
            <div><Label htmlFor="ie">Email</Label><Input id="ie" name="email" type="email" required /></div>
            <div><Label htmlFor="ir">Role</Label><Select id="ir" name="role" defaultValue="MEMBER">{roles.map((r) => <option key={r} value={r}>{r}</option>)}</Select></div>
          </ActionForm>
        </Card>
      )}
      <Card>
        <SectionTitle>Members</SectionTitle>
        <ul className="divide-y divide-line">
          {team.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{m.profile ? `${m.profile.first_name} ${m.profile.last_name}` : "Member"}{m.user_id === ctx.user.id && " (you)"}</p><p className="text-xs text-ivory-faint">{m.profile?.email} {m.title && `· ${m.title}`}</p></div>
              <Badge tone={m.status === "ACTIVE" ? "gold" : "risk"}>{m.status === "ACTIVE" ? m.role : "REMOVED"}</Badge>
              {can(ctx.role, "team.change_role") && m.role !== "OWNER" && m.user_id !== ctx.user.id && m.status === "ACTIVE" && (
                <>
                  <form action={changeRoleAction} className="flex items-center gap-2">
                    <input type="hidden" name="member_id" value={m.id} />
                    <Select name="role" defaultValue={m.role} aria-label="Role" className="h-8 w-32 text-xs">{roles.map((r) => <option key={r} value={r}>{r}</option>)}</Select>
                    <Button size="sm" variant="outline">Update</Button>
                  </form>
                  <form action={removeMemberAction}><input type="hidden" name="member_id" value={m.id} /><Button size="sm" variant="danger">Remove</Button></form>
                </>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {invites.length > 0 && (
        <Card>
          <SectionTitle>Invitations</SectionTitle>
          <ul className="space-y-2 text-sm">{invites.map((i) => <li key={i.id} className="flex justify-between gap-2"><span>{i.email} · {i.role}</span><span className="font-mono text-[10px] text-ivory-faint">{i.accepted_at ? "ACCEPTED" : new Date(i.expires_at) < new Date() ? "EXPIRED" : `EXPIRES ${formatRelative(i.expires_at).toUpperCase()}`}</span></li>)}</ul>
        </Card>
      )}
    </>
  );
}

async function CSuite({ ctx }: C) {
  const execs = await AIExecutiveRegistry.getAllExecutives(ctx.organization.id, { includeInactive: true });
  return (
    <Card>
      <p className="mb-4 text-sm text-ivory-muted">Configure each executive&apos;s identity, persona, reasoning framework, model, tools and memory permissions. Changes are versioned in the audit log.</p>
      <ul className="divide-y divide-line">
        {execs.map((e) => (
          <li key={e.id} className="flex items-center gap-4 py-3">
            <ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={40} ring={false} />
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{e.display_name ?? e.title}</p><p className="text-xs text-ivory-muted">{e.functional_mandate}</p></div>
            {e.is_core && <Badge tone="gold">Core</Badge>}
            {can(ctx.role, "executives.configure") ? <Link href={`/settings/c-suite/${e.slug}`} className="text-sm text-gold-300 hover:text-gold-200">Configure →</Link> : <Link href={`/executives/${e.slug}?tab=profile`} className="text-sm text-ivory-muted">View</Link>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function CeoIntelligence({ ctx }: C) {
  if (!can(ctx.role, "ceo_intelligence.manage")) return <Alert tone="info">Only the organization Owner can manage the CEO Leadership Intelligence profile.</Alert>;
  const rows = await db().ceoIntelligence.list(ctx.organization.id, { orderBy: "created_at", desc: true });
  return (
    <>
      <Alert tone="info">This is a <strong>structured leadership intelligence profile</strong> — principles, decisions, writing and preferences you choose to share. It is an additional context layer for the A.I. CEO, not a copy of anyone&apos;s mind. You control what is included and can remove it at any time.</Alert>
      <Card>
        <SectionTitle>Add leadership context</SectionTitle>
        <ActionForm action={addCeoIntelligenceAction} submit="Add to profile">
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <div><Label htmlFor="ck">Type</Label><Select id="ck" name="kind">{["PRINCIPLE", "DECISION", "WRITING", "SPEECH", "INTERVIEW", "PREFERENCE", "HISTORY"].map((k) => <option key={k} value={k}>{k.charAt(0) + k.slice(1).toLowerCase()}</option>)}</Select></div>
            <div><Label htmlFor="ct">Title</Label><Input id="ct" name="title" required /></div>
          </div>
          <div><Label htmlFor="cc">Content</Label><Textarea id="cc" name="content" rows={4} required /></div>
        </ActionForm>
      </Card>
      <Card>
        <SectionTitle>Profile entries</SectionTitle>
        {rows.length === 0 ? <p className="text-sm text-ivory-faint">No entries yet.</p> : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-3 py-3">
                <Badge>{r.kind}</Badge>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{r.title}</p><p className="text-xs text-ivory-muted">{r.content}</p></div>
                <form action={ceoIntelligenceOpAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="toggle" /><Button size="sm" variant="outline">{r.included ? "Included" : "Excluded"}</Button></form>
                <form action={ceoIntelligenceOpAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="delete" /><Button size="sm" variant="danger">Remove</Button></form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

async function AiModels({ ctx }: C) {
  const ps = providerStatus();
  const [execs, configs, usage] = await Promise.all([AIExecutiveRegistry.getAllExecutives(ctx.organization.id), db().modelConfigs.list(ctx.organization.id), db().usage.list(ctx.organization.id, { orderBy: "created_at", desc: true, limit: 500 })]);
  const cfg = new Map(configs.map((c) => [c.executive_id, c]));
  const totals = usage.reduce((a, u) => ({ in: a.in + u.input_tokens, out: a.out + u.output_tokens, cost: a.cost + u.estimated_cost_usd, fails: a.fails + (u.success ? 0 : 1) }), { in: 0, out: 0, cost: 0, fails: 0 });
  return (
    <>
      <Card>
        <SectionTitle>Providers</SectionTitle>
        <ul className="space-y-4">
          {([["anthropic", "Anthropic — Claude", "Primary reasoning provider"], ["openai", "OpenAI", "Fallback / image / audio"]] as const).map(([k, name, role]) => (
            <li key={k} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-4">
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{name}</p><p className="text-xs text-ivory-muted">{role}</p></div>
              <Badge tone={ps[k] ? "ok" : "warn"}>{ps[k] ? "Configured" : "Not configured"}</Badge>
              {can(ctx.role, "models.configure") && <TestConnection provider={k} />}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ivory-faint">Credentials are stored server-side ({dataMode() === "demo" ? "environment variables" : "encrypted provider_credentials + environment"}) and are never displayed or sent to the browser.{!ps.anthropic && !ps.openai && " With no provider configured, executive output is simulated and labelled."}</p>
      </Card>
      <Card>
        <SectionTitle>Executive model routing</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left font-mono text-[10px] tracking-[0.16em] text-ivory-faint"><th className="py-2">EXECUTIVE</th><th>PRIMARY</th><th>FALLBACK</th><th>EFFORT</th></tr></thead>
            <tbody className="divide-y divide-line">{execs.map((e) => { const c = cfg.get(e.id); return <tr key={e.id}><td className="py-2.5">{e.short_title}</td><td>{c?.primary_model}</td><td className="text-ivory-muted">{c?.fallback_model ?? "—"}</td><td>{c?.effort}</td></tr>; })}</tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ivory-faint">Utility tasks (Studio routing, memory extraction, short communications) route to claude-haiku-5-5 automatically.</p>
      </Card>
      <Card>
        <SectionTitle>Usage (last 500 requests)</SectionTitle>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[["Requests", usage.length], ["Input tokens", totals.in.toLocaleString()], ["Output tokens", totals.out.toLocaleString()], ["Est. cost", `$${totals.cost.toFixed(2)}`]].map(([k, v]) => <div key={k as string}><dt className="font-mono text-[10px] tracking-[0.16em] text-ivory-faint">{k}</dt><dd className="mt-1 font-heading text-2xl">{v}</dd></div>)}
        </dl>
        {totals.fails > 0 && <p className="mt-3 text-xs text-risk">{totals.fails} failed provider requests recorded.</p>}
      </Card>
    </>
  );
}

async function Tools({ ctx }: C) {
  const [execs, cfgs] = await Promise.all([AIExecutiveRegistry.getAllExecutives(ctx.organization.id), db().modelConfigs.list(ctx.organization.id)]);
  const cfg = new Map(cfgs.map((c) => [c.executive_id, c]));
  const tools = Object.values(TOOL_REGISTRY);
  return (
    <Card>
      <p className="mb-4 text-sm text-ivory-muted">Tool access is role-specific. Tools marked <Badge tone="warn">Approval</Badge> always go through the Human Approval Layer. MCP tools require a connected integration.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr><th className="py-2 text-left font-mono tracking-[0.14em] text-ivory-faint">TOOL</th>{execs.map((e) => <th key={e.id} className="px-2 font-mono tracking-[0.14em]" style={{ color: e.accent }}>{e.short_title}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {tools.map((t) => (
              <tr key={t.key}>
                <td className="py-2.5 pr-3"><span className="text-sm">{t.label}</span> <span className="text-ivory-faint">· {t.kind}</span> {t.requiresApproval && <Badge tone="warn">Approval</Badge>}</td>
                {execs.map((e) => <td key={e.id} className="text-center">{cfg.get(e.id)?.tool_permissions.includes(t.key) ? <span className="text-gold-400" aria-label="Granted">●</span> : <span className="text-ivory-faint" aria-label="Not granted">·</span>}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ivory-faint">Edit grants per executive in A.I. C-Suite → Configure.</p>
    </Card>
  );
}

async function Security({ ctx }: C) {
  const events = await db().audit.list(ctx.organization.id, { where: { actor_id: ctx.user.id }, orderBy: "timestamp", desc: true, limit: 8 });
  return (
    <>
      <Card>
        <SectionTitle>Change password</SectionTitle>
        <ActionForm action={changePasswordAction} submit="Update password">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="cp">Current password</Label><Input id="cp" name="current" type="password" autoComplete="current-password" required /></div>
            <div><Label htmlFor="np">New password</Label><Input id="np" name="password" type="password" autoComplete="new-password" required /></div>
            <div><Label htmlFor="cnp">Confirm</Label><Input id="cnp" name="confirm" type="password" autoComplete="new-password" required /></div>
          </div>
        </ActionForm>
      </Card>
      <Card>
        <SectionTitle>Active sessions</SectionTitle>
        <p className="text-sm text-ivory-muted">Sign out every other device. This device stays signed in.</p>
        <form action={revokeOtherSessionsAction} className="mt-3"><Button variant="outline" size="sm">Sign out other sessions</Button></form>
      </Card>
      <Card>
        <SectionTitle>Recent security activity</SectionTitle>
        <ul className="space-y-2 text-sm">{events.map((e) => <li key={e.id} className="flex justify-between"><span>{e.event_type}</span><span className="font-mono text-[10px] text-ivory-faint">{formatRelative(e.timestamp)}</span></li>)}{!events.length && <li className="text-ivory-faint">No recent events.</li>}</ul>
      </Card>
    </>
  );
}

async function Developer({ ctx }: C) {
  const logs = can(ctx.role, "audit.read") ? await db().audit.list(ctx.organization.id, { orderBy: "timestamp", desc: true, limit: 40 }) : [];
  return (
    <>
      <Card>
        <SectionTitle>Prompt Registry</SectionTitle>
        <p className="mb-3 text-sm text-ivory-muted">Published prompt templates. Every executive output records the template version that produced it.</p>
        <div className="flex flex-wrap gap-1.5">{PromptRegistry.list().map((t) => <Badge key={t.key}>{t.key}_v{t.version}</Badge>)}</div>
      </Card>
      <Card>
        <SectionTitle>Audit log</SectionTitle>
        {!can(ctx.role, "audit.read") ? <p className="text-sm text-ivory-faint">Owners and Admins can view the audit log.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left font-mono tracking-[0.14em] text-ivory-faint"><th className="py-2">EVENT</th><th>ENTITY</th><th>WHEN</th></tr></thead>
              <tbody className="divide-y divide-line">{logs.map((l) => <tr key={l.id}><td className="py-2">{l.event_type}</td><td className="text-ivory-muted">{l.entity_type}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}` : ""}</td><td className="font-mono text-ivory-faint">{formatRelative(l.timestamp)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function Billing({ ctx }: C) {
  return (
    <Card>
      <div className="flex items-center gap-3"><p className="text-sm">Subscription status</p><Badge tone="gold">{ctx.organization.subscription_status}</Badge></div>
      <p className="mt-3 text-sm text-ivory-muted">Billing is not yet enabled. The data model supports TRIAL, ACTIVE, PAST_DUE, SUSPENDED and CANCELLED; Stripe integration is planned for Phase 13.</p>
    </Card>
  );
}

async function Voice({ ctx }: C) {
  const [execs, voices] = await Promise.all([AIExecutiveRegistry.getAllExecutives(ctx.organization.id), db().voices.list(ctx.organization.id)]);
  const v = new Map(voices.map((x) => [x.executive_id, x]));
  return (
    <Card>
      <p className="mb-4 text-sm text-ivory-muted">Executive conversations support voice input and read-aloud today using your browser&apos;s speech engine. Executive-specific premium voices (e.g. ElevenLabs) and hands-free C-Suite Sessions are architected for Phase 11.</p>
      <ul className="divide-y divide-line">{execs.map((e) => <li key={e.id} id={e.slug} className="flex items-center gap-3 py-3"><ExecutiveAvatar src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={32} ring={false} /><span className="flex-1 text-sm">{e.title}</span><span className="text-xs text-ivory-muted">{v.get(e.id)?.voice_name} · {v.get(e.id)?.provider} · {v.get(e.id)?.settings_json.playback_speed}×</span></li>)}</ul>
    </Card>
  );
}

function Integrations() {
  const items = ["Gmail", "Microsoft Outlook", "Google Calendar", "Microsoft Calendar", "Google Drive", "OneDrive", "Slack", "CRM", "Accounting", "Project management", "Market data"];
  return (
    <Card>
      <p className="mb-4 text-sm text-ivory-muted">Business integrations connect through adapters (and MCP where it adds value). Any action that writes to an external system requires human approval.</p>
      <ul className="grid gap-2 sm:grid-cols-2">{items.map((i) => <li key={i} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm">{i}<Badge>Planned</Badge></li>)}</ul>
    </Card>
  );
}

function ApiConnections() {
  return <Info title="API connections" points={["Organization-scoped API keys for internal integrations are planned (Phase 12).", "Provider credentials for A.I. models are managed in AI Models.", "All API access will be tenant-scoped, rate-limited and audited."]} link={["/settings/ai-models", "AI Models"]} />;
}

function Info({ title, points, link }: { title: string; points: string[]; link?: [string, string] }) {
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      <ul className="space-y-2 text-sm">{points.map((p) => <li key={p} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rotate-45 bg-gold-500" aria-hidden />{p}</li>)}</ul>
      {link && <Link href={link[0]} className="mt-4 inline-block text-sm text-gold-300">{link[1]} →</Link>}
    </Card>
  );
}
