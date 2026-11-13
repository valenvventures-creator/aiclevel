import "server-only";
import { STAGE_BY_KEY } from "@/config/crm";
import { db, newId } from "./store";
import { records } from "./records";
import type { CrmActivity, CrmContact, CrmDeal, CrmLeadSource, CrmLeadStatus, CrmStage } from "@/types/domain";

/**
 * Sample CRM data for the demo organization: contacts and a pipeline with
 * deals in every stage. Added once per database (its own marker), so demo
 * organizations created before the CRM existed get it too.
 */
const MARKER = "demo_crm_v1";

const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();
const inDays = (days: number) => new Date(Date.now() + days * day).toISOString().slice(0, 10);

type C = [first: string, last: string, title: string, company: string, email: string, phone: string, city: string, country: string, source: CrmLeadSource, status: CrmLeadStatus, tags: string[]];
const CONTACTS: C[] = [
  ["Maya", "Okafor", "VP Operations", "Northwind Logistics", "maya.okafor@northwind.example", "+1 312 555 0141", "Chicago", "United States", "TRADE_SHOW", "QUALIFIED", ["enterprise"]],
  ["Daniel", "Reyes", "Founder & CEO", "Brightpath Health", "daniel@brightpath.example", "+1 415 555 0179", "San Francisco", "United States", "EXTERNAL_REFERRAL", "QUALIFIED", ["referral", "healthcare"]],
  ["Priya", "Nair", "Chief People Officer", "Lumen Analytics", "priya.nair@lumen.example", "+44 20 7946 0321", "London", "United Kingdom", "WEBSITE", "CONTACTED", ["enterprise"]],
  ["Tom", "Becker", "Managing Director", "Becker & Sons Manufacturing", "t.becker@beckersons.example", "+49 30 5550 1123", "Berlin", "Germany", "COLD_CALL", "ATTEMPTED_TO_CONTACT", []],
  ["Sofia", "Marquez", "COO", "Alto Ventures", "sofia@altoventures.example", "+52 55 5550 2245", "Mexico City", "Mexico", "PARTNER", "QUALIFIED", ["partner"]],
  ["James", "Whitaker", "CFO", "Harbor Freight Partners", "jwhitaker@harborfp.example", "+1 617 555 0102", "Boston", "United States", "SEMINAR", "CUSTOMER", ["enterprise"]],
  ["Aisha", "Rahman", "Head of Strategy", "Crescent Retail Group", "aisha.rahman@crescent.example", "+971 4 555 0190", "Dubai", "United Arab Emirates", "SOCIAL_MEDIA", "NEW", []],
  ["Liam", "O'Connor", "Executive Director", "Greenfield Foundation", "liam@greenfield.example", "+353 1 555 0177", "Dublin", "Ireland", "PUBLIC_RELATIONS", "CUSTOMER", ["nonprofit"]],
  ["Hannah", "Kim", "President", "Summit Dental Group", "hkim@summitdental.example", "+1 206 555 0133", "Seattle", "United States", "WEB_FORM", "CONTACTED", ["healthcare"]],
  ["Marco", "Bianchi", "Owner", "Bianchi Hospitality", "marco@bianchihosp.example", "+39 02 5550 4410", "Milan", "Italy", "EMAIL_CAMPAIGN", "NEW", []],
  ["Grace", "Liu", "CEO", "Peakline Software", "grace.liu@peakline.example", "+1 512 555 0166", "Austin", "United States", "EMPLOYEE_REFERRAL", "CUSTOMER", ["referral"]],
];

type D = [contact: number, name: string, amount: number, stage: CrmStage, closeInDays: number, next: string, stageDays: number];
const DEALS: D[] = [
  [6, "Crescent Retail — leadership advisory pilot", 18000, "PROSPECT", 75, "Research their expansion plans before first contact", 3],
  [9, "Bianchi Hospitality — C-Level subscription", 9600, "PROSPECT", 90, "Find the right decision maker", 1],
  [3, "Becker & Sons — operating plan review", 24000, "APPROACH_CONTACT", 60, "Second call attempt on Thursday", 5],
  [8, "Summit Dental — expansion strategy", 31000, "APPROACH_CONTACT", 55, "Send intro deck after the discovery call", 2],
  [2, "Lumen Analytics — people strategy program", 42000, "PRESENTATION", 40, "Present the CHRO workshop agenda", 6],
  [0, "Northwind Logistics — annual leadership plan", 96000, "PRESENTATION", 35, "Demo C-Level Sessions to the exec team", 4],
  [1, "Brightpath Health — board readiness", 54000, "FOLLOW_UP", 21, "Answer security questionnaire", 9],
  [4, "Alto Ventures — portfolio advisory", 72000, "FOLLOW_UP", 18, "Follow up on pricing questions", 3],
  [0, "Northwind Logistics — CFO toolkit add-on", 15000, "CLOSE", 7, "Contract with their legal team", 2],
  [1, "Brightpath Health — pilot extension", 12000, "CLOSE", 5, "Signature expected this week", 1],
  [5, "Harbor Freight — enterprise rollout", 128000, "ONBOARD", -10, "Kick-off workshop with all seven executives", 8],
  [10, "Peakline Software — growth plan", 36000, "ONBOARD", -4, "Upload their foundational documents", 3],
  [7, "Greenfield Foundation — impact strategy", 22000, "MANAGE", -60, "Quarterly review in two weeks", 45],
  [5, "Harbor Freight — 2025 renewal", 48000, "MANAGE", -120, "Discuss expansion to the finance team", 90],
];

