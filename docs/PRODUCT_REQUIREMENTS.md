# Product Requirements — A.I. C-Level

**Company:** Thought Authorities · **Product:** A.I. C-Level
**Promise:** Seven Executives. One Organization. Shared Intelligence.
**Positioning:** Your C-Level. Augmented by A.I. — *Put an intelligent C-Level behind every important decision.*
**Design principle:** Calm intelligence. Executive authority.

## Users
Founders, CEOs and leadership teams of 10–500 person companies, family offices and mission-driven nonprofits. Roles: Owner, Admin, Executive, Member, Advisor, Viewer.

## Jobs to be done
1. Get an expert, organization-aware perspective on any leadership question in minutes.
2. Convene several perspectives, see disagreement, and leave with a decision record.
3. Turn requests into Finished Work led by the right executive.
4. Build an institutional memory that outlives conversations and people.
5. Stay in control: no consequential external action without human approval.

## Surfaces & acceptance criteria (MVP)
| Surface | Must |
|---|---|
| Public site | Brand, promise, executives, sessions, platform, security, plans, FAQ; CTA to signup and demo. |
| Auth | Signup (first/last/email/password/confirm/terms/privacy), login (show/hide, remember, forgot), reset (expiring token, session revocation), verification (pending, resend, gated features), invite acceptance; rate limits; safe errors. |
| Onboarding | 18 steps (grouped into 9 screens), resumable, creates org + Owner + Constitution + seven executives + initial memory; ends in HQ. |
| C-Level HQ | Greeting, items needing attention, executive status, Daily CEO Brief, decisions, approvals, comms, sessions, Studio, financial/risk alerts, memory to confirm, quick actions. |
| Executive Offices | Seven cards in canonical order; office with header, actions (converse, message, report, session, assign work, voice) and tabs (Conversation, Profile, Reports, Files, Activity). |
| Conversations | Streaming, markdown/tables, stop, regenerate, continue, edit-and-resend, copy, read aloud, voice input, save to memory, forward, bring to session, persistent history. |
| Executive Comms | Inbox/Sent/Starred/Drafts/Archived; threads; one/several/all-seven/human recipients; begin-from origins; search, unread filter, star, archive; executives reply asynchronously. |
| C-Level Session | Create/title/objective/participants/chair/project/attachments; 14 strategies; call on one; vote options; live streaming; bounded; transcript; decision record; minutes; decision memo. |
| C-Level Memory | CRUD, search, filters, verify, pin, archive, provenance inspector, visibility, executive relevance. |
| C-Level Studio | Natural-language request, live routing preview with override, priority, project; lead + contributors; versions; revisions; approve; save as report; export. |
| Reports / Files / Projects / Decisions | Lists, detail, export, authorized downloads, project aggregation, decision approval workflow. |
| Settings | Profile, Organization + Constitution, Team & invitations & roles, A.I. C-Level configuration, CEO Leadership Intelligence, AI Models (status, test, routing, usage), Tools matrix, Security (password, sessions), Developer (prompt registry, audit), Billing, Voice, Integrations, and governance info pages. |

## Non-functional
Multi-tenant isolation (server + RLS), WCAG-oriented accessibility, responsive (desktop primary, tablet collapsible, mobile drawer), streaming UX, every async view has loading/empty/success/error/retry, observability (usage, audit, correlation ids), no secrets client-side, demo content always labelled.

## Out of scope for MVP (planned)
Billing (Stripe), premium voices, hands-free sessions, external integrations/MCP adapters, scheduled executive briefs, model-invoked tool use, document text extraction worker, semantic embedding worker.
