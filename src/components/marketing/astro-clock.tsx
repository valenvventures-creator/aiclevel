/**
 * Astronomical clock for the closing "Your C-Level is ready to convene"
 * section: a gilded, starry dial (Roman-numeral bezel, zodiac medallions,
 * filigree, sub-dials, sun and moon hands) with rings of light dots orbiting
 * it clockwise. Pure SVG + CSS (no client JS); animations pause under
 * reduced motion. Decorative only.
 */

const C = 320; // centre of the 640×640 view box
const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
const at = (r: number, deg: number) => ({ x: C + r * Math.cos(rad(deg)), y: C + r * Math.sin(rad(deg)) });
const ROMAN = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
const ZODIAC = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"].map((g) => `${g}︎`);

/** Deterministic pseudo-random numbers (identical on server and client). */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = 18 + Math.sqrt(rand(i, 1)) * 160;
  const p = at(r, rand(i, 2) * 360);
  return { ...p, size: 0.6 + rand(i, 3) * 1.6, bright: rand(i, 4) > 0.82, delay: rand(i, 5) * 4 };
});
/** A few constellation lines between nearby stars. */
const LINES = [
  [3, 11], [11, 19], [19, 27], [7, 15], [15, 31], [22, 40], [40, 48], [48, 56], [9, 33], [33, 45], [61, 52], [52, 37],
].map(([a, b]) => [STARS[a], STARS[b]] as const);

/** Light dots orbiting the clock: radius, count, seconds per turn (all clockwise). */
const ORBITS = [
  { r: 304, count: 16, period: 46, size: 2.6, phase: 0 },
  { r: 284, count: 10, period: 30, size: 2, phase: 9 },
  { r: 196, count: 8, period: 70, size: 1.6, phase: 4 },
];

function SubDial({ x, y, r, numbers, spin }: { x: number; y: number; r: number; numbers: number; spin: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r + 3} fill="url(#ta-clock-gold)" />
      <circle r={r} fill="#ece4cc" />
      {Array.from({ length: numbers }, (_, i) => {
        const a = (i * 360) / numbers;
        const p = { x: (r - 6) * Math.cos(rad(a)), y: (r - 6) * Math.sin(rad(a)) };
        return (
          <text key={i} x={p.x} y={p.y} transform={`rotate(${a} ${p.x} ${p.y})`} fontSize={r * 0.15} textAnchor="middle" dominantBaseline="central" fill="#2a2210" fontFamily="ui-serif, Georgia, serif">
            {i + 1}
          </text>
        );
      })}
      <circle r={r - 12} fill="url(#ta-clock-sun)" stroke="#a77d0a" strokeWidth="1" />
      <g className="motion-safe:animate-[orbit_var(--spin)_linear_infinite]" style={{ ["--spin" as string]: `${spin}s`, transformBox: "fill-box", transformOrigin: "center" }}>
        {Array.from({ length: 16 }, (_, i) => (
          <path key={i} d={`M0 ${-(r - 14)} L3 ${-(r - 26)} L-3 ${-(r - 26)} Z`} transform={`rotate(${i * 22.5})`} fill="#f6e1a1" opacity="0.85" />
        ))}
        <circle r={(r - 12) * 0.42} fill="url(#ta-clock-gold)" stroke="#6f5408" strokeWidth="1" />
        <circle r={(r - 12) * 0.18} fill="#6f5408" opacity="0.6" />
      </g>
    </g>
  );
}

