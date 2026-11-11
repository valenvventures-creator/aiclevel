# Thought Authorities — A.I. C-Level

**Seven Executives. One Organization. Shared Intelligence.**

A multi-tenant SaaS platform that gives an organization a persistent team of seven A.I. C-Level Executives — CEO, CFO, CCO, CHRO, CTO, CLO and Chief Impact Officer — who work one-on-one, correspond through Executive Comms, convene in bounded C-Level Sessions, produce Finished Work in C-Level Studio, and share one organizational memory.

## Quick start

```bash
pnpm install
```

```bash
pnpm dev
```

Open http://localhost:3000 and choose **Explore the live demo** (or sign up to run onboarding).

With no environment variables the app runs in **demo mode**: an in-memory data store seeded with the clearly-labelled *Thought Authorities Demo* organization, and simulated executive output (always marked **Simulated**). Data resets on restart.

## Going live

1. Copy `.env.example` to `.env.local`.
2. Create a Supabase project, then apply the schema:

```bash
supabase link --project-ref <ref>
```

```bash
supabase db push
```

3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`.
4. Set `ANTHROPIC_API_KEY` (primary reasoning, `claude-opus-5-5`) and optionally `OPENAI_API_KEY` (fallback).
5. Configure Supabase Auth SMTP and redirect URLs (`/verify-email`, `/reset-password`).
6. Deploy to Netlify. The product lives at **https://www.aiclevel.io**: make `www.aiclevel.io` the site's primary domain in Netlify (so `aiclevel.io` redirects to it) and set `NEXT_PUBLIC_APP_URL=https://www.aiclevel.io` so emailed links use it.
7. Email: set `RESEND_API_KEY` and `EMAIL_FROM` (e.g. `A.I. C-Level <no-reply@aiclevel.io>`, on a domain verified in Resend), then redeploy.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Develop / build / serve |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | Lint, types, unit tests (Vitest) |
| `pnpm check` | All three |
| `pnpm test:e2e` | Playwright critical path, desktop + mobile (set `PW_CHROMIUM_PATH` to use a pre-installed Chromium) |

## Documentation
Start with [`CLAUDE.md`](CLAUDE.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Everything else: [`docs/`](docs) (product requirements, database & ERD, authentication, onboarding, executive architecture, orchestration, memory, MCP & tools, routes, components, design system, roadmap & milestones).
