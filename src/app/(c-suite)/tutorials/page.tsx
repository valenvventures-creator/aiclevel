import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, GraduationCap } from "lucide-react";
import { TutorialIndex, type IndexGroup } from "@/components/tutorials/tutorial-index";
import { FlowDiagram } from "@/components/tutorials/visuals";
import { NAV_SECTIONS } from "@/components/shell/nav-config";
import { TUTORIAL_CATEGORIES, TUTORIALS, tutorialBySlug } from "@/config/tutorials";
import { requireContext } from "@/server/organizations/service";

export const metadata: Metadata = { title: "Tutorials" };

/** Which tutorial explains each menu area. */
const AREA_TUTORIAL: Record<string, string> = {
  "/hq": "c-suite-hq",
  "/executives": "executive-offices",
  "/comms": "executive-comms",
  "/sessions": "c-suite-sessions",
  "/memory": "c-suite-memory",
  "/studio": "c-suite-studio",
  "/decisions": "decisions",
  "/reports": "reports",
  "/files": "files",
  "/projects": "projects",
  "/settings": "organization-settings",
};

export default async function TutorialsPage() {
  await requireContext(); // signed-in members only
  const start = tutorialBySlug("getting-started")!;
  const groups: IndexGroup[] = TUTORIAL_CATEGORIES.map((c) => ({
    name: c.name,
    blurb: c.blurb,
    items: TUTORIALS.filter((t) => t.category === c.name).map((t) => ({
      slug: t.slug,
      title: t.title,
      summary: t.summary,
      minutes: t.minutes,
      who: t.who,
      icon: <t.icon className="size-5" aria-hidden />,
      text: [t.title, t.summary, t.overview, t.category, ...t.steps.map((s) => `${s.title} ${s.body}`)].join(" ").toLowerCase(),
    })),
  }));
  const areas = NAV_SECTIONS.flatMap((s) => s.items).filter((i) => AREA_TUTORIAL[i.href]);

  return (
    <div className="space-y-12">
      <header>
        <p className="eyebrow">Help</p>
        <h1 className="mt-3 flex items-center gap-3 font-heading text-4xl font-semibold tracking-tight"><GraduationCap className="size-9 text-gold-300" aria-hidden /> Tutorials</h1>
        <p className="mt-3 max-w-3xl text-ivory-muted">Step-by-step guides to every area of the A.I. C-Level: what each area is for, how to use it, and what the symbols on screen mean. Start with the first one if you are new.</p>
      </header>

      <Link href={`/tutorials/${start.slug}`} className="plate group block p-6 shadow-[var(--shadow-gold)] transition hover:border-line-gold sm:p-8">
        <p className="eyebrow">Start here · {start.minutes} min</p>
        <h2 className="mt-2 font-heading text-2xl font-semibold group-hover:text-gold-100 sm:text-3xl">{start.title}</h2>
        <p className="mt-2 max-w-2xl text-ivory-muted">{start.summary}</p>
        <div className="mt-5"><FlowDiagram flow={start.flow} /></div>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-gold-200">Begin the tour <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden /></span>
      </Link>

      <section aria-labelledby="map">
        <h2 id="map" className="font-heading text-2xl font-semibold">Map of the A.I. C-Level</h2>
        <p className="mb-4 mt-1 text-sm text-ivory-muted">Every area in the menu, and the tutorial that explains it. Pick the area you need help with.</p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {areas.map((a) => (
            <li key={a.href}>
              <Link href={`/tutorials/${AREA_TUTORIAL[a.href]}`} className="flex h-full flex-col items-center gap-2 rounded-2xl border border-line p-4 text-center transition hover:border-line-gold hover:bg-gold-400/[0.03]">
                <span className="grid size-12 place-items-center rounded-full border border-line-gold/60 bg-gold-400/[0.06] text-gold-200"><a.icon className="size-5" aria-hidden /></span>
                <span className="text-sm">{a.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <TutorialIndex groups={groups} />
    </div>
  );
}