export function AstroClock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 640" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="ta-clock-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbf1d0" />
          <stop offset="0.35" stopColor="#efba11" />
          <stop offset="0.7" stopColor="#a77d0a" />
          <stop offset="1" stopColor="#f2cf68" />
        </linearGradient>
        <radialGradient id="ta-clock-sky" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#24387d" />
          <stop offset="0.6" stopColor="#14214f" />
          <stop offset="1" stopColor="#0a1130" />
        </radialGradient>
        <radialGradient id="ta-clock-band" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.8" stopColor="#0f1a44" />
          <stop offset="1" stopColor="#1b2a63" />
        </radialGradient>
        <radialGradient id="ta-clock-sun" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fbf1d0" />
          <stop offset="0.5" stopColor="#d4a10c" />
          <stop offset="1" stopColor="#6f5408" />
        </radialGradient>
        <radialGradient id="ta-clock-copper" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#e6b9a0" />
          <stop offset="1" stopColor="#8c5440" />
        </radialGradient>
        <radialGradient id="ta-clock-moon" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#b9c0cf" />
          <stop offset="1" stopColor="#5b6273" />
        </radialGradient>
        <radialGradient id="ta-clock-glass" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#3a4e8f" stopOpacity="0.55" />
          <stop offset="1" stopColor="#0a1130" stopOpacity="0.35" />
        </radialGradient>
        <radialGradient id="ta-clock-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" stopColor="#efba11" stopOpacity="0.16" />
          <stop offset="1" stopColor="#efba11" stopOpacity="0" />
        </radialGradient>
        <filter id="ta-clock-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* halo */}
      <circle cx={C} cy={C} r={318} fill="url(#ta-clock-halo)" />

      {/* faint orbit paths */}
      {ORBITS.slice(0, 2).map((o) => <circle key={o.r} cx={C} cy={C} r={o.r} fill="none" stroke="#f6e1a1" strokeOpacity="0.08" strokeDasharray="1 7" />)}

      {/* outer bezel with Roman numerals */}
      <circle cx={C} cy={C} r={272} fill="url(#ta-clock-gold)" />
      <circle cx={C} cy={C} r={266} fill="#0a0e1c" />
      <circle cx={C} cy={C} r={262} fill="none" stroke="#f2cf68" strokeOpacity="0.5" />
      {Array.from({ length: 60 }, (_, i) => {
        const a = at(262, i * 6);
        const b = at(i % 5 === 0 ? 252 : 257, i * 6);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#f2cf68" strokeOpacity={i % 5 === 0 ? 0.9 : 0.45} strokeWidth={i % 5 === 0 ? 1.6 : 0.8} />;
      })}
      {ROMAN.map((n, i) => {
        const p = at(239, i * 30);
        return (
          // Numerals on the lower half are turned so they read upright.
          <text key={n} x={p.x} y={p.y} transform={`rotate(${i * 30 + (i > 3 && i < 9 ? 180 : 0)} ${p.x} ${p.y})`} textAnchor="middle" dominantBaseline="central" fontSize="21" letterSpacing="1" fill="url(#ta-clock-gold)" fontFamily="ui-serif, Georgia, 'Times New Roman', serif">
            {n}
          </text>
        );
      })}
      <circle cx={C} cy={C} r={224} fill="url(#ta-clock-gold)" />

      {/* garnet ring */}
      <circle cx={C} cy={C} r={220} fill="#4a1820" />
      <circle cx={C} cy={C} r={213} fill="url(#ta-clock-gold)" />

      {/* zodiac band with filigree */}
      <circle cx={C} cy={C} r={210} fill="url(#ta-clock-band)" />
      <g fill="none" stroke="url(#ta-clock-gold)" strokeWidth="1.1" opacity="0.75">
        {Array.from({ length: 24 }, (_, i) => (
          <path key={i} transform={`rotate(${i * 15} ${C} ${C})`} d={`M${C} ${C - 205} c8 4 10 14 3 18 c-5 3 -10 -1 -7 -5 M${C} ${C - 205} c-8 4 -10 14 -3 18 c5 3 10 -1 7 -5`} />
        ))}
      </g>
      {ZODIAC.map((g, i) => {
        const p = at(193, i * 30 + 15);
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={14} fill="url(#ta-clock-copper)" stroke="url(#ta-clock-gold)" strokeWidth="1.5" />
            <text x={p.x} y={p.y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize="14" fill="#4a1f12" fontFamily="'Segoe UI Symbol', 'DejaVu Sans', 'Apple Symbols', sans-serif">{g}</text>
          </g>
        );
      })}
      <circle cx={C} cy={C} r={176} fill="url(#ta-clock-gold)" />

      {/* starry sky */}
      <circle cx={C} cy={C} r={172} fill="url(#ta-clock-sky)" />
      <g stroke="#cfd8ff" strokeOpacity="0.28" strokeWidth="0.7">
        {LINES.map(([a, b], i) => <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />)}
      </g>
      {STARS.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.size}
          fill={s.bright ? "#fbf1d0" : "#c9d3ff"}
          opacity={s.bright ? 1 : 0.7}
          className={s.bright ? "motion-safe:animate-[blink_3.2s_ease-in-out_infinite]" : undefined}
          style={s.bright ? { animationDelay: `${s.delay}s` } : undefined}
        />
      ))}

      {/* gilded lattice over the sky */}
      <g fill="none" stroke="url(#ta-clock-gold)" strokeWidth="1.4" opacity="0.85">
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} transform={`rotate(${i * 45} ${C} ${C})`} d={`M${C} ${C - 170} q22 34 0 70 q-16 26 0 52`} />
        ))}
        <circle cx={C} cy={C} r={120} strokeOpacity="0.5" strokeDasharray="2 5" />
      </g>

      {/* sub-dials (like the date and sun dials of a cathedral clock) */}
      <SubDial x={C - 98} y={C - 42} r={58} numbers={31} spin={90} />
      <SubDial x={C + 62} y={C - 118} r={46} numbers={24} spin={60} />

      {/* ecliptic ring */}
      <g transform={`translate(${C + 14} ${C + 24})`}>
        <circle r={70} fill="url(#ta-clock-glass)" stroke="url(#ta-clock-gold)" strokeWidth="4" />
        <circle r={62} fill="none" stroke="#f2cf68" strokeOpacity="0.35" strokeDasharray="1 4" />
      </g>

      {/* hands: slow sun hand and faster star hand, both clockwise */}
      <g className="motion-safe:animate-[orbit_240s_linear_infinite]" style={{ transformBox: "view-box", transformOrigin: `${C}px ${C}px` }}>
        <path d={`M${C - 3} ${C + 30} L${C} ${C - 205} L${C + 3} ${C + 30} Z`} fill="url(#ta-clock-gold)" />
        <circle cx={C} cy={C - 214} r={9} fill="url(#ta-clock-sun)" stroke="#fbf1d0" strokeWidth="1" />
      </g>
      <g className="motion-safe:animate-[orbit_90s_linear_infinite]" style={{ transformBox: "view-box", transformOrigin: `${C}px ${C}px`, animationDelay: "-35s" }}>
        <path d={`M${C - 2} ${C + 22} L${C} ${C - 165} L${C + 2} ${C + 22} Z`} fill="#f6e1a1" />
        <path d={`M${C} ${C - 178} l4 9 l9 0 l-7 6 l3 9 l-9 -6 l-9 6 l3 -9 l-7 -6 l9 0 Z`} fill="#fbf1d0" />
      </g>
      {/* moon on its own slow hand */}
      <g className="motion-safe:animate-[orbit_420s_linear_infinite]" style={{ transformBox: "view-box", transformOrigin: `${C}px ${C}px`, animationDelay: "-216s" }}>
        <line x1={C} y1={C} x2={C} y2={C - 150} stroke="#b9c0cf" strokeOpacity="0.6" strokeWidth="1.5" />
        <circle cx={C} cy={C - 158} r={11} fill="url(#ta-clock-moon)" stroke="url(#ta-clock-gold)" strokeWidth="2" />
      </g>
      <circle cx={C} cy={C} r={11} fill="url(#ta-clock-gold)" stroke="#6f5408" strokeWidth="1.5" />
      <circle cx={C} cy={C} r={4} fill="#fbf1d0" />

      {/* light dots orbiting clockwise */}
      {ORBITS.map((o) => (
        <g key={o.r} className="motion-safe:animate-[orbit_var(--period)_linear_infinite]" style={{ ["--period" as string]: `${o.period}s`, transformBox: "view-box", transformOrigin: `${C}px ${C}px` }} filter="url(#ta-clock-glow)">
          {Array.from({ length: o.count }, (_, i) => {
            const p = at(o.r, (i * 360) / o.count + o.phase + rand(i, o.r) * 10);
            const s = o.size * (0.55 + rand(i, o.r + 1) * 0.8);
            return <circle key={i} cx={p.x} cy={p.y} r={s} fill={i % 3 === 0 ? "#ffffff" : "#f6e1a1"} opacity={0.55 + rand(i, o.r + 2) * 0.45} />;
          })}
        </g>
      ))}
    </svg>
  );
}
