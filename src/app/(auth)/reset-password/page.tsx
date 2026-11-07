import Link from "next/link";
import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/primitives";
import { dataMode } from "@/lib/env";
import { demoIdentity } from "@/server/auth/identity";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const valid = dataMode() === "supabase" || (token && demoIdentity.peekToken(token, "RESET_PASSWORD"));
  return (
    <div className="animate-fade-up">
      <p className="eyebrow">Account recovery</p>
      <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">Choose a new password.</h1>
      <div className="mt-8">
        {valid ? (
          <ResetForm token={token} />
        ) : (
          <Alert tone="risk">
            This reset link is invalid or has expired.{" "}
            <Link href="/forgot-password" className="underline">
              Request a new link
            </Link>
            .
          </Alert>
        )}
      </div>
    </div>
  );
}
