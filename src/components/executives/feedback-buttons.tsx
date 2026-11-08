"use client";

import { useState, useTransition } from "react";
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { submitFeedbackAction } from "@/server/executives/learning-actions";
import { cn } from "@/lib/utils";

type Rating = "UP" | "DOWN";

/**
 * 👍 / 👎 on one executive answer. A thumbs-down asks what the answer should
 * have said or done; that correction is drafted into a lesson for the
 * organization's admins to approve. A thumbs-up can say what worked.
 */
export function FeedbackButtons({ executiveId, executiveTitle, sourceType, sourceId, initial = null }: { executiveId: string; executiveTitle: string; sourceType: "CONVERSATION" | "SESSION"; sourceId: string; initial?: Rating | null }) {
  const [rating, setRating] = useState<Rating | null>(initial);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function choose(r: Rating) {
    setRating(r);
    setOpen(true);
    setResult(null);
    setError(null);
  }

  function send(withComment: boolean) {
    if (!rating) return;
    start(async () => {
      const r = await submitFeedbackAction({ executiveId, sourceType, sourceId, rating, comment: withComment ? comment : "" });
      if (!r.ok) {
        setError(r.error ?? "Your feedback could not be saved.");
        return;
      }
      setOpen(false);
      setComment("");
      setResult(r.lessonTitle ? `Thank you. A lesson was drafted for an admin to approve: “${r.lessonTitle}”.` : "Thank you for the feedback.");
    });
  }

  const label = rating === "DOWN" ? `What should the ${executiveTitle} have said or done differently?` : "What made this answer useful? (optional)";

  return (
    <div className="inline-flex flex-col">
      <div className="inline-flex items-center gap-1">
        <button type="button" onClick={() => choose("UP")} aria-label="Good answer" aria-pressed={rating === "UP"} title="Good answer" className={cn("grid size-7 place-items-center rounded-full transition hover:bg-white/5", rating === "UP" ? "text-ok" : "text-ivory-faint hover:text-ivory")}>
          <ThumbsUp className="size-3.5" />
        </button>
        <button type="button" onClick={() => choose("DOWN")} aria-label="Needs improvement" aria-pressed={rating === "DOWN"} title="Needs improvement" className={cn("grid size-7 place-items-center rounded-full transition hover:bg-white/5", rating === "DOWN" ? "text-risk" : "text-ivory-faint hover:text-ivory")}>
          <ThumbsDown className="size-3.5" />
        </button>
        {result && !open && <span role="status" className="ml-1 text-xs text-ivory-muted">{result}</span>}
      </div>
      {open && (
        <div className="mt-2 w-full max-w-lg space-y-2 rounded-xl border border-line-strong bg-ink-900 p-3">
          <label htmlFor={`fb-${sourceId}`} className="block text-xs text-ivory-muted">{label}</label>
          <textarea
            id={`fb-${sourceId}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={rating === "DOWN" ? "e.g. Always show the runway in months under each scenario, and state the burn rate used." : "e.g. The three scenarios with clear triggers were exactly right."}
            className="w-full rounded-lg border border-line-strong bg-ink-950 px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-ivory-faint">Your note becomes a suggested lesson. It applies to future answers once an admin approves it.</p>
          {error && <p role="alert" className="text-xs text-risk">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending || !comment.trim()} onClick={() => send(true)} className="inline-flex h-8 items-center gap-2 rounded-full bg-gold-400 px-3 text-xs font-medium text-ink-950 disabled:opacity-50">
              {pending && <Loader2 className="size-3 animate-spin" />} Send feedback
            </button>
            <button type="button" disabled={pending} onClick={() => send(false)} className="inline-flex h-8 items-center rounded-full border border-line-strong px-3 text-xs text-ivory-muted hover:text-ivory">
              Just rate it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
