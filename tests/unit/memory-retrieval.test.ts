import { describe, expect, it } from "vitest";
import { canView, rankMemories } from "@/server/memory/retrieval";
import { memory } from "./fixtures";

const base = { organizationId: "org-a", viewerRole: "MEMBER" as const };

describe("C-Level Memory retrieval", () => {
  it("never returns another organization's memory", () => {
    const rows = [memory({ title: "Runway", content: "14 months runway" }), memory({ title: "Runway", content: "14 months runway", organization_id: "org-b" })];
    const out = rankMemories(rows, { ...base, query: "runway" });
    expect(out).toHaveLength(1);
    expect(out.every((r) => r.record.organization_id === "org-a")).toBe(true);
  });
  it("excludes archived records and enforces visibility", () => {
    const rows = [memory({ title: "Runway", content: "runway", status: "ARCHIVED" }), memory({ title: "Runway secret", content: "runway", visibility: "OWNER_ONLY" })];
    expect(rankMemories(rows, { ...base, query: "runway" })).toHaveLength(0);
    expect(rankMemories(rows, { ...base, viewerRole: "OWNER", query: "runway" })).toHaveLength(1);
    expect(canView(memory({ title: "x", content: "y", visibility: "LEADERSHIP" }), "EXECUTIVE")).toBe(true);
    expect(canView(memory({ title: "x", content: "y", visibility: "LEADERSHIP" }), "MEMBER")).toBe(false);
  });
  it("respects executive memory-category permissions", () => {
    const rows = [memory({ title: "Burn rate", content: "burn rate monthly", category: "FINANCE" }), memory({ title: "Burn rate brand", content: "burn rate monthly", category: "BRAND" })];
    const out = rankMemories(rows, { ...base, query: "burn rate", allowedCategories: ["FINANCE"] });
    expect(out.map((r) => r.record.category)).toEqual(["FINANCE"]);
  });
  it("lets every executive recall approved decisions, but not unverified ones", () => {
    const rows = [
      memory({ title: "Decision: UK expansion", content: "UK expansion pilot approved", category: "DECISIONS", status: "VERIFIED" }),
      memory({ title: "Decision draft: UK expansion", content: "UK expansion pilot proposed", category: "DECISIONS", status: "PROPOSED" }),
    ];
    // e.g. the CHRO, whose categories do not include DECISIONS
    const out = rankMemories(rows, { ...base, query: "UK expansion pilot", allowedCategories: ["HR", "PEOPLE"] });
    expect(out.map((r) => r.record.status)).toEqual(["VERIFIED"]);
  });
  it("ranks verified above proposed for equal relevance", () => {
    const rows = [memory({ title: "Pricing", content: "enterprise pricing annual", status: "PROPOSED" }), memory({ title: "Pricing", content: "enterprise pricing annual", status: "VERIFIED" })];
    const out = rankMemories(rows, { ...base, query: "enterprise pricing" });
    expect(out[0].record.status).toBe("VERIFIED");
  });
  it("returns only the top-k, never the whole memory", () => {
    const rows = Array.from({ length: 50 }, (_, i) => memory({ title: `Fact ${i}`, content: "customer churn analysis" }));
    expect(rankMemories(rows, { ...base, query: "churn", limit: 8 })).toHaveLength(8);
  });
});
