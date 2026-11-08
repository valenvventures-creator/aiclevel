import { describe, expect, it } from "vitest";
import { estimateCost, routeTask } from "@/server/ai/gateway/routing";
import { safeNext, signupSchema } from "@/server/auth/schemas";
import { EXECUTIVE_SEEDS } from "@/config/executives/defaults";
import { greeting } from "@/lib/utils";

describe("model routing", () => {
  it("sends utility tasks to the fast model", () => {
    expect(routeTask("studio_routing").model).toBe("claude-haiku-5-5");
    expect(routeTask("memory_extraction", { provider: "anthropic", model: "claude-opus-5-5" }).model).toBe("claude-haiku-5-5");
  });
  it("uses the executive's configured model for strategic work", () => {
    const r = routeTask("executive_conversation", { provider: "anthropic", model: "claude-opus-5-5", fallbackProvider: "openai", fallbackModel: "gpt-5", effort: "high" });
    expect(r).toMatchObject({ model: "claude-opus-5-5", fallbackModel: "gpt-5", effort: "high" });
  });
  it("estimates cost", () => {
    expect(estimateCost("claude-opus-5-5", 1_000_000, 0)).toBe(4);
  });
});

describe("auth validation", () => {
  it("rejects open redirects", () => {
    expect(safeNext("https://evil.com")).toBe("/hq");
    expect(safeNext("//evil.com")).toBe("/hq");
    expect(safeNext("/sessions/1")).toBe("/sessions/1");
  });
  it("requires terms, privacy and matching strong passwords", () => {
    const ok = { first_name: "A", last_name: "B", email: "a@b.co", password: "correcthorse1", confirm_password: "correcthorse1", accept_terms: "on", accept_privacy: "on" };
    expect(signupSchema.safeParse(ok).success).toBe(true);
    expect(signupSchema.safeParse({ ...ok, confirm_password: "nope" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...ok, password: "short", confirm_password: "short" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...ok, accept_terms: undefined }).success).toBe(false);
  });
});

describe("the seven-executive C-Level", () => {
  it("has exactly seven core executives in the canonical order", () => {
    expect(EXECUTIVE_SEEDS.map((e) => e.role_code)).toEqual(["CEO", "CFO", "CCO", "CHRO", "CTO", "CLO", "CIO"]);
    expect(new Set(EXECUTIVE_SEEDS.map((e) => e.slug)).size).toBe(7);
  });
  it("greets by time of day", () => {
    expect(greeting("Valen", "UTC", new Date("2026-01-01T08:00:00Z"))).toBe("Good morning, Valen.");
    expect(greeting("Valen", "UTC", new Date("2026-01-01T15:00:00Z"))).toBe("Good afternoon, Valen.");
  });
});
