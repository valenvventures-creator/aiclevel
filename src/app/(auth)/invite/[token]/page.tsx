import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Alert, Badge } from "@/components/ui/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { getCurrentUser, ORG_COOKIE } from "@/server/auth/session";
import { acceptInvitation, findInvitation } from "@/server/organizations/invitations";

export const metadata: Metadata = { title: "Accept invitation" };

async function accept(fd: FormData) {
  "use server";
  const token = String(fd.get("token") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/invite/${encodeURIComponent(token)}`);
  const res = await acceptInvitation(token, user);
  if (!res.ok) redirect(`/invite/${encodeURIComponent(token)}?error=${res.reason}`);
  (await cookies()).set(ORG_COOKIE, res.organizationId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/hq");
}

const ERRORS: Record<string, string> = {
  INVALID: "This invitation is not valid.",
  EXPIRED: "This invitation has expired. Ask the person who invited you to send a new one.",
  USED: "This invitation has already been accepted.",
  EMAIL_MISMATCH: "This invitation was sent to a different email address. Log in with the invited email to accept it.",
};

export default async function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const [inv, user] = await Promise.all([findInvitation(token), getCurrentUser()]);
  const expired = inv && isExpired(inv.expires_at);
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : !inv ? ERRORS.INVALID : expired ? ERRORS.EXPIRED : inv.accepted_at ? ERRORS.USED : null;

  return (
    <div className="animate-fade-up">
      <p className="eyebrow">Invitation</p>
      <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">{inv ? <>Join {inv.organization_name}.</> : "Invitation"}</h1>
      {inv && !error && (
        <p className="mt-3 text-sm text-ivory-muted">
          You&apos;ve been invited to join the A.I. C-Level as <Badge tone="gold">{inv.role}</Badge>
        </p>
      )}
      <div className="mt-8 space-y-4">
        {error && <Alert tone="risk">{error}</Alert>}
        {inv && !error && (
          user ? (
            <form action={accept} className="space-y-3">
              <input type="hidden" name="token" value={token} />
              <p className="text-sm text-ivory-muted">Signed in as {user.email}.</p>
              <Button type="submit" size="lg" className="w-full">Accept invitation</Button>
            </form>
          ) : (
            <div className="grid gap-3">
              <ButtonLink href={`/signup?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(inv.email)}`} size="lg">Create account &amp; join</ButtonLink>
              <ButtonLink href={`/login?next=/invite/${encodeURIComponent(token)}`} variant="outline" size="lg">I already have an account</ButtonLink>
            </div>
          )
        )}
        <p className="text-center text-sm">
          <Link href="/" className="text-gold-300 hover:text-gold-200">Return home</Link>
        </p>
      </div>
    </div>
  );
}

function isExpired(iso: string) {
  return new Date(iso).getTime() < Date.now();
}
