# A.I. Executive Architecture

## The seven core executives
| # | Title | Role code | Mandate | Core question | Prompt key |
|---|---|---|---|---|---|
| 01 | Chief Executive Officer | CEO | Direction, Leadership, & Vision | What direction creates the greatest long-term advantage? | `ceo_core` |
| 02 | Chief Financial Officer | CFO | Accounting, Fundraising, & Investments | What does the financial reality tell us? | `cfo_core` |
| 03 | Chief Communications Officer | CCO | Brand, Marketing/Sales, & Public Relations | How should this be positioned, communicated, and brought to market? | `cco_core` |
| 04 | Chief Human Resources Officer | CHRO | HR, Management, & Operations | Who owns this, and what system makes it work? | `chro_core` |
| 05 | Chief Technology Officer | CTO | Innovation, Research, & Security | What can technology make possible, faster, safer, or more scalable? | `cto_core` |
| 06 | Chief Legal Officer | CLO | Governance, Legal, & Risk | What must be protected, governed, documented, or challenged? | `clo_core` |
| 07 | Chief Impact Officer | CIO | Charity, Philanthropy, & Sustainability | Who benefits, what changes, and how do we measure the impact? | `impact_core` |

Seeds: `src/config/executives/defaults.ts` (persona, skills, model, tools, memory categories, avatar). On organization creation `seedExecutivesForOrganization()` copies them into the tenant's tables; from then on **the database is the source of truth** and administrators edit everything in *Settings → A.I. C-Level → Configure*.

## Data model
`AIExecutive` (identity, status, order) · `AIExecutivePersona` (north star, beliefs, style, system instructions, reasoning framework, risk constraints) · `AIExecutiveSkill` · `AIExecutiveModelConfig` (primary/fallback provider+model, effort, token budget, tool permissions, memory categories, prompt key) · `AIExecutiveVoice`.

Custom specialist executives use `role_code = CUSTOM_*`, `is_core = false`; nothing in the engine assumes exactly seven, while the UI preserves the seven-executive default order.

## AIExecutiveRegistry (`src/server/executives/registry.ts`)
`getExecutive`, `getAllExecutives`, `getByRole`, `getExecutivePersona`, `getExecutiveSkills`, `getExecutiveModelConfig`, `getExecutiveTools`, `getExecutiveMemoryPermissions`, `getExecutivePromptVersion`, `resolve`/`resolveMany` (fully resolved), `updateExecutive` (audited), `activateExecutive`, `deactivateExecutive` (core executives cannot be deactivated). `publishExecutiveVersion` maps to publishing a new `prompt_templates` row for the executive's prompt key.

## Prompt Registry & builders
- Platform defaults in `src/server/ai/prompts/templates.ts` (all `v1`): `platform_rules`, `executive_generic`, `*_core`, `c_suite_session`, `rapid`, `red_team`, `consensus`, `dissent`, `executive_vote`, `ceo_synthesis`, `financial_review`, `risk_review`, `operating_review`, `market_review`, `impact_review`, `evidence_check`, `studio_router`, `studio_production`, `memory_extraction`.
- Organizations may publish overrides into `prompt_templates`; `PromptRegistry.resolve` prefers the latest PUBLISHED version.
- Outputs record `prompt_version` (e.g. `cfo_core_v1+financial_review_v1`).

### Context layers (fixed order)
1 Platform rules → 2 Organization Constitution → 3 Executive role → 4 Persona → 5 Expertise → 6 Human CEO leadership intelligence (**CEO only**, included items only) → 7 Task instructions → 8 Relevant C-Level Memory (top-k, permitted categories) → 8a This executive's own knowledge (library) → 8b Company documents (most relevant passages; **every executive**) → 9 Attached files → 10 Project → 11 Recent conversation (≤12 turns, as messages) → 12 Current request.

Untrusted content is wrapped in `<organization_memory>`, `<company_documents>`, `<executive_library>`, `<files>`, `<project>`, `<retrieved_content>`, `<human_leadership_intelligence>`; closing-tag injection is neutralised and platform rules declare these blocks to be data.

## AI Gateway (`src/server/ai/gateway`)
- `aiGateway.stream(req)` / `generate(req)`; UI never touches providers.
- Routing (`routing.ts`): strategic tasks use the executive's configured model; `studio_routing`, `memory_extraction`, `short_communication` use `claude-haiku-5-5` at low effort.
- Adapters: `AnthropicAdapter` (official SDK, streaming, adaptive thinking, `output_config.effort`, server-side refusal fallback `fallbacks: "default"`), `OpenAIAdapter` (chat completions stream), `SimulatedAdapter` (only when no provider is configured; output begins with a visible "Simulated response" banner and messages are flagged `simulated`).
- Fallback: primary → configured fallback; never splices a fallback onto a partially streamed answer; on failure emits `error` (never invents content).
- Usage recorded per attempt with correlation id and estimated cost.

## Human CEO Leadership Intelligence
Owner-only (`ceo_intelligence.manage`, RLS owner-only). Structured entries (principles, decisions, writing, speeches, interviews, preferences, history) with an `included` toggle and delete. Described to users as a *structured leadership intelligence profile* — never as copying a person.

## Learning and library
Each executive improves through approved **lessons** drawn from feedback and an **Executive Library** of reference knowledge. See [EXECUTIVE_LEARNING.md](./EXECUTIVE_LEARNING.md). Context layers now include `leadership_lessons` (after the executive profile) and `executive_library` (after C-Level Memory).
