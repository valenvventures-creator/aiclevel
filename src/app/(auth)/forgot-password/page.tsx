import Link from "next/link";
import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="animate-fade-up">
      <p className="eyebrow">Account recovery</p>
      <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">Forgot your password?</h1>
      <p className="mt-2 text-sm text-ivory-muted">Enter your email and we&apos;ll send a secure link that expires in 30 minutes.</p>
      <div className="mt-8">
        <ForgotForm />
      </div>
      <p className="mt-8 text-center text-sm">
        <Link href="/login" className="text-gold-300 hover:text-gold-200">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
