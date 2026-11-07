# Design System

**Calm intelligence. Executive authority.** Brand identity (crest, gold, wordmark) comes from the Thought Authorities logo. Layout, typography rhythm, interactivity and motion follow the apex.host reference, re-expressed for the A.I. C-Suite rather than copied:

| apex.host pattern | Thought Authorities implementation |
|---|---|
| Heavy grotesk headline + italic serif accent with self-drawing underline | `.headline` (Space Grotesk 600, −0.045em) + `.accent` (Instrument Serif italic, gold gradient) + `<DrawUnderline/>` |
| Rotating network sphere in the hero | `<Constellation/>` — canvas sphere of organizational memory with seven gold, pulsing, labelled C-Suite nodes; pointer tilt |
| Pinned "Without / With" problem chapters | `<Chapters/>` — five sticky chapters (desktop) that flip from red-glow *Without a C-Suite* to gold-glow *With your A.I. C-Suite* at mid-scroll; manual toggle; callout card |
| Sources → hub diagram with flowing dashed lines | `<SourcesHub/>` — organizational sources → crest (C-Suite Memory) → seven executives |
| "N of 3 connected" scroll-lit cards | `<ConveneHub/>` — curved beams from the crest light up "N of 7 convened" |
| Typed chat demo | `<LiveDemo/>` — executive tabs, typewriter Q&A, cited sources, "Example data" label |
| Light-portal closing CTA | `<Portal/>` — beam, floor glow, rising particles |
| Grain, scroll progress, expo-out reveals | `.grain`, `<ScrollProgress/>`, `<Reveal/>` with `--ease-out: cubic-bezier(0.16,1,0.3,1)` |


## Tokens (`src/app/globals.css`)
- **Ink:** `ink-1000 #020309` → `ink-700 #222B40` (deep navy-blacks); panels `rgba(31,38,55,.45)` glass.
- **Gold:** `gold-100 #FBF1D0` … `gold-400 #EFBA11` (sampled from the crest) … `gold-700`.
- **Ivory text:** `ivory #EFEBE2`, `ivory-muted #A7A399`, `ivory-faint #6F6C66`.
- **Lines:** `line` 7% ivory, `line-strong` 13%, `line-gold` 28% gold.
- **Signals:** ok / warn / risk / info, desaturated.
- **Executive accents:** CEO gold, CFO green, CCO rose, CHRO blue, CTO teal, CLO violet, Impact leaf — used only for avatars, names and subtle glows.
- **Type:** Space Grotesk (`font-heading`, headlines), Instrument Serif italic (`font-accent`, accent phrases and executive quotes), Inter (UI), JetBrains Mono (eyebrows, metadata), Cinzel (wordmark only).
- **Radii:** 8 / 12 / 18 / 24. **Shadows:** `--shadow-card`, `--shadow-gold`.

## Utilities
`eyebrow`, `text-gold-gradient`, `surface` (quiet card), `plate` (gradient-hairline "engraved plate"), `bg-grid`, `mask-radial`, `scrollbar-thin`, `.prose-exec` (Markdown).

## Motion
Expo-out easing everywhere; scroll reveals (opacity + 28px rise + blur); `fade-up`, `pulse-soft`, `marquee`, `flow` (dashed lines), `ring`, `rise` (particles), `draw` (underline), `grain`. Pinned sections are desktop-only; on mobile chapters flow normally and flip at mid-viewport. All motion is disabled or made static under `prefers-reduced-motion`.

## Brand assets
`public/brand/crest-full.png` (full logo, transparent), `crest.png` / `crest-256.png` (mark), `wordmark.png`, `icon-512.png` (app icon). Executive portraits load from thoughtauthorities.com with a monogram fallback.

## Accessibility
Skip link, landmark roles, visible gold focus ring, `aria-current` on navigation, labelled icon buttons, `aria-live` for streaming output, dialog semantics for drawer/palette/notifications, keyboard command palette, AA-contrast text tokens.
