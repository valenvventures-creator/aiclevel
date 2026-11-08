"use client";

import { useEffect, useRef } from "react";

const EXECS = ["CEO", "CFO", "CCO", "CHRO", "CTO", "CLO", "CIO"];

type Pt = { x: number; y: number };
type Bolt = { paths: Pt[][]; born: number; life: number; gold: boolean; target?: number };

/**
 * Hero visual: a line-art illustration of a giant electrical coil — a
 * cylindrical cage of bars on wooden legs with a central mast, ball and
 * disc cap — drawn as a gold outline. Lightning crackles out from the top,
 * and the seven C-Level titles hover in a slow orbit around the top of the
 * machine, joined by gold triangular lines; now and then the coil strikes
 * one of them. Pointer movement tilts the scene. A single still frame under
 * reduced motion. Decorative only.
 */
export function CoilMachine({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-code").trim() || "ui-monospace, monospace";

    let w = 0;
    let h = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      canvas.width = Math.max(1, w * dpr);
      canvas.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let tx = 0;
    let ty = 0;
    let px = 0;
    let py = 0;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width - 0.5) * 2;
      py = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    /** Geometry of the machine for the current canvas size. */
    const geo = () => {
      const S = Math.min(w, h * 0.95);
      const cx = w * 0.46 + tx * S * 0.02;
      const rx = S * 0.23;
      const ry = rx * 0.24;
      const capY = h * 0.1 + ty * S * 0.01;
      const cageTop = h * 0.47;
      const cageBot = h * 0.8;
      const floorY = h * 0.93;
      return { S, cx, rx, ry, capY, cageTop, cageBot, floorY, ballY: cageTop - ry * 0.2 };
    };

    /** A jagged lightning path with optional branches. */
    let minX = 0;
    let maxX = Infinity;
    const lightning = (from: Pt, angle: number, length: number, branches: number): Pt[][] => {
      const main: Pt[] = [from];
      const steps = 9 + Math.floor(Math.random() * 6);
      let p = from;
      let a = angle;
      for (let i = 0; i < steps; i++) {
        a += (Math.random() - 0.5) * 0.9;
        const seg = (length / steps) * (0.6 + Math.random() * 0.8);
        p = { x: p.x + Math.cos(a) * seg, y: p.y + Math.sin(a) * seg };
        main.push(p);
        // Arcs never reach across the headline text on the left.
        if (p.x < minX || p.x > maxX || p.y < 0) break;
      }
      const out = [main];
      for (let b = 0; b < branches; b++) {
        if (main.length < 4) break;
        const at = main[2 + Math.floor(Math.random() * (main.length - 3))];
        out.push(...lightning(at, angle + (Math.random() - 0.5) * 1.4, length * (0.3 + Math.random() * 0.3), 0));
      }
      return out;
    };

    /** A bolt from a to b (for strikes on a C-Level node). */
    const strike = (a: Pt, b: Pt): Pt[] => {
      const pts: Pt[] = [a];
      const n = 10;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const off = (Math.random() - 0.5) * len * 0.18 * Math.sin(Math.PI * t);
        pts.push({ x: a.x + dx * t + (-dy / len) * off, y: a.y + dy * t + (dx / len) * off });
      }
      pts.push(b);
      return pts;
    };

    const bolts: Bolt[] = [];
    let lastSpawn = 0;
    let lastStrike = 0;
    const flash = new Array(EXECS.length).fill(0);

    const drawEllipseHalf = (x: number, y: number, rx: number, ry: number, front: boolean, alpha: number, width = 1) => {
      ctx.lineWidth = width;
      ctx.strokeStyle = `rgba(242, 207, 104, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
      ctx.stroke();
    };

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = (now - start) / 1000;
      tx += (px - tx) * 0.04;
      ty += (py - ty) * 0.04;
      const g = geo();
      const { S, cx, rx, ry, capY, cageTop, cageBot, floorY, ballY } = g;
      ctx.clearRect(0, 0, w, h);

      // soft glow behind the top of the machine
      const halo = ctx.createRadialGradient(cx, ballY, 0, cx, ballY, S * 0.55);
      halo.addColorStop(0, "rgba(170, 190, 255, 0.10)");
      halo.addColorStop(0.5, "rgba(239, 186, 17, 0.05)");
      halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      // corona over the rim of the cage, where the discharge starts
      const corona = ctx.createRadialGradient(cx, cageTop, rx * 0.2, cx, cageTop, rx * 1.4);
      corona.addColorStop(0, "rgba(200, 215, 255, 0.10)");
      corona.addColorStop(1, "rgba(200, 215, 255, 0)");
      ctx.fillStyle = corona;
      ctx.fillRect(0, 0, w, h);

      // floor
      drawEllipseHalf(cx, floorY, rx * 1.6, ry * 1.5, true, 0.12);
      drawEllipseHalf(cx, floorY, rx * 1.6, ry * 1.5, false, 0.06);

      // legs (wooden posts)
      ctx.lineWidth = 1.2;
      for (const a of [Math.PI * 0.22, Math.PI * 0.78, Math.PI * 1.25, Math.PI * 1.75]) {
        const x = cx + Math.cos(a) * rx * 0.7;
        const yTop = cageBot + Math.sin(a) * ry * 0.7;
        const front = Math.sin(a) > 0;
        ctx.strokeStyle = `rgba(242, 207, 104, ${front ? 0.45 : 0.18})`;
        ctx.beginPath();
        ctx.moveTo(x - S * 0.006, yTop);
        ctx.lineTo(x - S * 0.006, floorY + Math.sin(a) * ry * 0.9);
        ctx.moveTo(x + S * 0.006, yTop);
        ctx.lineTo(x + S * 0.006, floorY + Math.sin(a) * ry * 0.9);
        ctx.stroke();
      }

      // back half of the rings, then the bars, then the front half of the rings
      const rings = 6;
      for (let i = 0; i <= rings; i++) {
        const y = cageTop + ((cageBot - cageTop) * i) / rings;
        drawEllipseHalf(cx, y, rx, ry, false, i === 0 || i === rings ? 0.3 : 0.14);
      }
      // inner wooden bracing (the X frames)
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(242, 207, 104, 0.16)";
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.45, cageTop + ry * 0.4);
      ctx.lineTo(cx + rx * 0.3, cageBot + ry * 0.2);
      ctx.moveTo(cx + rx * 0.4, cageTop + ry * 0.5);
      ctx.lineTo(cx - rx * 0.2, cageBot + ry * 0.3);
      ctx.moveTo(cx - S * 0.012, cageTop);
      ctx.lineTo(cx - S * 0.012, cageBot + ry);
      ctx.moveTo(cx + S * 0.012, cageTop);
      ctx.lineTo(cx + S * 0.012, cageBot + ry);
      ctx.stroke();

      const bars = 44;
      const rot = reduce ? 0 : t * 0.12;
      for (let i = 0; i < bars; i++) {
        const a = (i / bars) * Math.PI * 2 + rot;
        const depth = Math.sin(a); // > 0: front (lower on screen)
        const x = cx + Math.cos(a) * rx;
        const yo = depth * ry;
        ctx.lineWidth = depth > 0 ? 1.1 : 0.7;
        ctx.strokeStyle = `rgba(${depth > 0 ? "246, 225, 161" : "242, 207, 104"}, ${depth > 0 ? 0.25 + depth * 0.4 : 0.08 + (depth + 1) * 0.1})`;
        ctx.beginPath();
        ctx.moveTo(x, cageTop + yo);
        ctx.lineTo(x, cageBot + yo);
        ctx.stroke();
      }
      for (let i = 0; i <= rings; i++) {
        const y = cageTop + ((cageBot - cageTop) * i) / rings;
        drawEllipseHalf(cx, y, rx, ry, true, i === 0 || i === rings ? 0.75 : 0.35, i === 0 || i === rings ? 1.4 : 1);
      }

      // central mast, ball and disc cap
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = "rgba(246, 225, 161, 0.75)";
      ctx.beginPath();
      ctx.moveTo(cx - S * 0.02, capY + S * 0.02);
      ctx.lineTo(cx - S * 0.024, ballY);
      ctx.moveTo(cx + S * 0.02, capY + S * 0.02);
      ctx.lineTo(cx + S * 0.024, ballY);
      ctx.stroke();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = "rgba(246, 225, 161, 0.3)";
      for (let i = 1; i < 6; i++) {
        const y = capY + S * 0.02 + ((ballY - capY - S * 0.02) * i) / 6;
        ctx.beginPath();
        ctx.moveTo(cx - S * 0.022, y);
        ctx.lineTo(cx + S * 0.022, y);
        ctx.stroke();
      }
      // cap: a thick disc
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(251, 241, 208, 0.85)";
      ctx.beginPath();
      ctx.ellipse(cx, capY, S * 0.085, S * 0.02, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, capY + S * 0.018, S * 0.085, S * 0.02, 0, 0, Math.PI);
      ctx.moveTo(cx - S * 0.085, capY);
      ctx.lineTo(cx - S * 0.085, capY + S * 0.018);
      ctx.moveTo(cx + S * 0.085, capY);
      ctx.lineTo(cx + S * 0.085, capY + S * 0.018);
      ctx.stroke();
      // ball
      const ballR = S * 0.03;
      const bg = ctx.createRadialGradient(cx - ballR * 0.3, ballY - ballR * 0.4, 0, cx, ballY, ballR * 3);
      bg.addColorStop(0, "rgba(251, 241, 208, 0.6)");
      bg.addColorStop(1, "rgba(251, 241, 208, 0)");
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(cx, ballY, ballR * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(251, 241, 208, 0.9)";
      ctx.beginPath();
      ctx.arc(cx, ballY, ballR, 0, Math.PI * 2);
      ctx.stroke();

      // C-Level: seven titles orbiting around the top of the machine
      const orbitY = capY + (ballY - capY) * 0.55;
      const ax = rx * 1.45;
      const ay = rx * 0.32;
      const nodes = EXECS.map((label, k) => {
        const a = (k / EXECS.length) * Math.PI * 2 + (reduce ? 0.4 : t * 0.1);
        const depth = Math.sin(a);
        const bob = reduce ? 0 : Math.sin(t * 0.9 + k * 1.3) * S * 0.014;
        return { label, x: cx + Math.cos(a) * ax, y: orbitY + depth * ay + bob, depth, k };
      });
      const pulse = reduce ? 0.6 : 0.45 + 0.3 * Math.sin(t * 1.5);
      ctx.lineWidth = 1.1;
      const n = nodes.length;
      for (let k = 0; k < n; k++) {
        for (const step of [1, 3]) {
          const a = nodes[k];
          const b = nodes[(k + step) % n];
          const d = (a.depth + b.depth) / 2;
          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          grad.addColorStop(0, `rgba(242, 207, 104, ${pulse * (0.55 + d * 0.35)})`);
          grad.addColorStop(1, `rgba(239, 186, 17, ${pulse * (0.3 + d * 0.25)})`);
          ctx.strokeStyle = grad;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // lightning
      minX = cx - rx * 1.55;
      maxX = cx + rx * 2.6;
      if (!reduce && now - lastSpawn > 45 + Math.random() * 60) {
        lastSpawn = now;
        const count = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          const left = Math.random() < 0.5;
          const dir = left ? -1 : 1;
          const fromRim = Math.random() < 0.55;
          // From the ball near the mast, or from the top rim of the cage, fanning up and out.
          const from = fromRim
            ? { x: cx + dir * rx * (0.35 + Math.random() * 0.6), y: cageTop - ry * (0.2 + Math.random() * 0.5) }
            : { x: cx + dir * (S * 0.03 + Math.random() * rx * 0.2), y: ballY - Math.random() * S * 0.02 };
          const down = Math.random() < 0.15;
          const angle = down
            ? (left ? Math.PI * 0.64 : Math.PI * 0.36) + (Math.random() - 0.5) * 0.4
            : (left ? -Math.PI * 0.8 : -Math.PI * 0.2) + (Math.random() - 0.5) * 0.8;
          const length = S * (down ? 0.5 : 0.22 + Math.random() * 0.24);
          bolts.push({ paths: lightning(from, angle, length, 2 + Math.floor(Math.random() * 2)), born: now, life: 120 + Math.random() * 170, gold: false });
        }
      }
      if (!reduce && now - lastStrike > 1400 + Math.random() * 1200) {
        lastStrike = now;
        const target = Math.floor(Math.random() * n);
        bolts.push({ paths: [strike({ x: cx, y: capY + S * 0.01 }, nodes[target])], born: now, life: 320, gold: true, target });
        flash[target] = now;
      }
      if (reduce && bolts.length === 0) {
        for (const [ang, left] of [[-Math.PI * 0.8, true], [-Math.PI * 0.2, false], [-Math.PI * 0.7, true], [-Math.PI * 0.3, false], [-Math.PI * 0.88, true], [-Math.PI * 0.12, false]] as const) {
          bolts.push({ paths: lightning({ x: cx + (left ? -1 : 1) * S * 0.05, y: ballY }, ang, S * 0.35, 2), born: now, life: Infinity, gold: false });
        }
      }
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        const age = now - b.born;
        if (age > b.life) {
          bolts.splice(i, 1);
          continue;
        }
        const life = Number.isFinite(b.life) ? 1 - age / b.life : 0.7;
        const flicker = Number.isFinite(b.life) ? 0.6 + Math.random() * 0.4 : 1;
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = b.gold ? "rgba(239, 186, 17, 0.9)" : "rgba(170, 190, 255, 0.9)";
        b.paths.forEach((path, j) => {
          ctx.lineWidth = j === 0 ? (b.gold ? 1.8 : 1.3) : 0.8;
          ctx.strokeStyle = b.gold ? `rgba(251, 241, 208, ${life * flicker})` : `rgba(225, 233, 255, ${life * flicker * (j === 0 ? 0.9 : 0.6)})`;
          ctx.beginPath();
          path.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.stroke();
        });
        ctx.restore();
      }

      // nodes on top (back ones first)
      [...nodes].sort((a, b) => a.depth - b.depth).forEach((p) => {
        const hit = reduce ? 0 : Math.max(0, 1 - (now - flash[p.k]) / 600);
        const r = (3 + p.depth * 0.9) * (1 + hit * 0.6);
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 7);
        glow.addColorStop(0, `rgba(239, 186, 17, ${0.45 + hit * 0.45})`);
        glow.addColorStop(1, "rgba(239, 186, 17, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fbf1d0";
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `500 ${Math.round(10 + p.depth * 1.2)}px ${mono}`;
        ctx.fillStyle = `rgba(242, 207, 104, ${0.6 + (p.depth + 1) * 0.18 + hit * 0.3})`;
        ctx.fillText(p.label, p.x + r + 6, p.y + 3);
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
