import "server-only";
import { dataMode } from "@/lib/env";
import { demoIdentity } from "@/server/auth/identity";
import { createOrganization, getConstitution } from "@/server/organizations/service";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { lexicalEmbedding } from "@/server/memory/embeddings";
import { db, newId, nowIso } from "./store";
import { records } from "./records";
import type { ExecutiveRoleCode, MemoryCategory, MemoryRecord, MemoryStatus, ReportType, UserProfile } from "@/types/domain";

/**
 * DEMO MODE seed — "Thought Authorities Demo".
 * Every A.I.-authored record is flagged `simulated: true` and rendered with a
 * "Simulated" label. Nothing here is presented as live model output.
 */
export const DEMO_CREDENTIALS = { email: "demo@thoughtauthorities.ai", password: "csuite-demo-2026" } as const;
export const DEMO_ORG_ID = "00000000-0000-4000-8000-00000000d3e0";
export const DEMO_USER_ID = "00000000-0000-4000-8000-00000000a11c";

const g = globalThis as unknown as { __taDemoSeed?: Promise<void> };

export function ensureDemoSeeded(): Promise<void> {
  if (dataMode() !== "demo") return Promise.resolve();
  return (g.__taDemoSeed ??= seedOnce().catch((err) => {
    g.__taDemoSeed = undefined;
    throw err;
  }));
}

/* The demo seed runs exactly once per database, even when several serverless
 * instances start at the same time: one instance takes a lock row, seeds, and
 * writes a completion marker; the others wait for the marker. */
const CONFIG = "app_config";
const MARKER = "demo_seed_v1";
const LOCK = "demo_seed_v1_lock";
const LOCK_STALE_MS = 2 * 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function seedOnce(): Promise<void> {
  const store = records();
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (await store.get(CONFIG, MARKER)) return;
    const acquired = await store.insertIfAbsent(CONFIG, { id: LOCK, at: Date.now() }, { organizationId: "global" });
    if (acquired) {
      try {
        await seed();
        await store.put(CONFIG, { id: MARKER, completed_at: nowIso() }, { organizationId: "global" });
        return;
      } finally {
        await store.remove(CONFIG, LOCK);
      }
    }
    const lock = await store.get<{ id: string; at: number }>(CONFIG, LOCK);
    if (lock && Date.now() - lock.at > LOCK_STALE_MS) await store.remove(CONFIG, LOCK);
    await sleep(400);
  }
  throw new Error("Timed out waiting for the demo organization to be prepared");
}

const daysAgo = (n: number, h = 0) => new Date(Date.now() - n * 86_400_000 - h * 3_600_000).toISOString();

