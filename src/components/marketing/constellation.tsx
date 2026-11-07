"use client";

import { useEffect, useRef } from "react";

const EXECS = ["CEO", "CFO", "CCO", "CHRO", "CTO", "CLO", "CIO"];

/**
 * Hero visual: a slowly rotating 3-D network of organizational intelligence.
 * Seven gold nodes — the C-Suite — are wired to each other and pulse; the
 * surrounding field of faint nodes is the organization's shared memory.
 * Pointer movement tilts the sphere. Static single frame under reduced motion.
 */
export function Constellation({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Deterministic pseudo-random so SSR/CSR and reloads look identical.
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

    const N = 170;
    const pts: { x: number; y: number; z: number; exec?: string }[] = [];
    for (let i = 0; i < N; i++) {
      // Fibonacci sphere with jitter → even but organic distribution.
      const t = (i + 0.5) / N;
      const phi = Math.acos(1 - 2 * t);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 0.82 + rand() * 0.26;
      pts.push({ x: r * Math.cos(theta) * Math.sin(phi), y: r * Math.sin(theta) * Math.sin(phi), z: r * Math.cos(phi) });
    }
    // The seven executives: a cluster on the visible hemisphere.
    const execIdx: number[] = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const target = { x: 0.42 * Math.cos(a) + 0.15, y: 0.42 * Math.sin(a) - 0.1, z: 0.7 };
      let best = 0;
      let bd = Infinity;
      pts.forEach((p, i) => {
        if (execIdx.includes(i)) return;
        const d = (p.x - target.x) ** 2 + (p.y - target.y) ** 2 + (p.z - target.z) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      execIdx.push(best);
      pts[best].exec = EXECS[k];
    }
    // Precompute neighbour links (3 nearest).
    const links: [number, number][] = [];
    pts.forEach((p, i) => {
      const near = pts
        .map((q, j) => ({ j, d: (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2 }))
        .filter((o) => o.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      for (const n of near) if (i < n.j) links.push([i, n.j]);
    });
    const execLinks: [number, number][] = execIdx.map((a, k) => [a, execIdx[(k + 1) % 7]]);
    execIdx.forEach((a, k) => execLinks.push([a, execIdx[(k + 3) % 7]]));

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let tiltX = 0;
    let tiltY = 0;
    let targetX = 0;
    let targetY = 0;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      targetY = ((e.clientX - r.left) / r.width - 0.5) * 0.6;
      targetX = ((e.clientY - r.top) / r.height - 0.5) * 0.4;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    let angle = 0.6;
    const start = performance.now();
    const frame = (now: number) => {
      const t = (now - start) / 1000;
      if (!reduce) angle += 0.0016;
      tiltX += (targetX - tiltX) * 0.04;
      tiltY += (targetY - tiltY) * 0.04;
      const ay = angle + tiltY;
      const ax = -0.25 + tiltX;
      const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
      const R = Math.min(w, h) * 0.42;
      const proj = pts.map((p) => {
        const x1 = p.x * cy + p.z * sy;
        const z1 = -p.x * sy + p.z * cy;
        const y1 = p.y * cx - z1 * sx;
        const z2 = p.y * sx + z1 * cx;
        const s = 1 / (1.9 - z2 * 0.55);
        return { x: w / 2 + x1 * R * s * 1.3, y: h / 2 + y1 * R * s * 1.3, z: z2, s };
      });

      ctx.clearRect(0, 0, w, h);
      // field links
      ctx.lineWidth = 0.6;
      for (const [a, b] of links) {
        const pa = proj[a], pb = proj[b];
        const depth = (pa.z + pb.z) / 2;
        ctx.strokeStyle = `rgba(170, 190, 255, ${0.05 + (depth + 1) * 0.07})`;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
      // C-Suite links (gold, pulsing)
      const pulse = reduce ? 0.6 : 0.45 + 0.35 * Math.sin(t * 1.6);
      ctx.lineWidth = 1.1;
      for (const [a, b] of execLinks) {
        const pa = proj[a], pb = proj[b];
        const g = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
        g.addColorStop(0, `rgba(242, 207, 104, ${pulse})`);
        g.addColorStop(1, `rgba(239, 186, 17, ${pulse * 0.5})`);
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
      // nodes
      proj.forEach((p, i) => {
        const isExec = Boolean(pts[i].exec);
        const alpha = 0.25 + (p.z + 1) * 0.35;
        if (isExec) {
          const r = 3.2 * p.s * 1.6;
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6);
          glow.addColorStop(0, "rgba(239,186,17,0.55)");
          glow.addColorStop(1, "rgba(239,186,17,0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fbf1d0";
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = "500 10px ui-monospace, 'JetBrains Mono', monospace";
          ctx.fillStyle = `rgba(242, 207, 104, ${0.55 + (p.z + 1) * 0.2})`;
          ctx.fillText(pts[i].exec!, p.x + r + 6, p.y + 3);
        } else {
          ctx.fillStyle = `rgba(210, 222, 255, ${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.3 * p.s * 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
