# CRM — contacts, sales pipeline and activities

Menu: **Leadership → CRM** (under C-Level Sessions). Routes: `/crm` (pipeline), `/crm/contacts`, `/crm/contacts/[id]`, `/crm/contacts/new`, `/crm/deals/[id]`, `/crm/deals/new`, `/crm/transfer` (import & export).

## Pipeline
Seven stages (`src/config/crm.ts`), each with a default win probability:

| Stage | Probability | Meaning |
|---|---|---|
| Prospect | 10% | Identified and worth pursuing |
| Approach & Contact | 20% | First outreach and conversation |
| Presentation | 40% | Demo, pitch or proposal delivered |
| Follow Up | 60% | Questions, objections, next steps |
| Close | 80% | Terms agreed, contract out |
| Onboard | 100% (won) | Getting the client started |
| Manage | 100% (won) | Ongoing client relationship |

- The board (`PipelineBoard`, @dnd-kit/core) moves deals by drag and drop (mouse and touch) or the per-card **Move to** menu (keyboard, screen readers, small screens). Moves are optimistic and saved with `moveDealAction`; a failed save puts the card back.
- A move sets the stage's default probability, records a `STAGE_CHANGE` activity, and a deal reaching a won stage marks its contact `CUSTOMER`.
- Deals can be **marked as lost** (with a reason): `status = LOST`, off the board, counted in the win rate, reopenable.
- Board totals (`src/lib/crm-summary.ts`): open pipeline value, weighted forecast (Σ amount × probability over open stages), won value, win rate = won ÷ (won + lost).

## Data (migration 013)
`crm_contacts`, `crm_deals`, `crm_activities`, each with `organization_id`, RLS and an entry in `TABLES`. Activities are notes, calls, meetings, tasks (with due dates and done), emails and stage changes, linked to a contact and/or a deal.

## Import & export (`src/server/crm/spreadsheet.ts`, `transfer.ts`)
- Formats: Excel `.xlsx`, CSV (comma or semicolon, quoted fields) and TSV, read and written without external services. Up to 5,000 rows / 5 MB per import.
- Import is two steps: `POST /api/crm/import/preview` (parse + suggested column mapping, including Zoho CRM export headers) → `POST /api/crm/import/commit` (validate every row with the same Zod schemas as the forms). Contacts are de-duplicated by email (skip or update); deals link to contacts by email, then by name; stage names from other CRMs are mapped (e.g. "Negotiation/Review" → Follow Up, "Closed Won" → Onboard, "Closed Lost" → lost).
- Export: `GET /api/crm/export?entity=contacts|deals&format=xlsx|csv|tsv` (`&template=1` for a blank template). CSV/TSV values starting with `= + - @` are prefixed with `'` (formula-injection guard); XLSX cells are written as text, never formulas.

## Permissions (`crm.*` capabilities)
| | Owner | Admin | Executive | Member | Viewer | Advisor |
|---|---|---|---|---|---|---|
| View (`crm.read`) | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Create, edit, move (`crm.write`) | ✓ | ✓ | ✓ | ✓ | — | — |
| Delete (`crm.delete`) | ✓ | ✓ | ✓ | — | — | — |
| Import & export (`crm.transfer`) | ✓ | ✓ | ✓ | — | — | — |

Advisors are often outside the organization, so they have no access to customer data. Every create, update, move, delete, import and export is audited (`crm.*` audit events).

## Demo
The demo organization gets sample contacts, deals in every stage and activities once per database (`src/server/db/demo-crm.ts`, marker `demo_crm_v1`).
