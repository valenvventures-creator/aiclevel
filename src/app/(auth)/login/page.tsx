import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { demoLoginAction } from "@/server/auth/actions";
import { dataMode } from "@/lib/env";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const demo = dataMode() === "demo";
  const wantsDemo = sp.demo === "1";
  const demoCard = demo && (
    <div className={wantsDemo ? "mt-8 rounded-2xl border border-line-gold bg-gold-400/[0.06] p-5" : "mt-6 rounded-2xl border border-line-gold bg-gold-400/[0.04] p-4"}>
      <p className="text-sm font-medium text-gold-200">Explore the Thought Authorities Demo</p>
      <p className="mt-1 text-xs text-ivory-muted">
        A simulated organization with seeded data — clearly labelled and never presented as live A.I. output.
      </p>
      <form action={demoLoginAction} className="mt-3">
        <Button variant={wantsDemo ? "gold" : "outline"} size="sm" type="submit" className="w-full">
          Enter the demo C-Level
        </Button>
      </form>
    </div>
  );
  return (
    <div className="animate-fade-up">
      <p className="eyebrow">A.I. C-Level</p>
      <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">Welcome back.</h1>
      <p className="mt-2 text-sm text-ivory-muted">Log in to rejoin your C-Level.</p>
      {wantsDemo && demoCard}
      <div className="mt-8 space-y-4">
        {sp.reset === "1" && <Alert tone="ok">Your password was updated. Log in with your new password.</Alert>}
        {sp.demo === "unavailable" && <Alert tone="warn">The demo organization is being prepared or is temporarily unavailable. Please try again in a moment.</Alert>}
        <LoginForm next={next} />
      </div>
      {!wantsDemo && demoCard}
      <p className="mt-8 text-center text-sm text-ivory-muted">
        New to Thought Authorities?{" "}
        <Link href="/signup" className="text-gold-300 hover:text-gold-200">
          Create an account
        </Link>
      </p>
    </div>
  );
}
