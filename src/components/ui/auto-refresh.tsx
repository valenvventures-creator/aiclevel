"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Polls the server component while background work (Studio jobs, replies) is in progress. */
export function AutoRefresh({ active, intervalMs = 2500 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}
