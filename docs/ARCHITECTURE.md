# Architecture

> Thought Authorities · A.I. C-Level — one shared intelligence platform with several interaction surfaces.

## 1. System overview

```
                         THOUGHT AUTHORITIES · A.I. C-LEVEL
                                       │
      ┌──────────────┬─────────────────┼─────────────────┬──────────────┐
  C-Suite HQ   Executive Offices  Executive Comms   C-Suite Session  C-Suite Studio
      │              │                 │                 │              │
      └──────────────┴────── Next.js App Router (RSC + server actions + NDJSON streams)
                                       │
                      Tenant boundary: requireContext() / authorize(capability)
                                       │
            ┌──────────────────────────┼───────────────────────────┐
     AIExecutiveRegistry        C-Suite Orchestrator          Studio Router
     (DB-driven executives)     (bounded stage plans)         (capability registry)
            └──────────────┬───────────┴───────────┬───────────────┘
                 Context assembly (prompt builders, versioned Prompt Registry)
                           │                       │
                    C-Suite Memory retrieval   Tools registry (+ MCP adapters)
                           │
                       AI GATEWAY ── routing · fallback · usage/cost · correlation ids
                 ┌─────────┼──────────┬──────────────┐
             Anthropic   OpenAI   Simulated (demo only)   Future (Gemini, local)
                           │
              Human Approval Layer (propose → review → approve → execute)
                           │
   PostgreSQL (Supabase) + RLS · Storage (private bucket) · pgvector · Audit log
```

## 2. Layers

| Layer | Location | Responsibility |
|---|---|---|
| Routes / UI | `src/app`, `src/components` | Server components fetch through services; client components only for interactivity (streaming, forms, palette). |
| Actions & APIs | `src/server/**/actions.ts`, `src/app/api/**` | Zod validation → `authorize()` → service call → audit → revalidate. Streaming endpoints emit NDJSON. |
| Domain services | `src/server/*` | Organizations, onboarding, executives, memory, files, studio, comms, sessions, approvals, notifications. |
| AI engine | `src/server/ai` | Gateway, provider adapters, prompts, context assembly, orchestration. |
| Data | `src/server/db/store.ts` | `TenantRepo<T>` with two backends (memory for demo, Supabase with RLS). |
| Config registries | `src/config` | Executive seeds, tool registry, Studio capabilities, session modes. |

## 3. Key decisions (ADRs)

- **ADR-0001 Dual backend.** A single `TenantRepo` interface with a Supabase backend (production) and an in-memory backend (demo/tests). Column names are snake_case end-to-end — no mapping layer.
- **ADR-0002 Defence in depth for tenancy.** Every query is filtered by the server-verified `organization_id` *and* protected by RLS. The org cookie is a preference, re-validated against membership on every request.
- **ADR-0003 Cache Components disabled.** Nearly every surface is authenticated and tenant-scoped; classic dynamic rendering is simpler and avoids accidental cross-request caching. Revisit for public pages.
- **ADR-0004 Streaming via NDJSON route handlers.** Conversations and sessions stream typed events (`meta`, `delta`, `turn_start`, `turn_end`, `turn_failed`, `decision`, `done`, `error`). Persistence happens server-side regardless of client disconnects.
- **ADR-0005 Background work via `after()`.** Executive Comms replies and Studio production run after the response. For multi-instance production deploy, move these to a durable queue (Supabase Queues / Inngest) — the service functions are already idempotent per job.
- **ADR-0006 Claude-first, provider-independent.** Claude (`claude-opus-5-5`, adaptive thinking, per-executive effort, server-side refusal fallback) is the primary provider; OpenAI is a configured fallback; utility tasks use `claude-haiku-5-5`. Simulation is used **only** when no provider is configured and is always labelled.
- **ADR-0007 No unbounded agent loops.** Session stage plans are computed up-front from the mode definition and capped by `SESSION_LIMITS`.

## 4. Request lifecycle (executive conversation)

1. `POST /api/executives/[slug]/chat` → `authorize("conversations.create")`, rate limit, Zod.
2. Resolve executive via registry; verify conversation belongs to org + executive + user.
3. Persist the user message; take the last 12 turns only.
4. `assembleExecutiveContext` → platform rules → constitution → executive profile → CEO intelligence (CEO only) → task → top-k memory → files → project.
5. `aiGateway.stream` → primary → fallback → error (never fabricated).
6. Stream deltas; persist the executive message with provider, model, prompt version and `simulated` flag; record usage.

## 5. Observability
- `ai_usage_records`: org, user, executive, provider, model, tokens, estimated cost, latency, correlation id, success.
- `audit_logs`: security and configuration events.
- Errors are logged server-side with correlation ids; users get safe messages. Add Sentry by setting `SENTRY_DSN` (planned integration point: `src/lib/http.ts` and the gateway).

## 6. Deployment
Vercel (Next.js) + Supabase (DB/Auth/Storage) + Anthropic + OpenAI; optional ElevenLabs, Stripe. See `README.md` for environment variables. Scheduled executive functions (Daily CEO Brief, weekly reviews) will run as Vercel Cron → server route → Studio service, respecting permissions and approval.

## 7. Related docs
[PRODUCT_REQUIREMENTS](PRODUCT_REQUIREMENTS.md) · [DATABASE](DATABASE.md) · [AUTHENTICATION](AUTHENTICATION.md) · [ONBOARDING](ONBOARDING.md) · [AI_EXECUTIVE_ARCHITECTURE](AI_EXECUTIVE_ARCHITECTURE.md) · [C_SUITE_ORCHESTRATION](C_SUITE_ORCHESTRATION.md) · [MEMORY_ARCHITECTURE](MEMORY_ARCHITECTURE.md) · [MCP_AND_TOOLS](MCP_AND_TOOLS.md) · [ROUTES](ROUTES.md) · [COMPONENTS](COMPONENTS.md) · [DESIGN_SYSTEM](DESIGN_SYSTEM.md) · [ROADMAP](ROADMAP.md)
