import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Gavel, Lock, ScrollText, ShieldCheck } from "lucide-react";
import { ExecutiveAvatar } from "@/components/executives/executive-avatar";
import { Chapters, type ExecLite } from "@/components/marketing/chapters";
import { CoilMachine } from "@/components/marketing/coil-machine";
import { ConveneHub, SourcesHub } from "@/components/marketing/hubs";
import { LiveDemo } from "@/components/marketing/live-demo";
import { Reveal, ScrollProgress } from "@/components/marketing/motion";
import { Portal } from "@/components/marketing/portal";
import { SiteNav } from "@/components/marketing/site-nav";
import { EXECUTIVE_SEEDS } from "@/config/executives/defaults";

const EXECS: ExecLite[] = EXECUTIVE_SEEDS.map((s) => ({ role_code: s.role_code, short_title: s.short_title, title: s.title, avatar_url: s.avatar_url, accent: s.accent }));
const CAPABILITIES = ["Daily CEO Brief", "Financial Review", "Red Team", "Risk Review", "Executive Vote", "Decision Memo", "Fundraising Strategy", "Brand Strategy", "Operating Review", "Evidence Check", "Impact Report", "Preserved Dissent", "CEO Synthesis", "Finished Work"];

export default function LandingPage() {
  return (
    <div className="grain relative overflow-x-clip bg-[#03050b]">
      <ScrollProgress />
      <SiteNav />

      <main id="main">
        {/* ================= HERO ================= */}
        <section className="relative min-h-[100svh] overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute right-[-20%] top-[-10%] h-[70rem] w-[70rem] rounded-full bg-[radial-gradient(circle,rgba(46,72,170,.28),rgba(20,28,70,.12)_40%,transparent_65%)]" />
          <div aria-hidden className="pointer-events-none absolute right-[5%] top-[10%] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(239,186,17,.14),transparent_60%)] blur-2xl" />
          <CoilMachine className="absolute right-[-12%] top-[4%] h-[92%] w-[78%] opacity-95 max-lg:right-[-30%] max-lg:top-[46%] max-lg:h-[58%] max-lg:w-[130%] max-lg:opacity-35" />
          <div className="relative mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-4 pt-24 sm:px-6">
            <div className="max-w-2xl">
              <p className="animate-fade-up font-mono text-[11px] tracking-[0.3em] text-gold-300/90">THOUGHT AUTHORITIES · A.I. C-LEVEL</p>
              <h1 className="headline mt-6 animate-fade-up text-[clamp(3rem,7.2vw,6.2rem)] [animation-delay:80ms]">
                Your C-Suite
                <br />
                augmented{" "}
                <span className="relative inline-block">
                  <span className="accent">by A.I.</span>
                </span>
              </h1>
              <p className="mt-7 max-w-lg animate-fade-up text-[17px] leading-relaxed text-white/64 [animation-delay:160ms]">
                Seven A.I. executives — CEO to Chief Impact Officer — who know your organization, think together and remember every decision.
              </p>
              <div className="mt-10 flex animate-fade-up flex-wrap items-center gap-3 [animation-delay:240ms]">
                <Link href="/signup" className="group inline-flex h-[52px] items-center gap-2 rounded-full bg-gradient-to-b from-white to-gold-100 px-[26px] text-[15.5px] font-medium text-ink-950 shadow-[0_0_40px_-6px_rgba(251,241,208,.7)] transition-all duration-500 ease-[var(--ease-out)] hover:shadow-[0_0_60px_-4px_rgba(251,241,208,.9)]">
                  Convene your C-Suite <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                <Link href="/login?demo=1" className="inline-flex h-[52px] items-center rounded-full bg-white/[0.04] px-[26px] text-[15.5px] text-white/90 transition hover:bg-white/[0.08]">
                  Explore the live demo
                </Link>
              </div>
            </div>
            <div className="mt-20 flex animate-fade-up flex-wrap items-center gap-3 [animation-delay:400ms]">
              <div className="flex -space-x-2.5">
                {EXECS.map((e) => <ExecutiveAvatar key={e.role_code} src={e.avatar_url} shortTitle={e.short_title} accent={e.accent} size={34} ring={false} className="rounded-full ring-2 ring-[#03050b]" />)}
              </div>
              <p className="font-mono text-[10.5px] tracking-[0.24em] text-white/45">SEVEN EXECUTIVES · ONE ORGANIZATION · SHARED INTELLIGENCE</p>
            </div>
          </div>
          <div aria-hidden className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-white/30 md:flex">
            <span className="font-mono text-[9px] tracking-[0.3em]">SCROLL</span>
            <span className="h-8 w-px animate-pulse-soft bg-gradient-to-b from-gold-300 to-transparent" />
          </div>
        </section>

        {/* ================= MARQUEE ================= */}
        <section aria-label="Capabilities" className="relative border-y border-white/[0.05] py-5">
          <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
            <div className="flex shrink-0 animate-marquee items-center gap-10 pr-10 [animation-duration:70s]">
              {[...CAPABILITIES, ...CAPABILITIES].map((m, i) => (
                <span key={i} className="flex items-center gap-4 whitespace-nowrap text-sm text-white/45">
                  {i % 2 === 0 ? <ExecutiveAvatar src={EXECS[i % 7].avatar_url} shortTitle={EXECS[i % 7].short_title} accent={EXECS[i % 7].accent} size={26} ring={false} /> : <span className="size-1 rotate-45 bg-gold-500" aria-hidden />}
                  {m}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ================= PROBLEMS → CHAPTERS ================= */}
        <section className="relative pt-32" aria-labelledby="problems">
          <Reveal className="mx-auto max-w-7xl px-4 sm:px-6">
            <p className="eyebrow">Where leadership time goes</p>
            <h2 id="problems" className="headline mt-5 max-w-4xl text-[clamp(2.6rem,5.6vw,4.6rem)]">Things every leader <span className="accent">knows too well</span></h2>
            <p className="mt-5 max-w-xl text-white/64">And how an A.I. C-Level changes each one. Scroll — or turn the dial yourself.</p>
          </Reveal>
          <Chapters execs={EXECS} />
        </section>

        {/* ================= ONE MEMORY ================= */}
        <section id="how" className="relative scroll-mt-16 py-32">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto h-[30rem] max-w-5xl rounded-full bg-[radial-gradient(ellipse,rgba(46,72,170,.18),transparent_65%)]" />
          <Reveal className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <p className="eyebrow">How it works</p>
            <h2 className="headline mt-5 text-[clamp(2.6rem,5.6vw,4.6rem)]">One memory. <span className="accent">Seven minds</span></h2>
            <p className="mt-5 max-w-xl text-white/64">Your documents, meetings and decisions become C-Suite Memory — verified, permissioned and traceable — and every executive draws from it.</p>
          </Reveal>
          <Reveal delay={150} className="relative mt-14 px-4 sm:px-6">
            <SourcesHub execs={EXECS} />
          </Reveal>
        </section>

        {/* ================= CONVENE ================= */}
        <section id="sessions" className="scroll-mt-16">
          <ConveneHub execs={EXECS} />
        </section>

        {/* ================= EXECUTIVES ================= */}
        <section id="executives" className="mx-auto max-w-7xl scroll-mt-16 px-4 py-32 sm:px-6">
          <Reveal>
            <p className="eyebrow">Executive Offices</p>
            <h2 className="headline mt-5 text-[clamp(2.6rem,5.6vw,4.6rem)]">Meet your <span className="accent">C-Suite</span></h2>
            <p className="mt-5 max-w-xl text-white/64">Each executive has a mandate, a reasoning framework and permissions of its own — all grounded in your Organization Constitution.</p>
          </Reveal>
          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {EXECUTIVE_SEEDS.map((s, i) => (
              <Reveal key={s.slug} delay={i * 70} className={i === 0 ? "sm:col-span-2" : ""}>
                <article className="group relative h-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[rgba(31,38,55,0.35)] p-6 transition-all duration-700 ease-[var(--ease-out)] hover:-translate-y-1 hover:border-white/[0.14] hover:bg-[rgba(31,38,55,0.55)]">
                  <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-40" style={{ background: s.accent }} />
                  <div className="relative flex items-center gap-4">
                    <ExecutiveAvatar src={s.avatar_url} shortTitle={s.short_title} accent={s.accent} size={52} ring={false} />
                    <div>
                      <p className="font-mono text-[10px] tracking-[0.24em] text-white/35">0{s.sort_order} · {s.short_title}</p>
                      <h3 className="headline text-[1.35rem] tracking-[-0.03em]">{s.title}</h3>
                    </div>
                  </div>
                  <p className="relative mt-4 text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: s.accent }}>{s.functional_mandate}</p>
                  <p className="relative mt-3 font-accent text-[1.35rem] italic leading-snug text-white/85">“{s.persona.primary_question.replace(/[“”"]/g, "")}”</p>
                  {i === 0 && <p className="relative mt-3 max-w-md text-sm text-white/55">{s.description}</p>}
                </article>
              </Reveal>
            ))}
            <Reveal delay={500} className="sm:col-span-2 lg:col-span-4">
              <article className="flex h-full flex-col justify-between gap-6 rounded-2xl border border-dashed border-white/[0.12] p-6 lg:flex-row lg:items-center">
                <p className="font-mono text-[10px] tracking-[0.24em] text-white/35">+ SPECIALISTS</p>
                <div>
                  <h3 className="headline text-[1.35rem] tracking-[-0.03em]">Extensible by design</h3>
                  <p className="mt-2 text-sm text-white/55">Every executive is configurable — persona, model, tools, memory access, voice. Add specialist advisors without rebuilding the engine.</p>
                </div>
              </article>
            </Reveal>
          </div>
        </section>

        {/* ================= LIVE DEMO ================= */}
        <section className="relative py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
            <Reveal>
              <p className="eyebrow">One-on-one</p>
              <h2 className="headline mt-5 text-[clamp(2.4rem,5vw,4.2rem)]">Ask anything. <span className="accent">Get an executive answer</span></h2>
              <p className="mt-5 max-w-md text-white/64">Private conversations that already know your numbers, your decisions and your constraints — with every source shown.</p>
              <ul className="mt-8 space-y-3 text-sm text-white/75">
                {["Grounded in verified C-Suite Memory", "Cites the files and decisions it used", "Forward to another executive or a C-Suite Session"].map((t) => (
                  <li key={t} className="flex items-center gap-2.5"><CheckCircle2 className="size-4 text-gold-400" /> {t}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={150}>
              <LiveDemo execs={EXECS} />
            </Reveal>
          </div>
        </section>

        {/* ================= SECURITY ================= */}
        <section id="security" className="mx-auto max-w-7xl scroll-mt-16 px-4 py-28 sm:px-6">
          <Reveal>
            <p className="eyebrow">Private by architecture</p>
            <h2 className="headline mt-5 text-[clamp(2.4rem,5vw,4.2rem)]">Built for <span className="accent">consequential</span> decisions</h2>
          </Reveal>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [ShieldCheck, "Tenant isolation", "Row Level Security on every table plus server-verified membership on every request."],
              [Gavel, "You approve, then it acts", "Executives propose. External email, publishing, sharing and financial actions wait for you."],
              [ScrollText, "Full audit trail", "Logins, roles, configuration, memory edits and approvals are recorded."],
              [Lock, "Secrets stay server-side", "Provider keys are encrypted at rest and never reach a browser."],
            ].map(([Icon, t, b], i) => {
              const I = Icon as typeof ShieldCheck;
              return (
                <Reveal key={t as string} delay={i * 80}>
                  <div className="h-full rounded-2xl border border-white/[0.07] bg-[rgba(31,38,55,0.35)] p-6 transition-colors duration-500 hover:border-white/[0.14]">
                    <I className="size-5 text-gold-300" aria-hidden />
                    <p className="mt-5 font-medium">{t as string}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/55">{b as string}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* ================= FAQ ================= */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-16 px-4 pb-28 sm:px-6">
          <Reveal>
            <h2 className="headline text-center text-[clamp(2.2rem,4.5vw,3.6rem)]">Questions, <span className="accent">answered</span></h2>
          </Reveal>
          <div className="mt-10 space-y-2">
            {[
              ["Are the executives people?", "No. Each A.I. Executive is an artificial-intelligence system configured for a specific mandate. They never represent themselves as licensed professionals, and they recommend qualified human counsel, accountants or advisers when a matter requires one."],
              ["Can an executive act on my behalf?", "Executives analyze, prepare and recommend. Consequential external actions — sending email, publishing, sharing confidential files, financial or contractual commitments — always require your explicit approval."],
              ["Where does my organization's data go?", "Your memory, files, sessions and decisions are isolated to your organization, and only the relevant context is retrieved for each request."],
              ["Which A.I. models power the C-Suite?", "Claude is the primary reasoning provider, with OpenAI and future models available through one gateway. Administrators choose models and fallbacks per executive."],
              ["How do plans work?", "Every organization starts on a trial with the full seven-executive C-Suite. Leadership and Enterprise plans add team scale, CEO Leadership Intelligence, integrations, SSO and advanced governance."],
            ].map(([q, a]) => (
              <details key={q} className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-5 transition-colors duration-500 open:bg-white/[0.04] [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q}
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/[0.06] text-gold-300 transition-transform duration-500 ease-[var(--ease-out)] group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ================= CLOSING PORTAL ================= */}
        <section className="relative overflow-hidden pt-24">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[40rem] bg-[radial-gradient(ellipse_at_bottom,rgba(46,72,170,.22),transparent_60%)]" />
          <Reveal className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
            <h2 className="headline text-[clamp(3rem,7.5vw,6.4rem)]">
              Your C-Suite is
              <br />
              <span className="accent">ready to convene</span>
            </h2>
            <p className="mt-6 text-white/64">Seven executives. One organization. Shared intelligence.</p>
          </Reveal>
          <Portal />
        </section>
      </main>

      <footer className="relative border-t border-white/[0.05]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Image src="/brand/crest-full.png" alt="Thought Authorities" width={1195} height={1195} className="h-auto w-28 opacity-90" />
            <p className="mt-4 max-w-xs text-sm text-white/40">Your C-Suite. Augmented by A.I.</p>
          </div>
          {(
            [
              ["Product", [["How it works", "#how"], ["Executives", "#executives"], ["C-Suite Sessions", "#sessions"], ["Security", "#security"]]],
              ["Company", [["FAQ", "#faq"], ["Terms", "/legal/terms"], ["Privacy", "/legal/privacy"]]],
              ["Get in", [["Convene your C-Suite", "/signup"], ["Sign in", "/login"], ["Live demo", "/login?demo=1"]]],
            ] as [string, [string, string][]][]
          ).map(([h, links]) => (
            <div key={h}>
              <p className="font-mono text-[10px] tracking-[0.24em] text-white/35">{h.toUpperCase()}</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {links.map(([l, href]) => <li key={l}><Link href={href} className="text-white/60 transition-colors hover:text-white">{l}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-2 px-4 pb-10 text-xs text-white/30 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} Thought Authorities · A.I. C-Level</p>
          <p>A.I. C-Level executives are artificial-intelligence systems.</p>
        </div>
      </footer>
    </div>
  );
}
