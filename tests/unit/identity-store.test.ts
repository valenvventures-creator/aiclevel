import { describe, expect, it } from "vitest";
import { demoIdentity } from "@/server/auth/identity";
import { ensureDemoSeeded, DEMO_CREDENTIALS, DEMO_ORG_ID } from "@/server/db/demo-seed";
import { listMembershipsForUser } from "@/server/organizations/service";

describe("identity store (non-Supabase backend)", () => {
  it("registers, logs in and rejects duplicate emails case-insensitively", async () => {
    const u = await demoIdentity.createUser({ email: "Ada@Example.com", password: "correct-horse-1", first_name: "Ada", last_name: "L" });
    expect(u.email).toBe("ada@example.com");
    await expect(demoIdentity.createUser({ email: "ada@example.com", password: "x", first_name: "A", last_name: "B" })).rejects.toThrow("EMAIL_TAKEN");
    expect((await demoIdentity.checkPassword("ADA@example.com", "correct-horse-1")).ok).toBe(true);
    expect((await demoIdentity.checkPassword("ada@example.com", "wrong"))).toEqual({ ok: false, reason: "INVALID" });
  });

  it("reset tokens are single use", async () => {
    const u = await demoIdentity.createUser({ email: "grace@example.com", password: "correct-horse-1", first_name: "Grace", last_name: "H" });
    const token = await demoIdentity.issueToken(u.id, "RESET_PASSWORD", 60_000);
    expect(await demoIdentity.peekToken(token, "RESET_PASSWORD")).toBe(true);
    expect(await demoIdentity.consumeToken(token, "VERIFY_EMAIL")).toBeNull();
    expect(await demoIdentity.consumeToken(token, "RESET_PASSWORD")).toBe(u.id);
    expect(await demoIdentity.consumeToken(token, "RESET_PASSWORD")).toBeNull();
  });

  it("seeds the demo organization exactly once, even when called concurrently", async () => {
    await Promise.all([ensureDemoSeeded(), ensureDemoSeeded(), ensureDemoSeeded()]);
    const demo = await demoIdentity.findByEmail(DEMO_CREDENTIALS.email);
    expect(demo).toBeDefined();
    const memberships = await listMembershipsForUser(demo!.id);
    expect(memberships).toHaveLength(1);
    expect(memberships[0].organization.id).toBe(DEMO_ORG_ID);
    expect(memberships[0].member.role).toBe("OWNER");
  });
});
