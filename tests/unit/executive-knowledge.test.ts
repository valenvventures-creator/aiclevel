import { describe, expect, it } from "vitest";

const { seedExecutivesForOrganization } = await import("@/server/executives/seed");
const { AIExecutiveRegistry } = await import("@/server/executives/registry");
const { addLibraryItem } = await import("@/server/executives/library");
const { db } = await import("@/server/db/store");
const { storeFile, listCompanyFiles } = await import("@/server/files/service");
const { rankDocumentExcerpts, splitPassages } = await import("@/server/files/company-documents");
const { assembleExecutiveContext } = await import("@/server/ai/executives/context");

const org = { id: "org-knowledge", name: "Knowledge Test", slug: "knowledge-test", logo_url: null, owner_id: "u1", industry: null, subscription_status: "TRIAL" as const, is_demo: false, created_at: new Date().toISOString() };
const enc = (s: string) => new TextEncoder().encode(s);

describe("company documents (shared by all seven executives)", () => {
  it("splits documents into passages that keep paragraphs together", () => {
    const parts = splitPassages("Alpha paragraph.\n\nBeta paragraph.\n\n" + "x".repeat(50), 40);
    expect(parts[0]).toBe("Alpha paragraph.\n\nBeta paragraph.");
    expect(parts.slice(1).join("")).toBe("x".repeat(50));
  });

  it("picks the passages that match the question", () => {
    const files = [
      { id: "f1", filename: "Operating plan.txt", extracted_text: "Hiring plan: two account executives in Q3.\n\nRevenue target is 1.2 million dollars with burn of 68 thousand per month." },
      { id: "f2", filename: "Brand guide.txt", extracted_text: "Our tone is warm and confident. Use the gold crest on dark backgrounds." },
    ];
    const out = rankDocumentExcerpts(files, "What is our revenue target and monthly burn?");
    expect(out[0]).toMatchObject({ fileId: "f1" });
    expect(out[0].excerpt).toContain("Revenue target");
    expect(out.some((o) => o.fileId === "f2")).toBe(false);
  });
});

describe("each executive's own knowledge vs company documents", () => {
  it("company documents reach every executive; a private upload reaches only its executive", async () => {
    await seedExecutivesForOrganization(org.id);
    const [cfo, cco] = await Promise.all([AIExecutiveRegistry.getByRole(org.id, "CFO"), AIExecutiveRegistry.getByRole(org.id, "CCO")]);

    // A company-wide document (Files tab / onboarding).
    const company = await storeFile({ organization: org, userId: "u1", filename: "Operating plan.txt", bytes: enc("Revenue target is 1.2 million dollars. Monthly burn is 68 thousand dollars.") });
    // A document uploaded in the CFO's Learning tab.
    const priv = await storeFile({ organization: org, userId: "u1", filename: "CFO pricing model.txt", bytes: enc("Discount approval matrix: discounts above 15 percent need CFO sign-off on revenue deals."), executiveId: cfo!.id });
    await addLibraryItem(org.id, "u1", cfo!.id, { kind: "DOCUMENT", title: priv.filename, content: priv.extracted_text!, fileId: priv.id });

    // The private file stays out of Files and out of C-Level Memory.
    expect((await listCompanyFiles(org.id)).map((f) => f.id)).toEqual([company.id]);
    const memory = await db().memory.list(org.id);
    expect(memory.some((m) => m.title.includes("CFO pricing model"))).toBe(false);
    expect(memory.some((m) => m.title.includes("Operating plan"))).toBe(true);

    const query = "What revenue target, burn and discount approval rules apply?";
    const ask = async (role: "CFO" | "CCO") =>
      assembleExecutiveContext({ organization: org, viewerRole: "OWNER", exec: (await AIExecutiveRegistry.resolve(org.id, (role === "CFO" ? cfo : cco)!.id))!, query });
    const [forCfo, forCco] = await Promise.all([ask("CFO"), ask("CCO")]);

    // Both executives draw on the company document — including the CCO, whose focus areas exclude documents.
    expect(forCfo.system).toContain("# COMPANY DOCUMENTS");
    expect(forCfo.system).toContain("Operating plan.txt");
    expect(forCco.system).toContain("Operating plan.txt");
    expect(forCco.documentFileIds).toEqual([company.id]);
    // Only the CFO sees its private document.
    expect(forCfo.system).toContain("Discount approval matrix");
    expect(forCco.system).not.toContain("Discount approval matrix");
  });

  it("every executive draws on all of C-Level Memory, not only its focus areas", async () => {
    const { newId, nowIso } = await import("@/server/db/store");
    const now = nowIso();
    await db().memory.insert({
      id: newId(), organization_id: org.id, project_id: null, title: "Cash runway", content: "Cash runway is 14 months at the current monthly burn.", category: "FINANCE", importance: 4, status: "VERIFIED", pinned: false,
      source_type: "HUMAN_ENTRY", source_id: null, executive_relevance: [], visibility: "ORGANIZATION", confidence: 1, created_by: "u1", verified_by: "u1", embedding: null, created_at: now, updated_at: now,
    } as never);
    const cco = await AIExecutiveRegistry.getByRole(org.id, "CCO");
    expect(cco!.id).toBeTruthy();
    const resolved = (await AIExecutiveRegistry.resolve(org.id, cco!.id))!;
    expect(resolved.model.memory_categories).not.toContain("FINANCE");
    const built = await assembleExecutiveContext({ organization: org, viewerRole: "MEMBER", exec: resolved, query: "How long is our cash runway?" });
    expect(built.system).toContain("Cash runway is 14 months");
  });
});
