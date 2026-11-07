import { describe, expect, it } from "vitest";
import { db } from "@/server/db/store";

describe("tenant data layer (demo backend)", () => {
  it("never reads, updates or deletes across organizations", async () => {
    const d = db();
    await d.projects.insert({ id: "p1", organization_id: "org-a", name: "A", description: "", status: "ACTIVE", owner_id: "u", created_at: "" });
    expect(await d.projects.get("org-b", "p1")).toBeNull();
    expect(await d.projects.list("org-b")).toHaveLength(0);
    expect(await d.projects.update("org-b", "p1", { name: "hijack" })).toBeNull();
    expect(await d.projects.remove("org-b", "p1")).toBe(false);
    expect((await d.projects.get("org-a", "p1"))?.name).toBe("A");
  });
  it("cannot move a record to another organization via update", async () => {
    const d = db();
    await d.projects.insert({ id: "p2", organization_id: "org-a", name: "A", description: "", status: "ACTIVE", owner_id: "u", created_at: "" });
    await d.projects.update("org-a", "p2", { organization_id: "org-b" } as never);
    expect(await d.projects.get("org-a", "p2")).not.toBeNull();
    expect(await d.projects.get("org-b", "p2")).toBeNull();
  });
  it("returns copies so callers cannot mutate stored rows", async () => {
    const d = db();
    const row = await d.projects.get("org-a", "p1");
    row!.name = "mutated";
    expect((await d.projects.get("org-a", "p1"))?.name).toBe("A");
  });
});
