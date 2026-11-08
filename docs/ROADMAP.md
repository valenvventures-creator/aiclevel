# Roadmap

Phases follow the master brief. Each milestone file in `docs/milestones/` lists what shipped and what remains.

| Phase | Milestone | Status |
|---|---|---|
| 1 | [Foundation & Authentication](milestones/01-foundation-auth.md) | DONE (demo + Supabase code paths) |
| 2 | [Client Onboarding](milestones/02-onboarding-organizations.md) | DONE |
| 3 | [C-Level HQ](milestones/03-csuite-hq.md) | DONE |
| 4 | [Executive Offices](milestones/04-executive-offices.md) | DONE |
| 5 | [One-on-one AI](milestones/05-conversations.md) | DONE |
| 6 | [Executive Comms](milestones/06-executive-comms.md) | DONE |
| 7 | [C-Level Session](milestones/07-csuite-session.md) | DONE |
| 8 | [C-Level Memory](milestones/08-memory.md) | DONE (lexical retrieval) |
| 9 | [C-Level Studio](milestones/09-studio.md) | DONE |
| 10 | [Reports, Files, Projects](milestones/10-reports-files.md) | DONE |
| 11 | [Advanced Team Permissions](milestones/11-team-permissions.md) | PARTIAL |
| 12 | [Integrations, Voice & Billing](milestones/12-integrations-billing.md) | PLANNED |

## Genuine blockers / decisions for the owner
- **Supabase project & keys** — required to run against PostgreSQL/RLS; demo mode covers everything else.
- **Anthropic / OpenAI keys** — without them all executive output is simulated (and labelled).
- **Avatar hosting** — portraits are loaded from thoughtauthorities.com; mirror them into Storage for reliability.
- **Legal text** — Terms/Privacy are placeholders that need counsel-approved copy.
- **Email delivery** — configure Supabase SMTP (or Resend) for verification, reset and invitation emails.