async function seed() {
  // A previous, interrupted attempt may have created the account and organization already.
  const user: UserProfile =
    (await demoIdentity.getUser(DEMO_USER_ID)) ??
    (await demoIdentity.createUser({ id: DEMO_USER_ID, email: DEMO_CREDENTIALS.email, password: DEMO_CREDENTIALS.password, first_name: "Valen", last_name: "Demo", verified: true }));
  if (await demoIdentity.getOrganization(DEMO_ORG_ID)) return;
  await demoIdentity.updateProfile(user.id, { onboarding_completed: true });
  const org = await createOrganization({ id: DEMO_ORG_ID, name: "Thought Authorities Demo", industry: "Professional services & leadership advisory", owner: user, title: "Founder & CEO", isDemo: true });
  const orgId = org.id;
  const d = db();
  const execs = await AIExecutiveRegistry.getAllExecutives(orgId);
  const E = (r: ExecutiveRoleCode) => execs.find((e) => e.role_code === r)!;

  const c = await getConstitution(orgId);
  await d.constitutions.update(orgId, c.id, {
    mission: "Equip leaders with an intelligent C-Suite so every consequential decision is better informed.",
    vision: "Every organization, regardless of size, operates with executive-grade intelligence.",
    values: "Integrity · Clarity · Stewardship · Courage · Service",
    business_model: "B2B subscription (per-organization seats) with premium advisory engagements.",
    leadership_philosophy: "Decide with evidence, act with conviction, review with humility.",
    strategic_priorities: "1) Reach 120 paying organizations by Q4. 2) Launch the Enterprise tier. 3) Build a referral partner network.",
    current_priorities: "Close the seed extension; hire a Head of Customer Success; ship SOC 2 Type I readiness.",
    risk_tolerance: "BALANCED",
    brand_voice: "Calm, precise, confident and warm. Never hype. Executive language, not jargon.",
    primary_audiences: "Founders and CEOs of 10–500 person companies; family offices; mission-driven nonprofits.",
    financial_objectives: "Maintain 18+ months runway; reach $1.2M ARR; gross margin above 75%.",
    technology_objectives: "Model independence, tenant isolation, SOC 2 readiness, sub-second dashboard loads.",
    impact_objectives: "Donate 1% of revenue to leadership-development programs for underserved founders.",
    key_relationships: "Northwind Capital (lead seed investor); Meridian Partners (channel partner).",
    important_restrictions: "Never share client data across organizations. No public client names without written consent.",
    decision_principles: "Prefer reversible decisions fast; irreversible decisions with full C-Suite review.",
    operating_philosophy: "Small senior team, written decisions, weekly operating cadence.",
  });

  // ---------------- projects ----------------
  const projects = [
    { name: "Seed Extension", description: "Raise a $1.5M seed extension led by Northwind Capital to fund Enterprise tier and SOC 2.", status: "ACTIVE" as const },
    { name: "Enterprise Tier Launch", description: "Package SSO, audit exports and dedicated support into an Enterprise plan for Q3.", status: "ACTIVE" as const },
    { name: "Founders Forward Initiative", description: "1% pledge program funding leadership training for underserved founders.", status: "ON_HOLD" as const },
  ].map((p, i) => ({ id: newId(), organization_id: orgId, owner_id: user.id, created_at: daysAgo(40 - i * 8), ...p }));
  await d.projects.insertMany(projects);

  // ---------------- memory ----------------
  const mem = (title: string, content: string, category: MemoryCategory, importance: number, status: MemoryStatus, rel: ExecutiveRoleCode[], ago: number, extra: Partial<MemoryRecord> = {}): MemoryRecord => ({
    id: newId(), organization_id: orgId, project_id: null, title, content, category, importance, status, pinned: false,
    source_type: "HUMAN_ENTRY", source_id: null, created_by: user.id, verified_by: status === "VERIFIED" ? user.id : null,
    confidence: status === "PROPOSED" ? 0.6 : 0.95, embedding: lexicalEmbedding(`${title} ${content}`), visibility: "ORGANIZATION",
    executive_relevance: rel, created_at: daysAgo(ago), updated_at: daysAgo(ago), ...extra,
  });
  await d.memory.insertMany([
    mem("Current ARR", "Annual recurring revenue is $640K across 58 paying organizations (as of last month-end close).", "FINANCE", 5, "VERIFIED", ["CFO", "CEO"], 6, { pinned: true }),
    mem("Runway", "Cash on hand supports approximately 14 months of runway at current burn of $68K/month.", "FINANCE", 5, "VERIFIED", ["CFO", "CEO"], 6),
    mem("Northwind Capital relationship", "Northwind led the seed round and has indicated interest in leading a $1.5M extension contingent on Enterprise pipeline evidence.", "RELATIONSHIPS", 4, "USER_CONFIRMED", ["CFO", "CEO"], 12, { project_id: projects[0].id }),
    mem("Decision: Annual-only Enterprise billing", "The C-Suite Session on pricing recommended annual-only billing for Enterprise; approved by the CEO.", "DECISIONS", 4, "VERIFIED", ["CFO", "CCO", "CEO"], 20, { source_type: "CSUITE_SESSION", project_id: projects[1].id }),
    mem("Brand voice rule", "Never use the words 'revolutionary' or 'game-changing' in external copy.", "BRAND", 3, "VERIFIED", ["CCO"], 30),
    mem("SOC 2 readiness gap", "Gap assessment found missing vendor-risk reviews and incomplete access reviews.", "TECHNOLOGY", 4, "VERIFIED", ["CTO", "CLO"], 9),
    mem("Head of Customer Success hire", "Role approved; target start within 60 days; budget $140K base.", "HR", 3, "USER_CONFIRMED", ["CHRO", "CFO"], 4),
    mem("Meridian Partners channel terms", "Meridian proposes 20% revenue share for referred customers in year one.", "RELATIONSHIPS", 3, "PROPOSED", ["CCO", "CLO", "CFO"], 2, { source_type: "EXECUTIVE_CONVERSATION" }),
    mem("Founders Forward pledge", "Board-endorsed intent to allocate 1% of revenue to leadership programs for underserved founders.", "IMPACT", 3, "VERIFIED", ["CIO", "CEO"], 25, { project_id: projects[2].id }),
    mem("Lesson: pilots before pricing changes", "The Q1 price change without a pilot caused 4 churned accounts; future pricing changes will pilot with 5 customers first.", "LESSONS", 4, "VERIFIED", ["CEO", "CCO", "CFO"], 60),
    mem("Data processing restriction", "Client data must remain in US-region infrastructure per existing customer DPAs.", "GOVERNANCE", 5, "VERIFIED", ["CLO", "CTO"], 45),
    mem("Q3 board meeting", "Next board meeting is scheduled for the first Thursday of next month.", "DEADLINES", 3, "SYSTEM_IMPORTED", ["CEO", "CLO"], 1, { source_type: "EXTERNAL_INTEGRATION" }),
  ]);

  // ---------------- files ----------------
  const file = (filename: string, mime_type: string, size: number, category: string, text: string, ago: number, project_id: string | null = null) => ({
    id: newId(), organization_id: orgId, project_id, uploaded_by: user.id, filename, mime_type, size, storage_path: `demo/${filename}`, category, processing_status: "READY" as const, extracted_text: text, created_at: daysAgo(ago),
  });
  await d.files.insertMany([
    file("FY-Operating-Plan.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 84_211, "Finance", "Operating plan: revenue $1.2M target, burn $68K/mo, hires: CS lead, 2 AEs.", 15, projects[0].id),
    file("Northwind-Term-Sheet-Draft.pdf", "application/pdf", 212_004, "Legal", "Draft term sheet: $1.5M SAFE extension, $14M post-money cap, pro-rata rights.", 7, projects[0].id),
    file("Brand-Guidelines-v3.pdf", "application/pdf", 3_402_118, "Brand", "Gold #EFBA11 on ink. Voice: calm, precise, warm. Avoid hype words.", 33),
    file("SOC2-Gap-Assessment.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 96_330, "Technology", "Gaps: vendor risk management, quarterly access reviews, incident response tabletop.", 9),
    file("Enterprise-Pricing-Analysis.csv", "text/csv", 12_880, "Finance", "tier,price,seats\nGrowth,1200,10\nEnterprise,4800,50", 18, projects[1].id),
  ]);

  // ---------------- conversations ----------------
  const conv = async (role: ExecutiveRoleCode, title: string, turns: [string, string][], ago: number) => {
    const id = newId();
    await d.conversations.insert({ id, organization_id: orgId, executive_id: E(role).id, user_id: user.id, project_id: null, title, created_at: daysAgo(ago), updated_at: daysAgo(ago) });
    let i = 0;
    for (const [q, a] of turns) {
      await d.messages.insert({ id: newId(), organization_id: orgId, conversation_id: id, role: "user", content: q, provider: null, model: null, prompt_version: null, simulated: false, created_at: daysAgo(ago, -(i++)) });
      await d.messages.insert({ id: newId(), organization_id: orgId, conversation_id: id, role: "executive", content: a, provider: "simulated", model: "demo-seed", prompt_version: `${role.toLowerCase()}_core_v1`, simulated: true, created_at: daysAgo(ago, -(i++)) });
    }
  };
  await conv("CFO", "Seed extension sizing", [[
    "Is $1.5M the right size for the extension?",
    "**Recommendation:** $1.5M is defensible if it buys **24+ months** of runway *and* funds the Enterprise tier.\n\n| Scenario | Monthly burn | Runway with $1.5M |\n|---|---|---|\n| Base | $68K | 36 mo |\n| Hiring plan | $95K | 24 mo |\n| Aggressive | $120K | 19 mo |\n\n**Metric to watch:** Enterprise pipeline coverage (3× target).\n\n_This is analysis, not regulated financial advice._",
  ]], 3);
  await conv("CEO", "Q3 priorities", [[
    "What should our top three priorities be next quarter?",
    "**Recommendation:** Focus on (1) closing the seed extension, (2) Enterprise tier launch, (3) SOC 2 readiness — in that order, because each unlocks the next.\n\nThe Founders Forward initiative should stay on hold until runway exceeds 18 months.",
  ]], 2);

  // ---------------- executive comms ----------------
  const thread = async (subject: string, from: ExecutiveRoleCode | "USER", toExecs: ExecutiveRoleCode[], body: string, ago: number, opts: { starred?: boolean; read?: boolean } = {}) => {
    await d.communications.insert({
      id: newId(), organization_id: orgId, thread_id: newId(), subject, body,
      sender_type: from === "USER" ? "USER" : "EXECUTIVE", sender_id: from === "USER" ? user.id : E(from).id,
      recipient_executive_ids: toExecs.map((r) => E(r).id), recipient_user_ids: from === "USER" ? [] : [user.id],
      is_draft: false, starred: Boolean(opts.starred), archived: false, read_at: opts.read ? daysAgo(ago) : null,
      origin_type: null, origin_id: null, simulated: from !== "USER", created_at: daysAgo(ago),
    });
  };
  await thread("Runway alert: hiring plan impact", "CFO", [], "If both AEs start next month, runway drops from 14 to 11 months. I recommend sequencing the second AE after the extension closes.\n\n— Chief Financial Officer", 0.2, { starred: true });
  await thread("SOC 2: two control gaps need owners", "CTO", [], "Vendor-risk reviews and quarterly access reviews have no owner. I suggest the CHRO owns access reviews and I own vendor risk.\n\n— Chief Technology Officer", 1);
  await thread("Meridian channel terms need review", "CLO", [], "The proposed 20% revenue share includes an exclusivity clause that could restrict future partners. Counsel review recommended: **Yes**.\n\n— Chief Legal Officer", 2, { read: true });
  await thread("Draft announcement for Enterprise tier", "USER", ["CCO", "CEO"], "Please prepare a launch announcement for the Enterprise tier aimed at existing customers.", 1.5);

  // ---------------- C-Suite Session ----------------
  const sessionId = newId();
  const participants = (["CEO", "CFO", "CCO", "CLO"] as ExecutiveRoleCode[]).map((r) => E(r).id);
  await d.sessions.insert({ id: sessionId, organization_id: orgId, project_id: projects[1].id, created_by: user.id, title: "Should Enterprise launch with annual-only billing?", objective: "Decide Enterprise billing terms before the Q3 launch.", mode: "CEO_SYNTHESIS", status: "ACTIVE", chair_executive_id: E("CEO").id, participant_executive_ids: participants, created_at: daysAgo(20), started_at: daysAgo(20), ended_at: null });
  const sm = [
    ["USER", null, "QUESTION", "Should we launch Enterprise with annual-only billing?"],
    ["SYSTEM", null, "INDEPENDENT", "Independent positions"],
    ["EXECUTIVE", "CFO", "INDEPENDENT", "**Position:** Annual-only. It improves cash collection by ~$190K in year one and reduces churn exposure.\n\n**Confidence:** 80%"],
    ["EXECUTIVE", "CCO", "INDEPENDENT", "**Position:** Annual by default, with a quarterly option at a 10% premium for procurement-constrained buyers.\n\n**Confidence:** 65%"],
    ["EXECUTIVE", "CLO", "INDEPENDENT", "**Position:** Annual-only is fine provided auto-renewal terms meet state notice requirements. Counsel review recommended: **Yes**.\n\n**Confidence:** 70%"],
    ["SYSTEM", null, "SYNTHESIS", "CEO synthesis"],
    ["EXECUTIVE", "CEO", "SYNTHESIS", "## Recommendation\nLaunch Enterprise with **annual-only** billing; revisit a quarterly option after 10 enterprise deals.\n\n## Preserved dissent\n- The CCO believes a quarterly option at a premium would widen the funnel.\n\n## Next steps\n| Action | Owner | When |\n|---|---|---|\n| Counsel review of renewal terms | CLO | 2 weeks |\n| Update pricing page | CCO | 3 weeks |\n\n## Confidence\n75%"],
  ] as const;
  let seq = 0;
  for (const [type, role, stage, content] of sm) {
    await d.sessionMessages.insert({ id: newId(), organization_id: orgId, session_id: sessionId, speaker_type: type, speaker_id: role ? E(role).id : type === "USER" ? user.id : null, stage, content, sequence_number: ++seq, provider: type === "EXECUTIVE" ? "simulated" : null, model: type === "EXECUTIVE" ? "demo-seed" : null, prompt_version: null, simulated: type === "EXECUTIVE", metadata: {}, created_at: daysAgo(20) });
  }

  // ---------------- decisions ----------------
  await d.decisions.insertMany([
    { id: newId(), organization_id: orgId, project_id: projects[1].id, session_id: sessionId, title: "Enterprise billing terms", question: "Should Enterprise launch with annual-only billing?", options_json: [{ id: "A", label: "Annual-only" }, { id: "B", label: "Annual + quarterly premium" }], chosen_option: "A", recommendation: "Annual-only billing; revisit after 10 deals.", rationale: "Cash collection and churn protection outweigh funnel friction at current scale.", risks_json: [{ risk: "Procurement friction", severity: "MEDIUM" }, { risk: "Auto-renewal compliance", severity: "MEDIUM" }], financial_implications_json: { year_one_cash_delta_usd: 190000 }, technology_implications_json: null, people_implications_json: null, impact_implications_json: null, confidence: 0.75, status: "APPROVED", created_by: user.id, created_at: daysAgo(20) },
    { id: newId(), organization_id: orgId, project_id: projects[0].id, session_id: null, title: "Second AE hire timing", question: "Hire the second Account Executive now or after the extension closes?", options_json: [{ id: "A", label: "Now" }, { id: "B", label: "After close" }], chosen_option: null, recommendation: "Sequence after the extension closes.", rationale: "Protects runway above 12 months.", risks_json: [{ risk: "Slower pipeline growth", severity: "LOW" }], financial_implications_json: null, technology_implications_json: null, people_implications_json: null, impact_implications_json: null, confidence: 0.7, status: "UNDER_REVIEW", created_by: user.id, created_at: daysAgo(1) },
  ]);

  // ---------------- reports ----------------
  const report = (report_type: ReportType, title: string, lead: ExecutiveRoleCode, contrib: ExecutiveRoleCode[], summary: string, content: string, ago: number) => ({
    id: newId(), organization_id: orgId, project_id: null, report_type, title, summary, content, lead_executive_id: E(lead).id, contributing_executive_ids: contrib.map((r) => E(r).id), sources: [], version: 1, source_session_id: null, simulated: true, created_by: user.id, created_at: daysAgo(ago),
  });
  await d.reports.insertMany([
    report("CEO Executive Brief", "Daily CEO Brief", "CEO", ["CFO", "CTO", "CLO"], "Runway sensitivity to hiring, two SOC 2 owners needed, Meridian terms need counsel.", "## Today\n1. **Runway** — hiring plan reduces runway to 11 months (CFO).\n2. **SOC 2** — assign owners for two control gaps (CTO).\n3. **Meridian** — exclusivity clause needs counsel review (CLO).", 0),
    report("Financial Review", "Monthly Financial Review", "CFO", [], "ARR $640K, burn $68K/mo, 14 months runway.", "## Highlights\n| Metric | Value |\n|---|---|\n| ARR | $640K |\n| Burn | $68K/mo |\n| Runway | 14 mo |", 6),
    report("C-Suite Session Minutes", "Minutes — Enterprise billing session", "CEO", ["CFO", "CCO", "CLO"], "Annual-only billing recommended; CCO dissent preserved.", "Recorded in the C-Suite Session transcript.", 20),
    report("Security Review", "SOC 2 Readiness Review", "CTO", ["CLO"], "Two gaps: vendor risk and access reviews.", "## Findings\n- Vendor risk management: **missing**\n- Access reviews: **incomplete**", 9),
  ]);

  // ---------------- studio jobs ----------------
  const job = async (request: string, title: string, cap: string, artifact: string, lead: ExecutiveRoleCode, contrib: ExecutiveRoleCode[], status: "IN_PROGRESS" | "AWAITING_REVIEW" | "COMPLETED", ago: number, content?: string) => {
    const id = newId();
    await d.productionJobs.insert({ id, organization_id: orgId, project_id: null, requested_by: user.id, request, title, artifact_type: artifact, capability_key: cap, lead_executive_id: E(lead).id, contributor_executive_ids: contrib.map((r) => E(r).id), status, priority: "NORMAL", provider: "simulated", model: "demo-seed", created_at: daysAgo(ago), started_at: daysAgo(ago), completed_at: status === "IN_PROGRESS" ? null : daysAgo(ago), metadata: {} });
    if (content) await d.artifacts.insert({ id: newId(), organization_id: orgId, job_id: id, version: 1, artifact_type: artifact, content, file_id: null, revision_note: null, simulated: true, created_at: daysAgo(ago) });
  };
  await job("Build our investor update for the seed extension.", "Investor update for the seed extension", "fundraising_strategy", "Fundraising Strategy", "CFO", ["CEO", "CCO"], "AWAITING_REVIEW", 1, "# Investor Update — Seed Extension\n\n## Highlights\n- ARR **$640K** across 58 organizations\n- Enterprise tier launching Q3\n\n## The ask\n$1.5M SAFE extension.\n\n## Human review checklist\n- [ ] Verify figures\n- [ ] Approve before sending externally");
  await job("Create the Enterprise launch marketing campaign.", "Enterprise launch marketing campaign", "marketing_campaign", "Campaign Plan", "CCO", ["CFO"], "IN_PROGRESS", 0.5);
  await job("Draft an access-review policy for SOC 2.", "Access-review policy for SOC 2", "hr_plan", "HR Plan", "CHRO", ["CLO"], "COMPLETED", 8, "# Quarterly Access Review Policy\n\n1. Scope\n2. Owners\n3. Cadence: quarterly\n4. Evidence retention: 12 months");

  // ---------------- CEO intelligence, approvals, notifications ----------------
  await d.ceoIntelligence.insertMany([
    { id: newId(), organization_id: orgId, owner_user_id: user.id, kind: "PRINCIPLE", title: "Customer before competitor", content: "I make decisions by asking what our best customer would want, not what competitors are doing.", included: true, created_at: daysAgo(30) },
    { id: newId(), organization_id: orgId, owner_user_id: user.id, kind: "PREFERENCE", title: "Written decisions", content: "Every decision over $25K gets a one-page written memo before approval.", included: true, created_at: daysAgo(30) },
  ]);
  await d.approvals.insert({ id: newId(), organization_id: orgId, proposed_by_executive_id: E("CCO").id, action_type: "SEND_EXTERNAL_EMAIL", summary: "Send Enterprise launch announcement to 58 customers", payload: { recipients: 58 }, status: "PENDING", reviewed_by: null, created_at: daysAgo(0.3) });
  for (const [title, message, url, ago] of [
    ["Finished Work ready", "CFO completed \"Investor update for the seed extension\".", "/studio", 1],
    ["Memory needs confirmation", "\"Meridian Partners channel terms\" was proposed by an executive.", "/memory", 2],
    ["Executive response ready", "The Chief Legal Officer replied in Executive Comms.", "/comms", 2],
  ] as const) {
    await d.notifications.insert({ id: newId(), organization_id: orgId, user_id: user.id, type: "info", title, message, target_url: url, read_at: null, created_at: daysAgo(ago) });
  }
}
