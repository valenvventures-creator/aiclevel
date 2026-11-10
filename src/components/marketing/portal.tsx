import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AstroClock } from "./astro-clock";

/**
 * Closing call to action: the button above a gilded astronomical clock, with
 * rings of light dots orbiting it clockwise over a glowing floor (pure SVG +
 * CSS; still under reduced motion).
 */
export function Portal() {
  return (
    <div className="relative mx-auto mt-14 w-full max-w-3xl pb-10">
      <div className="relative z-10 flex justify-center">
        <Link href="/signup" className="group relative inline-flex h-14 items-center gap-2 rounded-full bg-gradient-to-b from-white to-gold-100 px-8 text-[15.5px] font-medium text-ink-950 shadow-[0_0_60px_-4px_rgba(251,241,208,.9),0_0_0_1px_rgba(255,255,255,.6)] transition-transform duration-500 ease-[var(--ease-out)] hover:scale-[1.03]">
          Convene your C-Level <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
      <div className="relative mx-auto mt-8 w-[min(476px,78vw)]">
        {/* floor glow */}
        <div aria-hidden className="absolute -bottom-5 left-1/2 h-20 w-[32.3rem] max-w-[120%] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse,rgba(239,186,17,.28),transparent_65%)] blur-xl" />
        <AstroClock className="relative h-auto w-full drop-shadow-[0_30px_60px_rgba(0,0,0,.6)]" />
      </div>
    </div>
  );
}
