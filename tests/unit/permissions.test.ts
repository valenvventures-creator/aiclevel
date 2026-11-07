import { describe, expect, it } from "vitest";
import { assignableRoles, assertCan, AuthorizationError, can } from "@/server/auth/permissions";

describe("role-based authorization", () => {
  it("grants owners every protected capability", () => {
    expect(can("OWNER", "org.delete")).toBe(true);
    expect(can("OWNER", "billing.manage")).toBe(true);
    expect(can("OWNER", "ceo_intelligence.manage")).toBe(true);
  });
  it("withholds protected owner actions from admins", () => {
    expect(can("ADMIN", "team.invite")).toBe(true);
    expect(can("ADMIN", "org.delete")).toBe(false);
    expect(can("ADMIN", "org.transfer_ownership")).toBe(false);
    expect(can("ADMIN", "ceo_intelligence.manage")).toBe(false);
  });
  it("keeps viewers read-only", () => {
    expect(can("VIEWER", "memory.read")).toBe(true);
    for (const c of ["memory.write", "comms.send", "sessions.create", "files.upload", "conversations.create"] as const) expect(can("VIEWER", c)).toBe(false);
  });
  it("restricts advisors to collaboration", () => {
    expect(can("ADVISOR", "executives.use")).toBe(true);
    expect(can("ADVISOR", "team.read")).toBe(false);
    expect(can("ADVISOR", "memory.write")).toBe(false);
  });
  it("prevents privilege escalation through invitations", () => {
    expect(assignableRoles("OWNER")).not.toContain("OWNER");
    expect(assignableRoles("ADMIN")).not.toContain("ADMIN");
    expect(assignableRoles("MEMBER")).toEqual([]);
  });
  it("throws a typed error", () => {
    expect(() => assertCan("MEMBER", "team.invite")).toThrow(AuthorizationError);
  });
});
