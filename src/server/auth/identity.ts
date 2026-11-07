import "server-only";
import { newId, nowIso } from "@/server/db/store";
import { records } from "@/server/db/records";
import { hashPassword, verifyPassword, generateToken, hashToken } from "./password";
import type { Organization, UserProfile } from "@/types/domain";

/**
 * Global (non-tenant) identity records for DEMO MODE (no Supabase).
 * Stored in the shared record store (Netlify Database when available), so
 * accounts, password resets and session revocation work across every
 * serverless instance. In Supabase mode these live in `auth.users`,
 * `public.profiles` and `public.organizations` (see supabase/migrations).
 */
type UserRow = {
  id: string;
  profile: UserProfile;
  password_hash: string;
  /** Tokens issued before this instant (epoch seconds) are rejected (session revocation). */
  sessions_valid_after: number;
  failed_logins: number;
  locked_until: number;
};
type AuthTokenRow = {
  id: string; // token hash
  user_id: string;
  kind: "VERIFY_EMAIL" | "RESET_PASSWORD";
  expires_at: number;
  used: boolean;
};

const USERS = "users";
const ORGS = "organizations";
const TOKENS = "auth_tokens";
const GLOBAL = "global";

const userMeta = (u: UserRow) => ({ organizationId: GLOBAL, lookupKey: u.profile.email });
const orgMeta = (o: Organization) => ({ organizationId: GLOBAL, lookupKey: o.slug });

async function userRow(id: string): Promise<UserRow | null> {
  return records().get<UserRow & Record<string, unknown>>(USERS, id);
}
async function saveUser(u: UserRow) {
  await records().put(USERS, u as unknown as UserRow & Record<string, unknown>, userMeta(u));
}

export const demoIdentity = {
  async createUser(input: { email: string; password: string; first_name: string; last_name: string; verified?: boolean; id?: string }): Promise<UserProfile> {
    if (await this.findByEmail(input.email)) throw new Error("EMAIL_TAKEN");
    const profile: UserProfile = {
      id: input.id ?? newId(),
      email: input.email.trim().toLowerCase(),
      first_name: input.first_name,
      last_name: input.last_name,
      display_name: null,
      avatar_url: null,
      timezone: "America/New_York",
      email_verified: Boolean(input.verified),
      onboarding_completed: false,
      created_at: nowIso(),
    };
    const row: UserRow = { id: profile.id, profile, password_hash: await hashPassword(input.password), sessions_valid_after: 0, failed_logins: 0, locked_until: 0 };
    const inserted = await records().insertIfAbsent(USERS, row as unknown as UserRow & Record<string, unknown>, userMeta(row));
    if (!inserted) throw new Error("EMAIL_TAKEN");
    return structuredClone(profile);
  },
  async findByEmail(email: string): Promise<UserRow | undefined> {
    const [u] = await records().find<UserRow & Record<string, unknown>>(USERS, { lookupKey: email.trim().toLowerCase() });
    return u;
  },
  async getUser(id: string): Promise<UserProfile | null> {
    return (await userRow(id))?.profile ?? null;
  },
  async getUsers(ids: string[]): Promise<Map<string, UserProfile>> {
    const unique = [...new Set(ids)];
    const rows = await Promise.all(unique.map((id) => userRow(id)));
    return new Map(rows.filter((r): r is UserRow => Boolean(r)).map((r) => [r.id, r.profile]));
  },
  async sessionsValidAfter(id: string): Promise<number> {
    return (await userRow(id))?.sessions_valid_after ?? Number.POSITIVE_INFINITY;
  },
  async checkPassword(email: string, password: string): Promise<{ ok: true; user: UserProfile } | { ok: false; reason: "INVALID" | "LOCKED" }> {
    const u = await this.findByEmail(email);
    if (!u) {
      await hashPassword(password); // equalize timing for unknown accounts
      return { ok: false, reason: "INVALID" };
    }
    if (u.locked_until > Date.now()) return { ok: false, reason: "LOCKED" };
    if (!(await verifyPassword(password, u.password_hash))) {
      u.failed_logins += 1;
      if (u.failed_logins >= 8) {
        u.locked_until = Date.now() + 15 * 60_000;
        u.failed_logins = 0;
      }
      await saveUser(u);
      return { ok: false, reason: "INVALID" };
    }
    if (u.failed_logins) {
      u.failed_logins = 0;
      await saveUser(u);
    }
    return { ok: true, user: structuredClone(u.profile) };
  },
  async setPassword(id: string, password: string, revokeSessions = true) {
    const u = await userRow(id);
    if (!u) return;
    u.password_hash = await hashPassword(password);
    u.failed_logins = 0;
    u.locked_until = 0;
    if (revokeSessions) u.sessions_valid_after = Math.floor(Date.now() / 1000);
    await saveUser(u);
  },
  async revokeSessions(id: string) {
    const u = await userRow(id);
    if (!u) return;
    u.sessions_valid_after = Math.floor(Date.now() / 1000);
    await saveUser(u);
  },
  async updateProfile(id: string, patch: Partial<UserProfile>) {
    const u = await userRow(id);
    if (!u) return null;
    u.profile = { ...u.profile, ...patch, id: u.profile.id, email: patch.email?.trim().toLowerCase() ?? u.profile.email };
    await saveUser(u);
    return structuredClone(u.profile);
  },
  async issueToken(user_id: string, kind: AuthTokenRow["kind"], ttlMs: number): Promise<string> {
    const { token, hash } = generateToken();
    const row: AuthTokenRow = { id: hash, user_id, kind, expires_at: Date.now() + ttlMs, used: false };
    await records().put(TOKENS, row as unknown as AuthTokenRow & Record<string, unknown>, { organizationId: GLOBAL });
    return token;
  },
  async consumeToken(token: string, kind: AuthTokenRow["kind"]): Promise<string | null> {
    const hash = hashToken(token);
    const row = await records().get<AuthTokenRow & Record<string, unknown>>(TOKENS, hash);
    if (!row || row.kind !== kind || row.used || row.expires_at < Date.now()) return null;
    // Single use: delete the token; only the request that actually removes it succeeds.
    if (!(await records().remove(TOKENS, hash))) return null;
    return row.user_id;
  },
  async peekToken(token: string, kind: AuthTokenRow["kind"]): Promise<boolean> {
    const row = await records().get<AuthTokenRow & Record<string, unknown>>(TOKENS, hashToken(token));
    return Boolean(row && row.kind === kind && !row.used && row.expires_at >= Date.now());
  },
  /* organizations (global table) */
  async putOrganization(org: Organization) {
    await records().put(ORGS, org as unknown as Organization & Record<string, unknown>, orgMeta(org));
  },
  /** Creates the organization only if its id is unused. Returns true when inserted. */
  async insertOrganizationIfAbsent(org: Organization): Promise<boolean> {
    return records().insertIfAbsent(ORGS, org as unknown as Organization & Record<string, unknown>, orgMeta(org));
  },
  async getOrganization(id: string): Promise<Organization | null> {
    return records().get<Organization & Record<string, unknown>>(ORGS, id);
  },
  async updateOrganization(id: string, patch: Partial<Organization>) {
    const o = await this.getOrganization(id);
    if (!o) return null;
    const next = { ...o, ...patch, id: o.id };
    await this.putOrganization(next);
    return structuredClone(next);
  },
  async slugTaken(slug: string) {
    return (await records().find(ORGS, { lookupKey: slug })).length > 0;
  },
  async deleteUser(id: string) {
    await records().remove(USERS, id);
  },
};
