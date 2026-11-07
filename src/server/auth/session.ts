import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { dataMode, env, sessionSecret } from "@/lib/env";
import { demoIdentity } from "./identity";
import { supabaseServer } from "@/server/db/supabase";
import type { UserProfile } from "@/types/domain";

export const SESSION_COOKIE = "ta_session";
export const ORG_COOKIE = "ta_org";
const SHORT_TTL_S = 60 * 60 * 12;
const REMEMBER_TTL_S = 60 * 60 * 24 * 30;

/* ------------------------- demo-mode session cookie ------------------------ */

export async function createDemoSession(userId: string, remember: boolean) {
  const ttl = remember ? REMEMBER_TTL_S : SHORT_TTL_S;
  const jwt = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .setIssuer("thought-authorities")
    .sign(sessionSecret());
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
    const { payload } = await jwtVerify(raw, sessionSecret(), { issuer: "thought-authorities" });
    if (!payload.sub || !payload.iat) return null;
    if (payload.iat < demoIdentity.sessionsValidAfter(payload.sub)) return null; // revoked
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
