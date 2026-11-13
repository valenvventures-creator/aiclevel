import { describe, expect, it } from "vitest";
import { can } from "@/server/auth/permissions";
import { detectDelimiter, parseDelimited, readXlsx, safeCell, writeDelimited, writeXlsx } from "@/server/crm/spreadsheet";
import { summarizePipeline } from "@/lib/crm-summary";

const { db } = await import("@/server/db/store");
const { createContact, createDeal, moveDeal, setDealLost, ContactInput, DealInput, matchesContact } = await import("@/server/crm/service");
const { dateFrom, exportRows, importRows, suggestMapping } = await import("@/server/crm/transfer");

describe("CRM spreadsheets", () => {
  it("parses quoted CSV fields, escaped quotes and line breaks", () => {
    const rows = parseDelimited('Name,Notes\n"Okafor, Maya","She said ""yes""\nthen left"\n\nReyes,ok\r\n');
    expect(rows).toEqual([["Name", "Notes"], ["Okafor, Maya", 'She said "yes"\nthen left'], ["Reyes", "ok"]]);
  });

  it("detects semicolon- and tab-separated files", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(detectDelimiter("a,b")).toBe(",");
  });

  it("guards exports against spreadsheet formula injection", () => {
    expect(safeCell("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(safeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(safeCell("-42")).toBe("-42");
    expect(writeDelimited([["a", "b,c"], ["=1+1", 'say "hi"']], ",")).toBe('﻿a,"b,c"\r\n\'=1+1,"say ""hi"""\r\n');
  });

  it("writes Excel files that read back cell for cell", async () => {
    const rows = [["Deal Name", "Amount", "Notes"], ["Acme & Co <pilot>", "48000", "multi\nline"], ["Beta", "", "x"]];
    expect(await readXlsx(await writeXlsx(rows, "Deals"))).toEqual(rows);
  });

  it("reads dates in ISO, US and Excel serial formats", () => {
    expect(dateFrom("2026-12-31")).toBe("2026-12-31");
    expect(dateFrom("12/31/2026")).toBe("2026-12-31");
    expect(dateFrom("46387")).toBe("2026-12-31");
    expect(dateFrom("not a date")).toBeNull();
  });
});

describe("CRM import mapping", () => {
  it("matches common and Zoho CRM export headers", () => {
    expect(suggestMapping(["First Name", "Last Name", "Email", "Account Name", "Mailing City", "Lead Source", "Mystery"], "contacts")).toEqual(["first_name", "last_name", "email", "company", "city", "lead_source", ""]);
    expect(suggestMapping(["Deal Name", "Stage", "Amount", "Closing Date", "Contact Name"], "deals")).toEqual(["name", "stage", "amount", "expected_close", "contact_name"]);
  });
});

describe("CRM records, pipeline and import/export", () => {
  const org = "org-crm";

  it("validates contacts and deals", () => {
    expect(ContactInput.safeParse({ last_name: "" }).success).toBe(false);
    expect(ContactInput.safeParse({ last_name: "Okafor", email: "not-an-email" }).success).toBe(false);
    const c = ContactInput.parse({ last_name: "Okafor", email: " Maya@Example.com ", tags: "vip, enterprise, vip", email_opt_out: "on" });
    expect(c).toMatchObject({ email: "maya@example.com", tags: ["vip", "enterprise"], email_opt_out: true, lead_status: "NEW", phone: null });
    expect(DealInput.parse({ name: "Pilot", amount: "$48,000.50" }).amount).toBe(48000.5);
    expect(DealInput.safeParse({ name: "Pilot", amount: "-5" }).success).toBe(false);
  });

  it("moves deals through the pipeline, logging each stage and marking won contacts as customers", async () => {
    const contact = await createContact(org, "u1", ContactInput.parse({ first_name: "Maya", last_name: "Okafor", email: "maya@northwind.example", company: "Northwind" }));
    const deal = await createDeal(org, "u1", DealInput.parse({ name: "Northwind plan", amount: 96000, contact_id: contact.id }));
    expect(deal).toMatchObject({ stage: "PROSPECT", probability: 10, company: "Northwind", owner_id: "u1", status: "OPEN" });

    const presented = await moveDeal(org, "u1", deal.id, "PRESENTATION");
    expect(presented.probability).toBe(40);
    await moveDeal(org, "u1", deal.id, "ONBOARD");
    expect((await db().crmContacts.get(org, contact.id))?.lead_status).toBe("CUSTOMER");
    const history = (await db().crmActivities.list(org, { where: { deal_id: deal.id } })).map((a) => a.subject);
    expect(history).toEqual(expect.arrayContaining(["Deal created in Prospect", "Prospect → Presentation", "Presentation → Onboard"]));
    expect(matchesContact(contact, "northwind maya")).toBe(true);
    expect(matchesContact(contact, "acme")).toBe(false);
  });

  it("summarizes the pipeline: open value, weighted forecast, won and win rate", () => {
    const s = summarizePipeline([
      { stage: "PROSPECT", amount: 10000, probability: 10, status: "OPEN" },
      { stage: "CLOSE", amount: 20000, probability: 80, status: "OPEN" },
      { stage: "MANAGE", amount: 50000, probability: 100, status: "OPEN" },
      { stage: "FOLLOW_UP", amount: 99999, probability: 60, status: "LOST" },
    ]);
    expect(s).toMatchObject({ openValue: 30000, openCount: 2, weightedForecast: 17000, wonValue: 50000, wonCount: 1, lostCount: 1, winRate: 50 });
    expect(s.stages.find((x) => x.stage === "CLOSE")).toEqual({ stage: "CLOSE", count: 1, amount: 20000 });
  });

  it("keeps lost deals off the board totals", async () => {
    const deal = await createDeal(org, "u1", DealInput.parse({ name: "Lost one", amount: 5000, stage: "FOLLOW_UP" }));
    const lost = await setDealLost(org, "u1", deal.id, true, "Budget cut");
    expect(lost).toMatchObject({ status: "LOST", lost_reason: "Budget cut" });
  });

  it("imports contacts (skipping or updating duplicates by email) and deals linked by contact email", async () => {
    const o = "org-crm-import";
    await createContact(o, "u1", ContactInput.parse({ first_name: "Daniel", last_name: "Reyes", email: "daniel@brightpath.example" }));
    const headers = ["Full Name", "Email", "Account Name", "Lead Status", "Tag"];
    const rows = [
      ["Priya Nair", "priya@lumen.example", "Lumen", "Qualified", "enterprise; uk"],
      ["Daniel Reyes", "DANIEL@brightpath.example", "Brightpath Health", "Customer", ""],
      ["", "nobody@example.com", "", "", ""],
    ];
    const mapping = suggestMapping(headers, "contacts");
    const skip = await importRows(o, "u1", { entity: "contacts", headers, rows, mapping, duplicates: "skip" });
    expect(skip).toMatchObject({ created: 1, updated: 0, skipped: 2 });
    expect(skip.errors).toEqual([{ row: 4, message: "Add a last name." }]);
    const priya = (await db().crmContacts.list(o)).find((c) => c.last_name === "Nair")!;
    expect(priya).toMatchObject({ first_name: "Priya", company: "Lumen", lead_status: "QUALIFIED", tags: ["enterprise", "uk"] });

    const upd = await importRows(o, "u1", { entity: "contacts", headers, rows: [rows[1]], mapping, duplicates: "update" });
    expect(upd).toMatchObject({ created: 0, updated: 1 });
    expect((await db().crmContacts.list(o)).find((c) => c.last_name === "Reyes")).toMatchObject({ company: "Brightpath Health", lead_status: "CUSTOMER" });

    const dealHeaders = ["Deal Name", "Stage", "Amount", "Closing Date", "Contact Email"];
    const deals = await importRows(o, "u1", {
      entity: "deals", headers: dealHeaders, mapping: suggestMapping(dealHeaders, "deals"), duplicates: "skip",
      rows: [["Lumen program", "Negotiation/Review", "42,000", "12/31/2026", "priya@lumen.example"], ["Mystery", "Somewhere", "1", "", ""], ["Old one", "Closed Lost", "900", "", ""]],
    });
    expect(deals.created).toBe(2);
    expect(deals.errors[0].message).toMatch(/Unknown stage/);
    const all = await db().crmDeals.list(o);
    expect(all.find((d) => d.name === "Lumen program")).toMatchObject({ stage: "FOLLOW_UP", amount: 42000, expected_close: "2026-12-31", contact_id: priya.id, company: "Lumen", probability: 60 });
    expect(all.find((d) => d.name === "Old one")?.status).toBe("LOST");

    const exported = await exportRows(o, "deals");
    expect(exported[0]).toContain("Deal Name");
    const row = exported.find((r) => r[0] === "Lumen program")!;
    expect(row).toEqual(expect.arrayContaining(["Follow Up", "42000", "priya@lumen.example", "Priya Nair", "Open"]));
    expect((await exportRows(o, "contacts", { template: true })).length).toBe(1);
  });
});

describe("CRM permissions", () => {
  it("lets members work the pipeline, operators delete and transfer, and keeps advisors out", () => {
    expect(can("MEMBER", "crm.write")).toBe(true);
    expect(can("MEMBER", "crm.delete")).toBe(false);
    expect(can("MEMBER", "crm.transfer")).toBe(false);
    expect(can("EXECUTIVE", "crm.transfer")).toBe(true);
    expect(can("VIEWER", "crm.read")).toBe(true);
    expect(can("VIEWER", "crm.write")).toBe(false);
    expect(can("ADVISOR", "crm.read")).toBe(false);
  });
});
