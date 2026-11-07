import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const invite = typeof sp.invite === "string" ? sp.invite : undefined;
  const email = typeof sp.email === "string" ? sp.email : undefined;
  return (
    <div className="animate-fade-up">
      <p className="eyebrow">Convene your C-Suite</p>
      <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">Create your account.</h1>
      <p className="mt-2 text-sm text-ivory-muted">{invite ? "You've been invited to join an organization's C-Suite." : "Seven A.I. executives are ready to work with you."}</p>
      <div className="mt-8">
        <SignupForm inviteToken={invite} email={email} />
      </div>
      <p className="mt-8 text-center text-sm text-ivory-muted">
        Already have an account?{" "}
        <Link href={invite ? `/login?next=/invite/${invite}` : "/login"} className="text-gold-300 hover:text-gold-200">
          Log in
        </Link>
      </p>
    </div>
  );
}
