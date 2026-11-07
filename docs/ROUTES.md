# Route Map

## Public
| Route | Purpose |
|---|---|
| `/` | Marketing site |
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/invite/[token]` | Account system |
| `/legal/terms`, `/legal/privacy` | Placeholder legal text (replace before launch) |

## Onboarding
`/onboarding` — 18-step client onboarding.

## A.I. C-Suite (authenticated, `src/app/(c-suite)`)
| Route | Surface |
|---|---|
| `/hq` | C-Suite HQ |
| `/executives`, `/executives/[slug]?tab=conversation|profile|reports|files|activity&c=<conversationId|new>` | Executive Offices |
| `/comms?folder=&thread=&compose=1&to=&q=&filter=unread` | Executive Comms |
| `/sessions`, `/sessions/new?objective=&with=`, `/sessions/[id]` | C-Suite Sessions |
| `/memory?q=&category=&status=&id=` | C-Suite Memory |
| `/studio?lead=&preset=`, `/studio/[id]?v=` | C-Suite Studio / Finished Work |
| `/decisions` | Decision record |
| `/reports`, `/reports/[id]` | Reports |
| `/files` | Files |
| `/projects`, `/projects/[id]` | Projects |
| `/settings/[section]`, `/settings/c-suite/[slug]` | Settings (18 sections) |

## API (route handlers)
| Method & path | Purpose |
|---|---|
| `POST /api/executives/[slug]/chat` | Streaming one-on-one (NDJSON) |
| `POST /api/sessions/[id]/run` | Start a C-Suite Session round (JSON); `DELETE` stops it |
| `POST /api/sessions/[id]/step` | Run one bounded step of the round (NDJSON) |
| `POST /api/files` · `GET /api/files/[id]` | Validated upload · authorized download / signed URL |
| `GET /api/search?q=` | Global search |
| `GET /api/reports/[id]/export?format=pdf\|docx\|md` · `GET /api/studio/[id]/export?v=&format=pdf\|docx\|md` | Branded PDF / Word / Markdown export (audited as `report.export`) |
| `POST /api/studio/[id]/advance` | Runs one bounded Studio production step |
| `GET /api/health` | Liveness |

Server actions (forms) live beside their domains in `src/server/**/actions.ts`.
