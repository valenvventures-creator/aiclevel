import "server-only";
import { newId, nowIso } from "@/server/db/store";
import { hashPassword, verifyPassword, generateToken, hashToken } from "./password";
import type { Organization, UserProfile } from "@/types/domain";

/**
 * Global (non-tenant) identity records for DEMO MODE.
 * In Supabase mode these live in `auth.users`, `public.profiles` and
 * `public.organizations` (see supabase/migrations) and are reached through
 * `supabase-auth.ts` / `organizations/service.ts`.
 */
interface UserRow {
  profile: UserProfile;
  password_hash: string;
  /** Tokens issued before this instant are rejected (session revocation). */
  sessions_valid_after: number;
  failed_logins: number;
  locked_until: number;
}
interface AuthTokenRow {
  user_id: string;
  kind: "VERIFY_EMAIL" | "RESET_PASSWORD";
  expires_at: number;
  used: boolean;
}

const g = globalThis as unknown as {
  __taUsers?: Map<string, UserRow>;
  __taOrgs?: Map<string, Organization>;
  __taTokens?: Map<string, AuthTokenRow>;
};
const users = (g.__taUsers ??= new Map());
const orgs = (g.__taOrgs ??= new Map());
const tokens = (g.__taTokens ??= new Map());

export const demoIdentity = {
  async createUser(input: { email: string; password: string; first_name: string; last_name: string; verified?: boolean; id?: string }): Promise<UserProfile> {
    if (this.findByEmail(input.email)) throw new Error("EMAIL_TAKEN");
    const profile: UserProfile = {
      id: input.id ?? newId(),
      email: input.email.toLowerCase(),
      first_name: input.first_name,
      last_name: input.last_name,
      display_name: null,
      avatar_url: null,
      timezone: "America/New_York",
      email_verified: Boolean(input.verified),
      onboarding_completed: false,
      created_at: nowIso(),
    };
    users.set(profile.id, { profile, password_hash: await hashPassword(input.password), sessions_valid_after: 0, failed_logins: 0, locked_until: 0 });
    return structuredClone(profile);
  },
  findByEmail(email: string): UserRow | undefined {
    const e = email.toLowerCase();
    for (const u of users.values()) if (u.profile.email === e) return u;
    return undefined;
  },
  getUser(id: string): UserProfile | null {
    const u = users.get(id);
    return u ? structuredClone(u.profile) : null;
  },
  sessionsValidAfter(id: string): number {
    return users.get(id)?.sessions_valid_after ?? Number.POSITIVE_INFINITY;
  },
  async checkPassword(email: string, password: string): Promise<{ ok: true; user: UserProfile } | { ok: false; reason: "INVALID" | "LOCKED" }> {
    const u = this.findByEmail(email);
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
      return { ok: false, reason: "INVALID" };
    }
    u.failed_logins = 0;
    return { ok: true, user: structuredClone(u.profile) };
  },
  async setPassword(id: string, password: string, revokeSessions = true) {
    const u = users.get(id);
    if (!u) return;
    u.password_hash = await hashPassword(password);
    if (revokeSessions) u.sessions_valid_after = Math.floor(Date.now() / 1000);
  },
  revokeSessions(id: string) {
    const u = users.get(id);
    if (u) u.sessions_valid_after = Math.floor(Date.now() / 1000);
  },
  updateProfile(id: string, patch: Partial<UserProfile>) {
    const u = users.get(id);
    if (!u) return null;
    u.profile = { ...u.profile, ...patch, id: u.profile.id, email: patch.email?.toLowerCase() ?? u.profile.email };
    return structuredClone(u.profile);
  },
  issueToken(user_id: string, kind: AuthTokenRow["kind"], ttlMs: number): string {
    const { token, hash } = generateToken();
    tokens.set(hash, { user_id, kind, expires_at: Date.now() + ttlMs, used: false });
    return token;
  },
  consumeToken(token: string, kind: AuthTokenRow["kind"]): string | null {
    const row = tokens.get(hashToken(token));
    if (!row || row.kind !== kind || row.used || row.expires_at < Date.now()) return null;
    row.used = true;
    return row.user_id;
  },
  peekToken(token: string, kind: AuthTokenRow["kind"]): boolean {
    const row = tokens.get(hashToken(token));
    return Boolean(row && row.kind === kind && !row.used && row.expires_at >= Date.now());
  },
  /* organizations (global table) */
  putOrganization(org: Organization) {
    orgs.set(org.id, structuredClone(org));
  },
  getOrganization(id: string): Organization | null {
    const o = orgs.get(id);
    return o ? structuredClone(o) : null;
  },
  updateOrganization(id: string, patch: Partial<Organization>) {
    const o = orgs.get(id);
    if (!o) return null;
    const next = { ...o, ...patch, id: o.id };
    orgs.set(id, next);
    return structuredClone(next);
  },
  slugTaken(slug: string) {
    for (const o of orgs.values()) if (o.slug === slug) return true;
    return false;
  },
  deleteUser(id: string) {
    users.delete(id);
  },
};
