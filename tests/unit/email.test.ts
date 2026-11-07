import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invitationEmail, passwordResetEmail, verificationEmail } from "@/server/email/templates";

describe("email templates", () => {
  it("contain the link, escape user-supplied text and include a plain-text part", () => {
    const v = verificationEmail({ firstName: "<script>x</script>", url: "https://app.example.com/verify-email?token=abc", origin: "https://app.example.com" });
    expect(v.html).toContain("https://app.example.com/verify-email?token=abc");
    expect(v.html).not.toContain("<script>x</script>");
    expect(v.html).toContain("&lt;script&gt;");
    expect(v.text).toContain("https://app.example.com/verify-email?token=abc");
    expect(passwordResetEmail({ firstName: "Ada", url: "https://x/r", origin: "https://x" }).subject).toMatch(/Reset your password/);
    const inv = invitationEmail({ inviterName: "Valen Vergara", organizationName: "Acme & Co", role: "EXECUTIVE", url: "https://x/invite/t", origin: "https://x" });
    expect(inv.subject).toContain("Acme & Co");
    expect(inv.html).toContain("Acme &amp; Co");
    expect(inv.text).toContain("as Executive");
  });
});

describe("Resend mailer", () => {
  const saved = { ...process.env };
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
  });

  it("reports not_configured and sends nothing without credentials", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { sendEmail } = await import("@/server/email/mailer");
    expect(await sendEmail("a@b.co", { subject: "s", html: "<p>h</p>", text: "t" })).toEqual({ ok: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the message to Resend with the configured sender", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Thought Authorities <no-reply@example.com>";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email_123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendEmail } = await import("@/server/email/mailer");
    const r = await sendEmail("group@example.com", { subject: "Verify", html: "<p>h</p>", text: "t" });
    expect(r).toEqual({ ok: true, id: "email_123" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_test");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ from: "Thought Authorities <no-reply@example.com>", to: ["group@example.com"], subject: "Verify" });
  });

  it("reports a rejection (e.g. unverified sending domain) without throwing", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "x@unverified.example";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ name: "validation_error", message: "The domain is not verified" }), { status: 403 })));
    const { sendEmail } = await import("@/server/email/mailer");
    const r = await sendEmail("a@b.co", { subject: "s", html: "h", text: "t" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe("rejected");
  });
});

describe("email links", () => {
  const saved = { ...process.env };
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    process.env = { ...saved };
  });

  it("uses Netlify's site URL in production and never the request host", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.URL = "https://thoughtauthorities.netlify.app/";
    vi.stubEnv("NODE_ENV", "production");
    const { absoluteUrl } = await import("@/server/email/links");
    expect(await absoluteUrl("/verify-email?token=t")).toBe("https://thoughtauthorities.netlify.app/verify-email?token=t");
    vi.unstubAllEnvs();
  });

  it("prefers an explicitly configured app URL", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.thoughtauthorities.com";
    process.env.URL = "https://thoughtauthorities.netlify.app";
    const { absoluteUrl } = await import("@/server/email/links");
    expect(await absoluteUrl("invite/abc")).toBe("https://app.thoughtauthorities.com/invite/abc");
  });
});

describe("password reset link exposure", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("never returns a reset link to the browser in production, even without email delivery", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    vi.stubEnv("URL", "https://thoughtauthorities.netlify.app");
    const { demoIdentity } = await import("@/server/auth/identity");
    const { sendPasswordResetEmail } = await import("@/server/email/flows");
    const user = await demoIdentity.createUser({ email: `reset-${Date.now()}@example.com`, password: "correcthorse1", first_name: "Ada", last_name: "L" });
    const r = await sendPasswordResetEmail(user);
    expect(r.delivery).toEqual({ ok: false, reason: "not_configured" });
    expect(r.localLink).toBeUndefined();
  });

  it("shows the link only in local development", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    const { demoIdentity } = await import("@/server/auth/identity");
    const { sendPasswordResetEmail } = await import("@/server/email/flows");
    const user = await demoIdentity.createUser({ email: `dev-${Date.now()}@example.com`, password: "correcthorse1", first_name: "Ada", last_name: "L" });
    expect((await sendPasswordResetEmail(user)).localLink).toMatch(/^\/reset-password\?token=/);
  });
});
