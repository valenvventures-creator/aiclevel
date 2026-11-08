import { describe, expect, it } from "vitest";

const { seedExecutivesForOrganization } = await import("@/server/executives/seed");
const { db, newId, nowIso } = await import("@/server/db/store");
const { upgradeStoredLabels, LEGACY_MINUTES_TYPE, renameLabel } = await import("@/server/organizations/stored-labels");

const ORG = "org-stored-labels";

describe("C-Suite → C-Level stored wording", () => {
  it("renames both casings", () => {
    expect(renameLabel("C-Suite Session · C-SUITE MEMORY")).toBe("C-Level Session · C-LEVEL MEMORY");
  });

  it("upgrades seeded executive text and the minutes report type, leaving customer text alone", async () => {
    const [ceo] = await seedExecutivesForOrganization(ORG);
    const d = db();
    await d.executives.update(ORG, ceo.id, { description: "Chairs C-Suite Sessions by default." });
    const [persona] = await d.personas.list(ORG, { where: { executive_id: ceo.id } });
    await d.personas.update(ORG, persona.id, { system_instructions: "When chairing a C-Suite Session, synthesize." });
    const reportId = newId();
    await d.reports.insert({
      id: reportId, organization_id: ORG, project_id: null, report_type: LEGACY_MINUTES_TYPE as never, title: "Minutes — our C-Suite offsite", summary: "", content: "",
      lead_executive_id: ceo.id, contributing_executive_ids: [], sources: [], version: 1, source_session_id: null, simulated: false, created_by: "u1", created_at: nowIso(),
    });

    await upgradeStoredLabels({ id: ORG, is_demo: false });

    expect((await d.executives.get(ORG, ceo.id))?.description).toBe("Chairs C-Level Sessions by default.");
    expect((await d.personas.get(ORG, persona.id))?.system_instructions).toBe("When chairing a C-Level Session, synthesize.");
    const report = await d.reports.get(ORG, reportId);
    expect(report?.report_type).toBe("C-Level Session Minutes");
    expect(report?.title).toBe("Minutes — our C-Suite offsite"); // a customer's own words stay as written
  });
});
