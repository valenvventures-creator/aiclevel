import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Request-scoped Supabase client bound to the signed-in user's session.
 * All tenant queries use this client so Row Level Security applies.
 */
export async function supabaseServer(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const c of list) store.set(c.name, c.value, c.options);
        } catch {
          /* called from a Server Component — session refresh happens in proxy.ts */
        }
      },
    },
  });
}

/**
 * Service-role client. BYPASSES RLS — use only for narrowly-scoped,
 * server-verified operations (invitation token lookup, audit writes,
 * onboarding bootstrap). Never expose to the browser.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!env.supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, { auth: { persistSession: false } });
}
