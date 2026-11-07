import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Closing call to action: a column of light rising behind the button, a
 * glowing floor and drifting gold particles (pure CSS; static under reduced motion).
 */
const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  left: 50 + Math.sin(i * 12.9898) * 18,
  delay: (i * 0.37) % 6,
  dur: 5 + ((i * 7) % 5),
  size: 1 + (i % 3),
}));

export function Portal() {
  return (
    <div className="relative mx-auto mt-14 h-[360px] w-full max-w-3xl" aria-hidden={false}>
      {/* floor glow */}
      <div aria-hidden className="absolute bottom-6 left-1/2 h-24 w-[38rem] max-w-full -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse,rgba(239,186,17,.35),transparent_65%)] blur-xl" />
      {/* beam */}
      <div aria-hidden className="absolute bottom-10 left-1/2 h-[300px] w-24 -translate-x-1/2 bg-gradient-to-t from-gold-200/70 via-gold-300/25 to-transparent blur-md" />
      <div aria-hidden className="absolute bottom-10 left-1/2 h-[300px] w-8 -translate-x-1/2 bg-gradient-to-t from-white via-gold-100/60 to-transparent blur-[2px]" />
      <div aria-hidden className="absolute bottom-10 left-1/2 h-[230px] w-[2px] -translate-x-1/2 bg-gradient-to-t from-white to-transparent" />
      {/* particles */}
      {PARTICLES.map((p, i) => (
        <span key={i} aria-hidden className="absolute bottom-14 rounded-full bg-gold-200 motion-safe:animate-[rise_var(--d)_linear_infinite]" style={{ left: `${p.left}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, ["--d" as string]: `${p.dur}s`, boxShadow: "0 0 6px rgba(251,241,208,.9)", opacity: 0.8 }} />
      ))}
      <div className="absolute inset-x-0 top-6 flex justify-center">
        <Link href="/signup" className="group relative inline-flex h-14 items-center gap-2 rounded-full bg-gradient-to-b from-white to-gold-100 px-8 text-[15.5px] font-medium text-ink-950 shadow-[0_0_60px_-4px_rgba(251,241,208,.9),0_0_0_1px_rgba(255,255,255,.6)] transition-transform duration-500 ease-[var(--ease-out)] hover:scale-[1.03]">
          Convene your C-Suite <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
