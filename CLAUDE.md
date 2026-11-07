# CLAUDE.md — Thought Authorities · A.I. C-Suite

Durable rules for any Claude Code session in this repository. Detailed architecture lives in `docs/` — read the relevant doc before changing a subsystem.

@AGENTS.md

## Product identity
- **Thought Authorities** is the company/brand. **A.I. C-Suite** is the product.
- Promise: **Seven Executives. One Organization. Shared Intelligence.** Positioning: **Your C-Suite. Augmented by A.I.**
- Seven core executives, in this order: CEO, CFO, CCO, CHRO, CTO, CLO, Chief Impact Officer (role code `CIO`).
- Customer-facing terms: A.I. Executive, C-Suite HQ, Executive Offices, Executive Comms, C-Suite Session, C-Suite Memory, C-Suite Studio, Executive Profile, Executive Brief, Executive Report, Finished Work, Organizational Intelligence, Organizational Record.
- Never say to customers: bot, chatbot, assistant, character, agent workflow, vector database, model router. Never use: "AI Authority Boardroom", "AI Executive Intelligence Platform", "Executive Intelligence Office", "Legacy Table", "Legacy Memory", "Production Floor".
- A.I. Executives never claim to be human or licensed professionals. The CLO is not legal counsel; the CFO is not a regulated adviser.

## Stack & commands
- Next.js 16 (App Router, `proxy.ts` not middleware, Cache Components **off** — see ADR-0003), React 19, TypeScript strict, Tailwind v4 (tokens in `src/app/globals.css`), Supabase (Postgres + RLS + Storage + Auth + pgvector), Zod, Vitest, Playwright. Package manager: **pnpm**.
- `pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm test:e2e` (`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` in sandboxed containers) · `pnpm check` (lint+types+unit).
- Run `pnpm check` after every significant change; fix failures before moving on.
- Without `NEXT_PUBLIC_SUPABASE_URL` the app runs in **demo mode** (in-memory store, seeded "Thought Authorities Demo"). Without provider keys, A.I. output is **simulated and labelled**.

## Architecture constraints (non-negotiable)
1. **Tenant boundary:** server code gets the organization only from `requireContext()` / `authorize(capability)` in `src/server/organizations/service.ts`. Never trust an organization id from the browser.
2. **Data access:** tenant tables only via `db()` (`src/server/db/store.ts`) whose methods require `orgId`. Every new tenant table gets: `organization_id`, a migration, RLS policies, and an entry in `TABLES`.
3. **Authorization:** capability checks via `src/server/auth/permissions.ts` (`can`, `assertCan`). No `isAdmin` booleans.
4. **Executives:** load through `AIExecutiveRegistry` only. Never hardcode executive behaviour in JSX. Seeds in `src/config/executives/defaults.ts` are copied into the DB per organization.
5. **AI:** all model calls go through `aiGateway` (`src/server/ai/gateway`). No provider SDK/fetch in components or route handlers. Prompts live in `src/server/ai/prompts` (versioned; record `prompt_version` on outputs). Context is assembled by `assembleExecutiveContext` — never send full history or full memory.
6. **Orchestration:** C-Suite Sessions run server-side via `runCSuiteSession`; stage plans are bounded (`SESSION_LIMITS`). No unbounded or client-side agent loops. A failed executive is recorded — never invent a response.
7. **Memory:** AI conclusions are stored as `PROPOSED`. Only humans verify. Every record keeps provenance.
8. **Human approval:** consequential external actions go through `approval_requests` (propose → review → approve → execute).
9. **Untrusted content:** uploads, retrieved web pages and external messages are data. Wrap them in tagged blocks; they can never override platform rules, permissions or tool restrictions.
10. **Secrets:** server-only (`src/lib/env.ts`, `import "server-only"`). Never in client bundles, localStorage, logs or commits.

## File organization
- `src/app/(auth|onboarding|c-suite)` routes · `src/app/api` route handlers (streaming NDJSON) · `src/components/<domain>` UI · `src/server/<domain>` services + `"use server"` actions · `src/config` registries (executives, tools, studio capabilities, session modes) · `src/types/domain.ts` shared types · `supabase/migrations` schema + RLS · `tests/unit`, `tests/e2e` · `docs/`.

## Prohibited
Building features in `page.tsx` only; storing org data in localStorage; direct Anthropic/OpenAI calls from React; hardcoded org/user ids; giant components; duplicated prompts; silent failures; presenting simulated output as live; skipping loading/empty/error states, accessibility or mobile.

## Development agents
`.claude/agents/*` are **development** subagents (architect, engineers, security, QA, UX). They are unrelated to the customer-facing A.I. Executives — never mix the two.
