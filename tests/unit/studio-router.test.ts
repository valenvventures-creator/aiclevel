import { describe, expect, it } from "vitest";
import { deriveTitle, routeStudioRequest } from "@/server/studio/router";

describe("C-Suite Studio routing — route to the right executive", () => {
  const cases: [string, string][] = [
    ["Create a three-year financial model.", "CFO"],
    ["Develop a fundraising strategy for our seed extension.", "CFO"],
    ["Create our marketing campaign.", "CCO"],
    ["Draft an HR policy.", "CHRO"],
    ["Research this technology.", "CTO"],
    ["Analyze this contract.", "CLO"],
    ["Create our sustainability report.", "CIO"],
    ["Write an executive report for the board.", "CEO"],
  ];
  it.each(cases)("%s → %s", (req, lead) => {
    expect(routeStudioRequest(req).capability.lead).toBe(lead);
  });
  it("falls back to the CEO for unclassifiable requests", () => {
    const r = routeStudioRequest("Help me think");
    expect(r.capability.lead).toBe("CEO");
    expect(r.score).toBe(0);
  });
  it("derives concise titles", () => {
    expect(deriveTitle("Please create our marketing campaign for Q3.")).toBe("Marketing campaign for Q3");
  });
});
