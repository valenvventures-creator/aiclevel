"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** A submit button that asks before an irreversible action (e.g. deleting a record). */
export function ConfirmButton({ message, children, className }: { message: string; children: ReactNode; className?: string }) {
  return (
    <Button
      type="submit"
      size="sm"
      variant="ghost"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
