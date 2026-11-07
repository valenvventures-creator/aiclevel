"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper: fades, lifts and un-blurs content as it enters the
 * viewport using the shared expo-out easing. Respects reduced motion via CSS.
 */
export function Reveal({ children, delay = 0, as: Tag = "div", className, once = true }: { children: ReactNode; delay?: number; as?: ElementType; className?: string; once?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) setInView(false);
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);
  return (
    <Tag ref={ref} data-reveal="" data-in={inView ? "true" : "false"} className={className} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>
      {children}
    </Tag>
  );
}

/** Returns 0→1 progress of an element scrolling through the viewport (for pinned sections). */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : r.top < window.innerHeight / 2 ? 1 : 0;
      setProgress(p);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return { ref, progress };
}

/** Thin gold page-progress line fixed to the bottom of the viewport. */
export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? window.scrollY / max : 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] h-px">
      <div className="h-full origin-left bg-gradient-to-r from-gold-600 via-gold-300 to-gold-100 shadow-[0_0_12px_rgba(239,186,17,.8)]" style={{ transform: `scaleX(${p})` }} />
    </div>
  );
}

/** Underline that draws itself beneath an accent phrase. */
export function DrawUnderline({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 300 14" preserveAspectRatio="none" className={`draw-underline pointer-events-none absolute -bottom-1 left-0 h-[0.22em] w-full ${className ?? ""}`}>
      <path d="M2 9 C 60 3, 140 2, 200 6 S 280 11, 298 5" fill="none" stroke="url(#ul)" strokeWidth="2.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="ul" x1="0" x2="1">
          <stop offset="0" stopColor="#a77d0a" />
          <stop offset="0.5" stopColor="#f2cf68" />
          <stop offset="1" stopColor="#fbf1d0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Starts a typewriter once `active` is true. Returns the visible text. */
export function useTypewriter(text: string, active: boolean, speed = 18) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    let i = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const t = setTimeout(() => setN(text.length), 0);
      return () => clearTimeout(t);
    }
    const id = setInterval(() => {
      i += Math.max(1, Math.round(text.length / 400));
      setN(Math.min(i, text.length));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, active, speed]);
  return text.slice(0, active ? n : 0);
}
