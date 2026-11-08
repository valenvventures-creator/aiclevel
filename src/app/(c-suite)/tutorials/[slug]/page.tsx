import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Clock, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { FlowDiagram, StepList, SymbolLegend, Tip } from "@/components/tutorials/visuals";
import { TUTORIALS, tutorialBySlug } from "@/config/tutorials";
import { requireContext } from "@/server/organizations/service";

export async function generateMetadata({ params }: PageProps<"/tutorials/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: tutorialBySlug(slug)?.title ?? "Tutorials" };
}

export default async function TutorialPage({ params }: PageProps<"/tutorials/[slug]">) {
  await requireContext(); // signed-in members only
  const { slug } = await params;
  const t = tutorialBySlug(slug);
  if (!t) notFound();
  const i = TUTORIALS.indexOf(t);
  const prev = TUTORIALS[i - 1];
  const next = TUTORIALS[i + 1];
  const related = t.related.map(tutorialBySlug).filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <article className="mx-auto max-w-5xl">
      <Link href="/tutorials" className="text-xs text-ivory-muted hover:text-ivory">← Tutorials</Link>

      <header className="plate relative mt-4 overflow-hidden p-6 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-gold-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-line-gold bg-gold-400/10 text-gold-200"><t.icon className="size-8" aria-hidden /></span>
          <div className="min-w-0">
            <p className="eyebrow">{t.category}</p>
            <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{t.title}</h1>
            <p className="mt-2 max-w-2xl text-ivory-muted">{t.summary}</p>
            <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ivory-faint">
              <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden /> {t.minutes} minute read</span>
              <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" aria-hidden /> {t.who}</span>
            </p>
            {t.open && <ButtonLink href={t.open.href} size="sm" className="mt-5">{t.open.label} <ArrowRight className="size-3.5" aria-hidden /></ButtonLink>}
          </div>
        </div>
      </header>

      <section aria-labelledby="glance" className="mt-8">
        <h2 id="glance" className="eyebrow mb-3">At a glance</h2>
        <FlowDiagram flow={t.flow} />
      </section>

      <section aria-labelledby="overview" className="mt-8">
        <h2 id="overview" className="mb-2 font-heading text-2xl font-semibold">Overview</h2>
        <p className="max-w-3xl text-[15px] leading-relaxed text-ivory-muted">{t.overview}</p>
      </section>

      <section aria-labelledby="steps" className="mt-10">
        <h2 id="steps" className="mb-6 font-heading text-2xl font-semibold">Step by step</h2>
        <StepList steps={t.steps} />
      </section>

      {t.symbols && t.symbols.length > 0 && (
        <section aria-labelledby="symbols" className="mt-12">
          <h2 id="symbols" className="mb-1 font-heading text-2xl font-semibold">What the symbols mean</h2>
          <p className="mb-4 text-sm text-ivory-muted">Labels, buttons and keys you will see in this area.</p>
          <SymbolLegend symbols={t.symbols} />
        </section>
      )}

      {t.tips && t.tips.length > 0 && (
        <section aria-labelledby="tips" className="mt-12 space-y-2">
          <h2 id="tips" className="mb-3 font-heading text-2xl font-semibold">Good to know</h2>
          {t.tips.map((tip) => <Tip key={tip}>{tip}</Tip>)}
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-12">
          <h2 id="related" className="mb-3 font-heading text-2xl font-semibold">Related tutorials</h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/tutorials/${r.slug}`} className="flex h-full items-start gap-3 rounded-2xl border border-line p-4 transition hover:border-line-gold">
                  <r.icon className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden />
                  <span className="text-sm">{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="More tutorials" className="mt-12 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={`/tutorials/${prev.slug}`} className="rounded-2xl border border-line p-4 transition hover:border-line-gold">
            <span className="flex items-center gap-1 text-xs text-ivory-faint"><ArrowLeft className="size-3" aria-hidden /> Previous</span>
            <span className="mt-1 block text-sm">{prev.title}</span>
          </Link>
        ) : <span />}
        {next && (
          <Link href={`/tutorials/${next.slug}`} className="rounded-2xl border border-line p-4 text-right transition hover:border-line-gold">
            <span className="flex items-center justify-end gap-1 text-xs text-ivory-faint">Next <ArrowRight className="size-3" aria-hidden /></span>
            <span className="mt-1 block text-sm">{next.title}</span>
          </Link>
        )}
      </nav>

      <Card className="mt-8 text-sm text-ivory-muted">Still stuck? See <Link href="/tutorials/troubleshooting" className="text-gold-300 underline-offset-2 hover:underline">Troubleshooting and common questions</Link>, or ask an Owner or Admin in your organization.</Card>
    </article>
  );
}
