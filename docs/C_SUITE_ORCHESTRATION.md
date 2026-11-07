# C-Suite Orchestration

The C-Suite Session is "convening leadership", implemented as a **server-side, bounded, stepwise** orchestrator in `src/server/ai/orchestration/csuite-orchestrator.ts`.

Hosting platforms cap each request (Netlify: 60 s, including work after the response). A full round — several positions, reviews and a CEO synthesis — takes longer, so a round never runs in one request. It runs in **bounded steps**, the same pattern Studio uses (`advanceProductionJob`):

| Endpoint | Function | What it does |
|---|---|---|
| `POST /api/sessions/[id]/run` | `startSessionRun()` | Records the question and the round's settings in `executive_sessions.run_state`; status `RUNNING`. JSON. |
| `POST /api/sessions/[id]/step` | `advanceSessionRun()` | Runs ≤ `STEP_BUDGET_MS` (40 s) of the current stage under a 58 s lease. Streams NDJSON ending in `step_end`. |
| `DELETE /api/sessions/[id]/run` | `cancelSessionRun()` | Stop: ends the round; what was already said stays in the record. |

```
startSessionRun: persist question (metadata.run_id) → run_state { stage_index: 0, turns: {} }
advanceSessionRun (one step):
  take lease (busy if another step holds it)
  plan = planStages(mode)                     (pure, unit-tested, bounded)
  stage = plan[stage_index]; first step of a stage persists its label
  pending turns stream (parallel for INDEPENDENT/VOTE, one at a time otherwise):
     assembleExecutiveContext → aiGateway.stream
     finished      → persist EXECUTIVE message (provider, model, prompt version, simulated, run_id)
     budget hit    → keep partial text in run_state; next step continues it (<your_answer_so_far>)
     error, no text→ retry ≤ maxRetries, then record "X could not complete the analysis" (never invented)
     two steps with no new text → recorded as "could not respond within the time limit"
  all turns done → stage_index + 1
  past last stage → votes (this round's VOTE messages) → CEO synthesis → PROPOSED Decision
                    → status ACTIVE, run_state null → step_end "done"
  otherwise       → release lease → step_end "continue"
```

The client (`SessionRunner`) starts the round, then calls `/step` until `done`, `idle` or `failed` (at most 60 client steps; the server stops a round after `MAX_STEPS` = 40). If the page is reloaded or the tab closed mid-round, the round is resumed automatically the next time the session is opened. A new question while an unfinished round has no active lease replaces it (recorded as "interrupted"). A step cut off by the host never leaves a session locked: the lease simply expires.

Effort is `medium` for the first part of an answer and `low` for continuations, so the first text arrives inside a step.

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
| EXECUTIVE_VOTE | Each executive scores options (`VOTE: <id> \| CONFIDENCE: <n>`) → vote synthesis (`RECOMMENDED OPTION: <id>`) |
| DISCUSS_AND_VOTE | Short positions → vote (with the discussion in the record) → vote synthesis |
| DEEP_DIVE | Independent → financial → risk → red team → synthesis |
| RAPID_SESSION | Short positions → synthesis |

If a review's lead is not at the table, that stage is skipped (never silently substituted). "Call on" runs a single executive.

## Executive Vote
Vote modes are those with a `VOTE` stage (`isVoteMode`): EXECUTIVE_VOTE and DISCUSS_AND_VOTE.

- **Ballot:** the options entered (2–6, lettered A–F). With fewer than two filled in, the ballot is `DEFAULT_VOTE_OPTIONS` (A: Proceed, B: Do not proceed) and the round is flagged `defaulted_options`. The ballot is stored on the round's QUESTION message (`metadata.vote_options`) and on the decision (`options_json`).
- **Suggest options:** `POST /api/sessions/[id]/suggest-options`. The chair drafts 2–4 options from the question (`suggest_vote_options` prompt, `vote_options` utility task), and the person edits them before convening. In demo mode the suggestions are simulated and labelled.
- **Votes:** `executive_vote` (v2) includes the session record, so in DISCUSS_AND_VOTE the votes see the positions. `parseVoteDetails` reads:
  - the vote line;
  - every option's 1–10 score from the table (`scores_json`, migration 008);
  - a short reason.

  Only votes for an option on the ballot are counted.
- **Rounds:** `groupVoteRounds` (`src/server/sessions/vote-rounds.ts`) splits votes at each question that opened a vote. A single-executive retry (`metadata.single_executive`, `retry`) joins its round, and a retried vote replaces that executive's earlier vote.
- **Retry:** when an executive fails, "Retry … vote" re-runs their vote on the same question and ballot. Calling on one executive in a vote mode plans a single `VOTE` stage with no new decision. "Retry … analysis" re-runs other stages on the round's question.
- **Recommendation:** the `vote_synthesis` prompt asks the chair to end with `RECOMMENDED OPTION: <id>` (`parseRecommendedOption`). If that line is missing or invalid, the vote leader is used (`voteLeader`). The result is stored as `decisions.recommended_option`. The line is hidden from people (`stripRecommendedLine`).
- **Approval:** the person approving picks the option to adopt; it defaults to the CEO's recommendation. That becomes `chosen_option`, and the audit records both. An approved decision is saved to C-Suite Memory as a VERIFIED `DECISIONS` record with `source_id` = decision (`rememberApprovedDecision`), so later sessions retrieve it.
- **UI:** the session's right-hand panel shows the latest round in full. For each option it shows the wording, votes, average score and confidence, a CEO recommends or Chosen badge, and a tie notice; each executive's vote expands to show their reason and scores. Earlier rounds sit under "Previous votes". In the transcript, votes show as compact cards with the full scoring behind "Show full scoring".
- **Records:** Minutes and Decision Memos include "How the C-Suite voted" (`voteRoundMarkdown`). A Decision Memo is labelled simulated when the synthesis behind it was simulated.

## Progress
Each step streams `progress` events (`index`/`count` stages, `finished`/`total` executives in the stage). The session screen shows "Stage 1 of 2 · Short positions · 3 of 5 executives finished".

## Bounds (`SESSION_LIMITS`)
`maxParticipants = 7`, `maxRounds = 5`, `maxRetries = 1`, `maxTokensPerTurn`, `costBudgetUsd` (budget enforcement hook in the gateway usage stream — Phase 6 hardening). Stage count and turn count are finite by construction; there is no "continue until agreement" loop.

## Events (NDJSON)
`stage`, `turn_start` (carries the text so far when a turn continues), `delta`, `turn_end`, `turn_failed`, `decision`, `done`, `step_end` (`continue` | `done` | `busy` | `idle` | `failed`), `error`. The client (`SessionRunner`) renders live turns with a speaking indicator, then refreshes to the persisted transcript. Failed executives surface "Retry CFO analysis?".

## Records
- Transcript: `executive_session_messages` (sequence-numbered, metadata includes memory ids and context layers).
- Votes: `executive_session_votes`.
- Decision: `decisions` (status PROPOSED until a human approves).
- Minutes / Decision Memo: deterministic compilation into `reports` (no model call needed).
