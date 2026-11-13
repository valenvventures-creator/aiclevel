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
  it("lets every executive draw on all of C-Level Memory, ranking its focus areas first", () => {
    const rows = [memory({ title: "Burn rate brand", content: "burn rate monthly", category: "BRAND" }), memory({ title: "Burn rate", content: "burn rate monthly", category: "FINANCE" })];
    // A CFO-style focus ranks Finance first, but the Brand entry is still available.
    const cfo = rankMemories(rows, { ...base, query: "burn rate", focusCategories: ["FINANCE"] });
    expect(cfo.map((r) => r.record.category)).toEqual(["FINANCE", "BRAND"]);
    // A CCO-style focus (no Finance) still sees the Finance entry.
    const cco = rankMemories(rows, { ...base, query: "burn rate", focusCategories: ["BRAND", "COMMUNICATIONS"] });
    expect(cco.map((r) => r.record.category)).toEqual(["BRAND", "FINANCE"]);
  });
  it("still applies the asking person's visibility, whatever the executive", () => {
    const rows = [memory({ title: "Board salary bands", content: "salary bands board", category: "HR", visibility: "LEADERSHIP" })];
    expect(rankMemories(rows, { ...base, query: "salary bands", focusCategories: "ALL" })).toHaveLength(0);
    expect(rankMemories(rows, { ...base, viewerRole: "ADMIN", query: "salary bands", focusCategories: ["FINANCE"] })).toHaveLength(1);
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
