# C-Suite Orchestration

The C-Suite Session is "convening leadership", implemented as a **server-side, bounded** orchestrator: `runCSuiteSession()` in `src/server/ai/orchestration/csuite-orchestrator.ts`, exposed as a streaming endpoint `POST /api/sessions/[id]/run`.

```
USER QUESTION
  → load session, mode, participants (≤7), chair (CEO by default)
  → persist question
  → planStages(mode)                       (pure, unit-tested, bounded)
  → for each stage:
       resolve template (Prompt Registry)
       for each turn (parallel for INDEPENDENT/VOTE, sequential otherwise):
          assembleExecutiveContext (constitution, top-k memory, attachments)
          aiGateway.stream → deltas → persist message (provider, model, prompt version, simulated)
          on failure: retry ≤ maxRetries, then record "X could not complete the analysis" (no invented output)
  → persist votes (EXECUTIVE_VOTE)
  → CEO synthesis → structured Decision (recommendation, rationale, risks, confidence)
  → done
```

## Modes (`src/config/sessions/modes.ts`)
| Mode | Stages |
|---|---|
| EXECUTIVE_ROUND | Independent positions |
| CEO_SYNTHESIS | Independent → CEO synthesis |
| RED_TEAM | Independent → challenge → synthesis |
| EVIDENCE_CHECK | Independent → CTO evidence check → synthesis |
| FINANCIAL_REVIEW / RISK_REVIEW / OPERATING_REVIEW / MARKET_REVIEW / IMPACT_REVIEW | Independent → CFO / CLO / CHRO / CCO / Chief Impact Officer review → synthesis |
| CONSENSUS | Independent → convergence → synthesis |
| DISSENT | Independent → dissent round (disagreement preserved) → synthesis |
| EXECUTIVE_VOTE | Each executive scores options (`VOTE: <id> | CONFIDENCE: <n>`) → synthesis |
| DEEP_DIVE | Independent → financial → risk → red team → synthesis |
| RAPID_SESSION | Short positions → synthesis |

If a review's lead is not at the table, that stage is skipped (never silently substituted). "Call on" runs a single executive.

## Bounds (`SESSION_LIMITS`)
`maxParticipants = 7`, `maxRounds = 5`, `maxRetries = 1`, `maxTokensPerTurn`, `requestTimeoutMs` per stage, `costBudgetUsd` (budget enforcement hook in the gateway usage stream — Phase 6 hardening). Stage count and turn count are finite by construction; there is no "continue until agreement" loop.

## Events (NDJSON)
`stage`, `turn_start`, `delta`, `turn_end`, `turn_failed`, `decision`, `done`, `error`. The client (`SessionRunner`) renders live turns with a speaking indicator, then refreshes to the persisted transcript. Failed executives surface "Retry CFO analysis?".

## Records
- Transcript: `executive_session_messages` (sequence-numbered, metadata includes memory ids and context layers).
- Votes: `executive_session_votes`.
- Decision: `decisions` (status PROPOSED until a human approves).
- Minutes / Decision Memo: deterministic compilation into `reports` (no model call needed).
