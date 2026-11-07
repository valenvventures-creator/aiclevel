"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function CSuiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-lg py-20 text-center" role="alert">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-3 font-heading text-3xl font-semibold">{error.message.startsWith("Not authorized") ? "You don't have access to that." : "We couldn't load this page."}</h1>
      <p className="mt-2 text-sm text-ivory-muted">{error.digest ? `Reference: ${error.digest}` : "Please try again."}</p>
      <Button onClick={reset} className="mt-6">Try again</Button>
    </div>
  );
}
