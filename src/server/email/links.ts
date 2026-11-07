import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/**
 * Absolute origin for links sent by email.
 *
 * Production uses configured values only — NEXT_PUBLIC_APP_URL, then Netlify's
 * runtime `URL` (the site's primary address) — never the request's Host header,
 * which an attacker could forge to point a reset link at their own domain.
 * The request host is used only in local development.
 */
export async function appOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured.replace(/\/+$/, "");
  if (process.env.URL) return process.env.URL.replace(/\/+$/, "");
  if (!env.isProduction) {
    try {
      const h = await headers();
      const host = h.get("host");
      if (host) return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
    } catch {
      /* not in a request */
    }
  }
  return (configured ?? "http://localhost:3000").replace(/\/+$/, "");
}

export async function absoluteUrl(path: string): Promise<string> {
  return `${await appOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
