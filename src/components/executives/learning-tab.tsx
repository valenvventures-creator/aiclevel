import { GraduationCap, ThumbsDown, ThumbsUp } from "lucide-react";
import { ActionForm } from "@/components/settings/action-form";
import { Badge, Card, Input, Label, SectionTitle, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";
import { db } from "@/server/db/store";
import { createLessonAction, reviewLessonAction } from "@/server/executives/learning-actions";
import type { AIExecutive, ExecutiveLesson } from "@/types/domain";

/** Executive Office → Learning: feedback on this executive's answers and the lessons drawn from it. */
export async function LearningTab({ orgId, exec, canConfigure }: { orgId: string; exec: Pick<AIExecutive, "id" | "title" | "short_title">; canConfigure: boolean }) {
  const [lessons, feedback] = await Promise.all([
    db().lessons.list(orgId, { where: { executive_id: exec.id } }),
    db().feedback.list(orgId, { where: { executive_id: exec.id } }),
  ]);
  const byNewest = <T extends { updated_at?: string; created_at: string }>(a: T, b: T) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at);
  const proposed = lessons.filter((l) => l.status === "PROPOSED").sort(byNewest);
  const approved = lessons.filter((l) => l.status === "APPROVED").sort(byNewest);
  const recent = [...feedback].sort(byNewest).slice(0, 12);
  const { up, down } = lastThirtyDays(feedback);
  const lessonById = new Map(lessons.map((l) => [l.id, l]));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <Card>
          <div className="flex items-start gap-3">
            <GraduationCap className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden />
            <div className="text-sm">
              <p>The {exec.title} learns from your feedback. Rate any answer with 👍 or 👎 and say what it should have said or done. Each correction becomes a suggested lesson.</p>
              <p className="mt-1 text-xs text-ivory-muted">Lessons apply to every future answer once an admin approves them. You can edit, retire or write lessons yourself at any time.</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([["Active lessons", approved.length], ["Waiting for approval", proposed.length], ["👍 last 30 days", up], ["👎 last 30 days", down]] as const).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line p-3"><dt className="font-mono text-[10px] tracking-[0.14em] text-ivory-faint">{k.toUpperCase()}</dt><dd className="mt-1 font-heading text-2xl">{v}</dd></div>
            ))}
          </dl>
        </Card>

        <section aria-labelledby="waiting">
          <h2 id="waiting" className="mb-3 font-heading text-xl font-semibold">Waiting for approval</h2>
          {proposed.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-ivory-muted">No lessons are waiting. Rate the {exec.short_title}&apos;s answers to suggest new ones.</p>
          ) : (
            <ul className="space-y-3">
              {proposed.map((l) => (
                <li key={l.id} className="rounded-2xl border border-line-gold/60 bg-gold-400/[0.03] p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone="gold">Suggested</Badge><span className="font-mono text-[10px] text-ivory-faint">{l.origin === "FEEDBACK" ? "DRAFTED FROM FEEDBACK" : "WRITTEN"} · {formatRelative(l.created_at).toUpperCase()}</span></div>
                  {canConfigure ? (
                    <form action={reviewLessonAction} className="space-y-3">
                      <input type="hidden" name="id" value={l.id} />
                      <div><Label htmlFor={`lt-${l.id}`}>Title</Label><Input id={`lt-${l.id}`} name="title" defaultValue={l.title} maxLength={160} /></div>
                      <div><Label htmlFor={`lg-${l.id}`}>Lesson</Label><Textarea id={`lg-${l.id}`} name="guidance" defaultValue={l.guidance} rows={3} maxLength={1200} /></div>
                      <OriginalFeedback lesson={l} feedback={feedback} />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="gold" name="decision" value="APPROVED">Approve lesson</Button>
                        <Button size="sm" variant="outline" name="decision" value="ARCHIVED">Dismiss</Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p className="text-sm font-medium">{l.title}</p>
                      <p className="mt-1 text-sm text-ivory-muted">{l.guidance}</p>
                      <p className="mt-2 text-xs text-ivory-faint">An admin will review this lesson.</p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="active">
          <h2 id="active" className="mb-3 font-heading text-xl font-semibold">Active lessons</h2>
          {approved.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-ivory-muted">No active lessons yet.</p>
          ) : (
            <ul className="space-y-3">
              {approved.map((l) => (
                <li key={l.id} className="rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{l.title}</span>
                    <Badge tone="ok">Active</Badge>
                    <span className="ml-auto font-mono text-[10px] text-ivory-faint">{l.origin === "MANUAL" ? "WRITTEN BY LEADERSHIP" : "FROM FEEDBACK"} · {formatRelative(l.updated_at).toUpperCase()}</span>
                  </div>
                  <p className="mt-1 text-sm text-ivory-muted">{l.guidance}</p>
                  {canConfigure && (
                    <details className="mt-2">
                      <summary className="cursor-pointer list-none text-xs text-ivory-muted hover:text-ivory">Edit or retire</summary>
                      <form action={reviewLessonAction} className="mt-3 space-y-3">
                        <input type="hidden" name="id" value={l.id} />
                        <div><Label htmlFor={`at-${l.id}`}>Title</Label><Input id={`at-${l.id}`} name="title" defaultValue={l.title} maxLength={160} /></div>
                        <div><Label htmlFor={`ag-${l.id}`}>Lesson</Label><Textarea id={`ag-${l.id}`} name="guidance" defaultValue={l.guidance} rows={3} maxLength={1200} /></div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" name="decision" value="APPROVED">Save changes</Button>
                          <Button size="sm" variant="ghost" name="decision" value="ARCHIVED">Retire lesson</Button>
                        </div>
                      </form>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="feedback">
          <h2 id="feedback" className="mb-3 font-heading text-xl font-semibold">Recent feedback</h2>
          {recent.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-ivory-muted">No feedback yet. Use 👍 or 👎 under any of the {exec.short_title}&apos;s answers.</p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {recent.map((f) => {
                const lesson = f.lesson_id ? lessonById.get(f.lesson_id) : null;
                return (
                  <li key={f.id} className="flex gap-3 p-3 text-sm">
                    {f.rating === "UP" ? <ThumbsUp className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Good answer" /> : <ThumbsDown className="mt-0.5 size-4 shrink-0 text-risk" aria-label="Needs improvement" />}
                    <div className="min-w-0 flex-1">
                      <p className={f.comment ? "" : "text-ivory-faint"}>{f.comment || "Rated without a comment."}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-ivory-faint">
                        {f.source_type === "SESSION" ? "C-LEVEL SESSION" : "CONVERSATION"} · {formatRelative(f.created_at).toUpperCase()}
                        {lesson && ` · LESSON ${lesson.status === "APPROVED" ? "ACTIVE" : lesson.status === "PROPOSED" ? "WAITING" : "DISMISSED"}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {canConfigure && (
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <Card>
            <SectionTitle>Teach the {exec.short_title} directly</SectionTitle>
            <p className="mb-3 text-xs text-ivory-muted">Write a standing instruction. It applies to every answer straight away.</p>
            <ActionForm action={createLessonAction} submit="Add lesson">
              <input type="hidden" name="executive_id" value={exec.id} />
              <div><Label htmlFor="new-title">Title</Label><Input id="new-title" name="title" required maxLength={160} placeholder="e.g. Always show runway in months" /></div>
              <div><Label htmlFor="new-guidance">Lesson</Label><Textarea id="new-guidance" name="guidance" required rows={4} maxLength={1200} placeholder="e.g. Whenever cash or hiring comes up, state runway in months under base and downside scenarios, and the monthly burn used." /></div>
            </ActionForm>
          </Card>
        </aside>
      )}
    </div>
  );
}

/** 👍 / 👎 counts over the last 30 days. */
function lastThirtyDays(feedback: { rating: "UP" | "DOWN"; created_at: string }[]): { up: number; down: number } {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const recent = feedback.filter((f) => f.created_at >= since);
  const up = recent.filter((f) => f.rating === "UP").length;
  return { up, down: recent.length - up };
}

function OriginalFeedback({ lesson, feedback }: { lesson: ExecutiveLesson; feedback: { id: string; comment: string; rating: "UP" | "DOWN" }[] }) {
  const f = lesson.source_feedback_id ? feedback.find((x) => x.id === lesson.source_feedback_id) : null;
  if (!f?.comment) return null;
  return <p className="rounded-lg border border-line px-3 py-2 text-xs text-ivory-muted"><span className="text-ivory-faint">Original feedback ({f.rating === "UP" ? "👍" : "👎"}): </span>{f.comment}</p>;
}
