import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Proxy (formerly middleware): optimistic route gating + Supabase session
 * refresh. This is NOT the authorization boundary — every page, route handler
 * and server action re-verifies the session and organization membership.
 */
const PROTECTED = ["/hq", "/executives", "/comms", "/sessions", "/memory", "/studio", "/reports", "/files", "/projects", "/settings", "/decisions", "/onboarding"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request });
  let signedIn = Boolean(request.cookies.get("ta_session")?.value);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const c of list) request.cookies.set(c.name, c.value);
          response = NextResponse.next({ request });
          for (const c of list) response.cookies.set(c.name, c.value, c.options);
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  }

  if (!signedIn && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|icon.png|favicon.ico|api/health).*)"],
};
