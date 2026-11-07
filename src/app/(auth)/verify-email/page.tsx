import type { Metadata } from "next";
import { VerifyEmailForms } from "@/components/auth/forms";
import { getCurrentUser } from "@/server/auth/session";
import { emailDeliveryConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : undefined;
  const user = await getCurrentUser();
  const canEmail = emailDeliveryConfigured();
  return (
    <div className="animate-fade-up">
      <p className="eyebrow">Email verification</p>
      <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">Verify your email.</h1>
      <p className="mt-2 text-sm text-ivory-muted">
        {user && user.email_verified ? (
          <>Your email address <span className="text-ivory">{user.email}</span> is verified.</>
        ) : user ? (
          canEmail ? (
            <>We sent a verification link to <span className="text-ivory">{user.email}</span>. Open it to verify — inviting team members unlocks once you do. Can&apos;t find it? Check your spam folder or resend it below.</>
          ) : (
            <>Verifying <span className="text-ivory">{user.email}</span> needs email delivery, which isn&apos;t set up on this site yet. Everything else in your C-Suite works in the meantime.</>
          )
        ) : (
          "Confirm your email address to unlock inviting your team."
        )}
      </p>
      <div className="mt-8">
        <VerifyEmailForms token={token} signedIn={Boolean(user)} verified={Boolean(user?.email_verified)} />
      </div>
    </div>
  );
}
