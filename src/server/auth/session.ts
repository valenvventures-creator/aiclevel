import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { randomBytes } from "node:crypto";
import { configuredSessionSecret, dataMode, env, ephemeralSessionSecret } from "@/lib/env";
import { records } from "@/server/db/records";
import { demoIdentity } from "./identity";
import { supabaseServer } from "@/server/db/supabase";
import type { UserProfile } from "@/types/domain";

export const SESSION_COOKIE = "ta_session";
export const ORG_COOKIE = "ta_org";
const SHORT_TTL_S = 60 * 60 * 12;
const REMEMBER_TTL_S = 60 * 60 * 24 * 30;

/* ------------------------- demo-mode session cookie ------------------------ */

let secretPromise: Promise<Uint8Array> | null = null;

/**
 * HS256 signing key. `SESSION_SECRET` wins; otherwise a random secret is
 * generated once and stored in the database so all instances agree on it
 * (an ephemeral key would log users out whenever a new instance handles a request).
 */
function sessionSecret(): Promise<Uint8Array> {
  return (secretPromise ??= (async () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    const configured = configuredSessionSecret();
    if (configured) return enc(configured);
    const store = records();
    if (store.kind === "memory") return enc(ephemeralSessionSecret());
    const row = { id: "session_secret", value: randomBytes(48).toString("hex") };
    await store.insertIfAbsent("app_config", row, { organizationId: "global" });
    const saved = await store.get<{ id: string; value: string }>("app_config", "session_secret");
    if (!saved?.value) throw new Error("Session secret could not be loaded");
    return enc(saved.value);
  })().catch((err) => {
    secretPromise = null;
    throw err;
  }));
}

export async function createDemoSession(userId: string, remember: boolean) {
  const ttl = remember ? REMEMBER_TTL_S : SHORT_TTL_S;
  const jwt = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .setIssuer("thought-authorities")
    .sign(await sessionSecret());
  (await cookies()).set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: ttl } : {}),
  });
}

async function readDemoSession(): Promise<string | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, await sessionSecret(), { issuer: "thought-authorities" });
    if (!payload.sub || !payload.iat) return null;
    if (payload.iat < (await demoIdentity.sessionsValidAfter(payload.sub))) return null; // revoked
    return payload.sub;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const store = await cookies();
  if (dataMode() === "supabase") {
    const sb = await supabaseServer();
    await sb.auth.signOut();
  }
  store.delete(SESSION_COOKIE);
  store.delete(ORG_COOKIE);
}

/* ------------------------------ current user ------------------------------ */

/** Server-verified current user, or null. Memoized per request. */
export const getCurrentUser = cache(async (): Promise<UserProfile | null> => {
  if (dataMode() === "supabase") {
    const sb = await supabaseServer();
    const { data } = await sb.auth.getUser(); // verifies JWT with Supabase Auth
    if (!data.user) return null;
    const { data: profile } = await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
    if (!profile) return null;
    return { ...(profile as UserProfile), email: data.user.email ?? "", email_verified: Boolean(data.user.email_confirmed_at) };
  }
  const id = await readDemoSession();
  return id ? demoIdentity.getUser(id) : null;
});

export async function requireUser(): Promise<UserProfile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
