"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import type { SettingsState } from "@/server/settings/actions";

/** Generic settings form: server action + success/error feedback. */
export function ActionForm({ action, submit = "Save", children, className }: { action: (s: SettingsState, fd: FormData) => Promise<SettingsState>; submit?: string; children: ReactNode; className?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className ?? "space-y-4"}>
      {state.error && <Alert tone="risk">{state.error}</Alert>}
      {state.message && <Alert tone="ok">{state.message}{state.devLink && <> — Demo mode, email simulated: <Link href={state.devLink} className="underline">invitation link</Link></>}</Alert>}
      {children}
      <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} {submit}</Button>
    </form>
  );
}
