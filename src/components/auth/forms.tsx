"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, FieldError, Input, Label } from "@/components/ui/primitives";
import {
  forgotPasswordAction,
  loginAction,
  resendVerificationAction,
  resetPasswordAction,
  signupAction,
  verifyEmailAction,
  type FormState,
} from "@/server/auth/actions";

function Field({ name, label, type = "text", state, autoComplete, defaultValue, required = true }: { name: string; label: string; type?: string; state: FormState; autoComplete?: string; defaultValue?: string; required?: boolean }) {
  const err = state.fieldErrors?.[name];
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} autoComplete={autoComplete} required={required} defaultValue={state.values?.[name] ?? defaultValue} aria-invalid={Boolean(err)} aria-describedby={err ? `${name}-err` : undefined} />
      <FieldError id={`${name}-err`}>{err}</FieldError>
    </div>
  );
}

function PasswordField({ name, label, state, autoComplete }: { name: string; label: string; state: FormState; autoComplete: string }) {
  const [show, setShow] = useState(false);
  const err = state.fieldErrors?.[name];
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        <Input id={name} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required aria-invalid={Boolean(err)} aria-describedby={err ? `${name}-err` : undefined} className="pr-11" />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-ivory-faint hover:text-ivory" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <FieldError id={`${name}-err`}>{err}</FieldError>
    </div>
  );
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

function DevLink({ state }: { state: FormState }) {
  if (!state.devLink) return null;
  return (
    <Alert tone="warn">
      <strong>Local development — no email was sent.</strong> Your secure link:{" "}
      <Link href={state.devLink} className="underline underline-offset-2">
        open link
      </Link>
    </Alert>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="risk">{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field name="email" label="Email" type="email" autoComplete="email" state={state} />
      <PasswordField name="password" label="Password" state={state} autoComplete="current-password" />
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-ivory-muted">
          <input type="checkbox" name="remember" className="size-4 rounded border-line-strong bg-ink-900 accent-gold-400" /> Keep me signed in
        </label>
        <Link href="/forgot-password" className="text-gold-300 hover:text-gold-200">
          Forgot password?
        </Link>
      </div>
      <Submit pending={pending}>Log in</Submit>
    </form>
  );
}

export function SignupForm({ inviteToken, email }: { inviteToken?: string; email?: string }) {
  const [state, action, pending] = useActionState(signupAction, {});
  if (state.ok) return <Alert tone="ok">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="risk">{state.error}</Alert>}
      {inviteToken && <input type="hidden" name="invite_token" value={inviteToken} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="first_name" label="First name" autoComplete="given-name" state={state} />
        <Field name="last_name" label="Last name" autoComplete="family-name" state={state} />
      </div>
      <Field name="email" label="Work email" type="email" autoComplete="email" state={state} defaultValue={email} />
      <PasswordField name="password" label="Password" state={state} autoComplete="new-password" />
      <PasswordField name="confirm_password" label="Confirm password" state={state} autoComplete="new-password" />
      <p className="text-xs text-ivory-faint">At least 10 characters, including a letter and a number.</p>
      <fieldset className="space-y-2 text-sm text-ivory-muted">
        <legend className="sr-only">Agreements</legend>
        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="accept_terms" required className="mt-0.5 size-4 accent-gold-400" />
          <span>
            I agree to the <Link href="/legal/terms" className="text-gold-300 underline-offset-2 hover:underline">Terms of Service</Link>.
          </span>
        </label>
        <FieldError>{state.fieldErrors?.accept_terms}</FieldError>
        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="accept_privacy" required className="mt-0.5 size-4 accent-gold-400" />
          <span>
            I acknowledge the <Link href="/legal/privacy" className="text-gold-300 underline-offset-2 hover:underline">Privacy Policy</Link>.
          </span>
        </label>
        <FieldError>{state.fieldErrors?.accept_privacy}</FieldError>
      </fieldset>
      <Submit pending={pending}>Create account</Submit>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.ok && <Alert tone="ok">{state.message}</Alert>}
      <DevLink state={state} />
      <Field name="email" label="Email" type="email" autoComplete="email" state={state} />
      <Submit pending={pending}>Send reset link</Submit>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="risk">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <PasswordField name="password" label="New password" state={state} autoComplete="new-password" />
      <PasswordField name="confirm_password" label="Confirm new password" state={state} autoComplete="new-password" />
      <p className="text-xs text-ivory-faint">Resetting your password signs out your other sessions.</p>
      <Submit pending={pending}>Set new password</Submit>
    </form>
  );
}

export function VerifyEmailForms({ token, signedIn, verified }: { token?: string; signedIn: boolean; verified: boolean }) {
  const [vState, verify, vPending] = useActionState(verifyEmailAction, {});
  const [rState, resend, rPending] = useActionState(resendVerificationAction, {});
  return (
    <div className="space-y-5">
      {verified && <Alert tone="ok">Your email address is verified.</Alert>}
      {vState.ok && <Alert tone="ok">{vState.message}</Alert>}
      {vState.error && <Alert tone="risk">{vState.error}</Alert>}
      {token && !vState.ok && (
        <form action={verify}>
          <input type="hidden" name="token" value={token} />
          <Submit pending={vPending}>Confirm my email</Submit>
        </form>
      )}
      {signedIn && !verified && !vState.ok && (
        <form action={resend} className="space-y-3">
          {rState.message && <Alert tone="ok">{rState.message}</Alert>}
          {rState.error && <Alert tone="risk">{rState.error}</Alert>}
          <DevLink state={rState} />
          <Button type="submit" variant="outline" className="w-full" disabled={rPending}>
            {rPending && <Loader2 className="size-4 animate-spin" />} Resend verification email
          </Button>
        </form>
      )}
      <Link href={signedIn ? "/hq" : "/login"} className="block text-center text-sm text-gold-300 hover:text-gold-200">
        Continue {signedIn ? "to C-Level HQ" : "to log in"}
      </Link>
    </div>
  );
}