export async function ensureDemoCrm(orgId: string, userId: string): Promise<void> {
  const store = records();
  // Claim the marker first so concurrent instances never seed twice.
  if (!(await store.insertIfAbsent("app_config", { id: MARKER, at: Date.now() }, { organizationId: "global" }))) return;
  try {
    const d = db();
    if ((await d.crmContacts.list(orgId, { limit: 1 })).length) return;
    const contacts: CrmContact[] = CONTACTS.map(([first, last, title, company, email, phone, city, country, source, status, tags], i) => ({
      id: newId(), organization_id: orgId, first_name: first, last_name: last, email, phone, mobile: null, title, company, website: `https://${email.split("@")[1]}`, industry: null,
      lead_source: source, lead_status: status, owner_id: userId, street: null, city, state: null, postal_code: null, country, linkedin: null, tags,
      description: null, email_opt_out: false, created_by: userId, created_at: ago(40 - i * 3), updated_at: ago(10 - (i % 9)),
    }));
    const deals: CrmDeal[] = DEALS.map(([ci, name, amount, stage, close, next, stageDays], i) => ({
      id: newId(), organization_id: orgId, name, contact_id: contacts[ci].id, company: contacts[ci].company, amount, currency: "USD", stage,
      probability: STAGE_BY_KEY[stage].probability, expected_close: inDays(close), deal_type: stage === "MANAGE" && i === 13 ? "RENEWAL" : "NEW_BUSINESS",
      lead_source: contacts[ci].lead_source, next_step: next, description: null, owner_id: userId, status: "OPEN", lost_reason: null,
      stage_changed_at: ago(stageDays), created_by: userId, created_at: ago(stageDays + 14), updated_at: ago(stageDays),
    }));
    deals.push({ ...deals[1], id: newId(), name: "Summit Dental — workshop series", contact_id: contacts[8].id, company: contacts[8].company, amount: 8000, stage: "PRESENTATION", status: "LOST", lost_reason: "Chose to postpone until next year", stage_changed_at: ago(20), created_at: ago(35), updated_at: ago(12) });
    const act = (kind: CrmActivity["kind"], subject: string, dealIdx: number | null, contactIdx: number, daysAgo: number, extra: Partial<CrmActivity> = {}): CrmActivity => ({
      id: newId(), organization_id: orgId, kind, subject, details: null, due_at: null, done: kind !== "TASK" && kind !== "CALL" && kind !== "MEETING",
      contact_id: contacts[contactIdx].id, deal_id: dealIdx === null ? null : deals[dealIdx].id, created_by: userId, created_at: ago(daysAgo), updated_at: ago(daysAgo), ...extra,
    });
    const activities: CrmActivity[] = [
      ...deals.map((x) => ({ id: newId(), organization_id: orgId, kind: "STAGE_CHANGE" as const, subject: `Deal created in ${STAGE_BY_KEY[x.stage].label}`, details: null, due_at: null, done: true, contact_id: x.contact_id, deal_id: x.id, created_by: userId, created_at: x.created_at, updated_at: x.created_at })),
      act("MEETING", "Discovery meeting with the executive team", 5, 0, 6, { details: "Interested in C-Level Sessions for quarterly planning. CFO wants scenario modelling.", done: true }),
      act("CALL", "Pricing questions follow-up", 7, 4, 2, { due_at: new Date(Date.now() + 2 * day).toISOString() }),
      act("TASK", "Send security questionnaire answers", 6, 1, 1, { due_at: new Date(Date.now() + 1 * day).toISOString() }),
      act("NOTE", "Prefers email; decision by end of month", 8, 0, 3, { details: "Legal review is the last step. Procurement already approved the budget." }),
      act("EMAIL", "Sent contract for signature", 9, 1, 1),
      act("TASK", "Prepare quarterly impact review", 12, 7, 4, { due_at: new Date(Date.now() + 14 * day).toISOString() }),
      act("CALL", "Intro call (no answer, left voicemail)", 2, 3, 5, { done: true }),
      act("MEETING", "Kick-off workshop", 10, 5, 2, { due_at: new Date(Date.now() + 3 * day).toISOString() }),
    ];
    await d.crmContacts.insertMany(contacts);
    await d.crmDeals.insertMany(deals);
    await d.crmActivities.insertMany(activities);
  } catch (err) {
    // Let a later sign-in try again.
    await store.remove("app_config", MARKER);
    throw err;
  }
}

/** Sample locations for the demo organization's projects (once per database; never overwrites a location). */
const PROJECT_MARKER = "demo_project_locations_v1";
const PROJECT_PLACES: Record<string, { label: string; latitude: number; longitude: number }> = {
  "Seed Extension": { label: "Northwind Capital, Boylston Street, Boston, MA", latitude: 42.3493, longitude: -71.0787 },
  "Enterprise Tier Launch": { label: "Thought Authorities HQ, Congress Avenue, Austin, TX", latitude: 30.2686, longitude: -97.7427 },
  "Founders Forward Initiative": { label: "Founders Forward Hub, West Loop, Chicago, IL", latitude: 41.8837, longitude: -87.6479 },
};

export async function ensureDemoProjectLocations(orgId: string): Promise<void> {
  const store = records();
  if (!(await store.insertIfAbsent("app_config", { id: PROJECT_MARKER, at: Date.now() }, { organizationId: "global" }))) return;
  try {
    const d = db();
    for (const p of await d.projects.list(orgId)) {
      const place = PROJECT_PLACES[p.name];
      if (place && typeof p.latitude !== "number") await d.projects.update(orgId, p.id, { location_label: place.label, latitude: place.latitude, longitude: place.longitude });
    }
  } catch (err) {
    await store.remove("app_config", PROJECT_MARKER);
    throw err;
  }
}
