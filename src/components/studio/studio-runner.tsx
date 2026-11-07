"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

type StepState = "done" | "continue" | "busy" | "failed" | "idle";

/**
 * Drives bounded production steps while the job page is open. Each step is a
 * short request; the draft is saved server-side between steps, so closing the
 * page only pauses the work — it resumes from the draft next time.
 */
export function StudioRunner({ jobId, leadTitle, draftChars }: { jobId: string; leadTitle: string; draftChars: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "waiting" | "error">("working");
  const [message, setMessage] = useState<string | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    let networkErrors = 0;
    const run = async () => {
      while (!stopped.current) {
        let state: StepState = "failed";
        try {
          const res = await fetch(`/api/studio/${jobId}/advance`, { method: "POST" });
          const body = (await res.json().catch(() => ({}))) as { state?: StepState; error?: string };
          state = body.state ?? (res.ok ? "idle" : "busy");
          networkErrors = 0;
          if (state === "failed") setMessage(body.error ?? null);
        } catch {
          // A step that hit the host time limit or a dropped connection: the draft is saved, so just try again.
          networkErrors += 1;
          state = networkErrors > 5 ? "failed" : "busy";
          if (networkErrors > 5) setStatus("error");
        }
        router.refresh();
        if (state === "done" || state === "failed" || state === "idle") return;
        if (state === "busy") {
          setStatus("waiting");
          await new Promise((r) => setTimeout(r, 4000));
        } else setStatus("working");
      }
    };
    run();
    return () => {
      stopped.current = true;
    };
  }, [jobId, router]);

  return (
    <div className="plate flex items-center gap-4 p-6" role="status" aria-live="polite">
      <Loader2 className="size-5 shrink-0 animate-spin text-gold-300" aria-hidden />
      <div>
        <p className="text-sm font-medium">
          {leadTitle} is {draftChars > 0 ? "writing" : "preparing"} this work{draftChars > 0 ? ` — ${Math.round(draftChars / 5).toLocaleString()} words so far` : ""}.
        </p>
        <p className="text-xs text-ivory-muted">
          {status === "error"
            ? "The connection keeps dropping. Your draft is saved — reload the page to continue."
            : message ?? "Keep this page open while the work is produced. If you leave, it pauses and resumes from the saved draft when you return."}
        </p>
      </div>
    </div>
  );
}
