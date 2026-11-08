import Image from "next/image";
import { ChevronRight, Lightbulb, ZoomIn } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { TUTORIAL_MEDIA } from "@/config/tutorial-media";
import type { Tutorial, TutorialImage, TutorialStep, TutorialSymbol } from "@/config/tutorials";

/** "At a glance": the tutorial's flow as icon chips joined by arrows. */
export function FlowDiagram({ flow }: { flow: Tutorial["flow"] }) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" aria-label="At a glance">
      {flow.map((f, i) => (
        <li key={f.label} className="flex items-center gap-2 sm:gap-3">
          <span className="flex items-center gap-2.5 rounded-full border border-line-gold/60 bg-gold-400/[0.06] py-1.5 pl-1.5 pr-4">
            <span className="grid size-8 place-items-center rounded-full bg-gold-400/15 text-gold-200"><f.icon className="size-4" aria-hidden /></span>
            <span className="text-sm"><span className="mr-1.5 font-mono text-[10px] text-gold-300">{i + 1}</span>{f.label}</span>
          </span>
          {i < flow.length - 1 && <ChevronRight className="hidden size-4 shrink-0 text-ivory-faint sm:block" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

export function Figure({ image, priority = false }: { image: TutorialImage; priority?: boolean }) {
  const size = TUTORIAL_MEDIA[image.name];
  const src = `/tutorials/media/${image.name}.webp`;
  // Never enlarge a screenshot beyond its real size (narrow panels stay crisp and readable).
  return (
    <figure style={{ maxWidth: size.width }}>
      <a href={src} target="_blank" rel="noopener" className="group relative block overflow-hidden rounded-xl border border-line-strong bg-ink-950 shadow-[0_20px_60px_-30px_rgba(0,0,0,.9)] transition hover:border-line-gold" aria-label={`Open full-size image: ${image.alt}`}>
        <Image src={src} alt={image.alt} width={size.width} height={size.height} unoptimized priority={priority} className="h-auto w-full" />
        <span className="absolute right-2 top-2 hidden items-center gap-1 rounded-full bg-ink-950/80 px-2 py-1 text-[10px] text-ivory-muted group-hover:inline-flex"><ZoomIn className="size-3" aria-hidden /> Enlarge</span>
      </a>
      {image.caption && <figcaption className="mt-2 text-xs text-ivory-faint">{image.caption}</figcaption>}
    </figure>
  );
}

export function StepList({ steps }: { steps: TutorialStep[] }) {
  return (
    <ol className="space-y-8">
      {steps.map((s, i) => (
        <li key={s.title} className="grid gap-4 sm:grid-cols-[56px_1fr]">
          <div className="flex items-center gap-3 sm:flex-col sm:items-center">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-line-gold bg-gold-400/10 font-heading text-lg text-gold-200" aria-hidden>{i + 1}</span>
            <span className="hidden h-full w-px bg-line sm:block" aria-hidden />
          </div>
          <div className="min-w-0 space-y-3">
            <h3 className="flex items-center gap-2 font-heading text-xl font-semibold">
              <s.icon className="size-5 shrink-0 text-gold-300" aria-hidden />
              <span><span className="sr-only">Step {i + 1}: </span>{s.title}</span>
            </h3>
            <p className="max-w-3xl text-[15px] leading-relaxed text-ivory-muted">{s.body}</p>
            {s.tip && <Tip>{s.tip}</Tip>}
            {s.image && <Figure image={s.image} priority={i === 0} />}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex max-w-3xl gap-2.5 rounded-xl border border-line-gold/50 bg-gold-400/[0.04] px-4 py-3 text-sm">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden />
      <span><span className="font-medium text-gold-200">Tip: </span>{children}</span>
    </p>
  );
}

/** What the symbols, badges and keys on screen mean. */
export function SymbolLegend({ symbols }: { symbols: TutorialSymbol[] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {symbols.map((s, i) => (
        <div key={i} className="flex items-start gap-3 rounded-xl border border-line p-3">
          <dt className="flex min-w-[96px] shrink-0 items-center">
            {s.kind === "icon" && (
              <span className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full border border-line-strong text-ivory"><s.icon className="size-4" aria-hidden /></span>
                <span className="sr-only">{s.label}</span>
              </span>
            )}
            {s.kind === "badge" && <Badge tone={s.tone}>{s.text}</Badge>}
            {s.kind === "keys" && (
              <span className="flex items-center gap-1">
                {s.keys.map((k) => <kbd key={k} className="rounded-md border border-line-strong bg-ink-900 px-2 py-0.5 font-mono text-xs text-ivory">{k}</kbd>)}
              </span>
            )}
          </dt>
          <dd className="text-sm text-ivory-muted">{s.kind === "icon" && <span className="font-medium text-ivory">{s.label}: </span>}{s.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}
