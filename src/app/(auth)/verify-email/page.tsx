import type { Metadata } from "next";
import { VerifyEmailForms } from "@/components/auth/forms";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : undefined;
  const user = await getCurrentUser();
  return (
    <div className="animate-fade-up">
      <p className="eyebrow">Email verification</p>
      <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">Verify your email.</h1>
      <p className="mt-2 text-sm text-ivory-muted">
        {user ? <>We sent a verification link to <span className="text-ivory">{user.email}</span>. Some features — inviting team members and connecting integrations — unlock once you verify.</> : "Confirm your email address to unlock your full C-Suite."}
      </p>
      <div className="mt-8">
        <VerifyEmailForms token={token} signedIn={Boolean(user)} verified={Boolean(user?.email_verified)} />
      </div>
    </div>
  );
}
