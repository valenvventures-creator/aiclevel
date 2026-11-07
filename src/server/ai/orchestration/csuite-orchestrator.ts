import "server-only";
import { randomUUID } from "node:crypto";
import { SESSION_LIMITS, SESSION_MODES, type SessionStageDef } from "@/config/sessions/modes";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { db, newId, nowIso } from "@/server/db/store";
import { audit } from "@/server/audit";
import { aiGateway } from "../gateway";
import { fill, PromptRegistry } from "../prompts/registry";
import { formatTranscript } from "../prompts/builders";
import { assembleExecutiveContext } from "../executives/context";
import type { TaskType } from "../gateway/types";
import type { CSuiteSession, CSuiteSessionMessage, Organization, ResolvedExecutive, Role, SessionMode, SessionRunState } from "@/types/domain";
import { planStages, parseVote, type PlannedStage } from "./plan";

/**
 * C-SUITE ORCHESTRATOR (server-side only) — STEPWISE.
 *
 * Hosting platforms cap each request (Netlify: 60 s, including work after the
 * response). A full session — several executive positions, reviews and a CEO
 * synthesis — takes longer, so a round runs in bounded STEPS:
 *
 *   startSessionRun()   records the question and the round's settings;
 *   advanceSessionRun() runs ≤ STEP_BUDGET_MS of work under a short lease:
 *                       every executive still speaking in the current stage
 *                       (in parallel where the mode allows) streams on; partial
 *                       answers are saved and continued in the next step;
 *                       finished turns are persisted; the stage advances.
 *
 * The plan is computed from the mode definition (planStages) and is finite;
 * MAX_STEPS and MAX_EMPTY_STEPS make runaway loops impossible. A failed
 * executive is recorded — a response is never invented. An interrupted round
 * (tab closed, request cut off) is resumable, and a new question replaces it.
 */

export const SESSION_STEP_LIMITS = {
  STEP_BUDGET_MS: 40_000,
  LEASE_MS: 58_000,
  MAX_STEPS: 40,
  MAX_EMPTY_STEPS: 2,
} as const;

export type OrchestratorEvent =
  | { type: "stage"; stage: string; label: string }
  | { type: "turn_start"; executiveId: string; executiveTitle: string; stage: string; text: string }
  | { type: "delta"; executiveId: string; text: string }
  | { type: "turn_end"; executiveId: string; messageId: string; simulated: boolean; provider: string | null; model: string | null }
  | { type: "turn_failed"; executiveId: string; executiveTitle: string; error: string }
  | { type: "decision"; decisionId: string }
  | { type: "done"; status: "ADJOURNED" | "FAILED" }
  | { type: "step_end"; state: "continue" | "done" | "busy" | "idle" | "failed"; error?: string }
  | { type: "error"; error: string };

const STAGE_TASK: Record<SessionStageDef["key"], TaskType> = {
  INDEPENDENT: "session_position",
  SPECIALTY_REVIEW: "session_review",
  CHALLENGE: "session_review",
  VOTE: "session_vote",
  SYNTHESIS: "session_synthesis",
};

type NewMessage = Omit<CSuiteSessionMessage, "id" | "organization_id" | "session_id" | "sequence_number" | "created_at">;

const leaseActive = (run: SessionRunState | null | undefined) => Boolean(run?.lease_until && new Date(run.lease_until).getTime() > Date.now());

async function messageWriter(orgId: string, sessionId: string) {
  const d = db();
  const existing = await d.sessionMessages.list(orgId, { where: { session_id: sessionId }, orderBy: "sequence_number" });
  let seq = existing.reduce((m, x) => Math.max(m, x.sequence_number), 0);
  return {
    existing,
    persist: async (m: NewMessage) => {
      const row: CSuiteSessionMessage = { ...m, id: newId(), organization_id: orgId, session_id: sessionId, sequence_number: ++seq, created_at: nowIso() };
      await d.sessionMessages.insert(row);
      return row;
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Start a round                                                             */
/* ------------------------------------------------------------------------ */

export interface StartRunInput {
  organization: Organization;
  userId: string;
  sessionId: string;
  userMessage: string;
  mode?: SessionMode;
  participantExecutiveIds?: string[];
  attachmentIds?: string[];
  options?: { voteOptions?: { id: string; label: string }[]; onlyExecutiveId?: string };
}

export async function startSessionRun(input: StartRunInput): Promise<{ state: "started" | "busy"; runId?: string; error?: string }> {
  const orgId = input.organization.id;
  const d = db();
  const session = await d.sessions.get(orgId, input.sessionId);
  if (!session) return { state: "busy", error: "Session not found." };
  // A round that is genuinely being worked on right now is respected; anything else
  // (finished, interrupted, or left "running" by an older version) is replaced.
  if (leaseActive(session.run_state)) return { state: "busy" };

  const { persist } = await messageWriter(orgId, session.id);
  if (session.run_state) {
    await persist({ speaker_type: "SYSTEM", speaker_id: null, stage: "INTERRUPTED", content: "The previous round was interrupted before it finished", provider: null, model: null, prompt_version: null, simulated: false, metadata: { run_id: session.run_state.run_id } });
  }
  const mode = input.mode ?? session.mode;
  const participantIds = (input.participantExecutiveIds ?? session.participant_executive_ids).filter((p) => session.participant_executive_ids.includes(p)).slice(0, SESSION_LIMITS.maxParticipants);
  const run: SessionRunState = {
    run_id: randomUUID(),
    question: input.userMessage,
    mode,
    participant_ids: participantIds.length ? participantIds : session.participant_executive_ids,
    only_executive_id: input.options?.onlyExecutiveId ?? null,
    vote_options: input.options?.voteOptions?.length ? input.options.voteOptions : null,
    attachment_ids: input.attachmentIds ?? [],
    stage_index: 0,
    turns: {},
    steps: 0,
    lease_until: null,
    started_at: nowIso(),
  };
  await persist({ speaker_type: "USER", speaker_id: input.userId, stage: "QUESTION", content: input.userMessage, provider: null, model: null, prompt_version: null, simulated: false, metadata: { run_id: run.run_id } });
  await d.sessions.update(orgId, session.id, { status: "RUNNING", mode, started_at: session.started_at ?? nowIso(), run_state: run });
  await audit(orgId, input.userId, "session.run", "executive_session", session.id, { mode, participants: run.participant_ids.length });
  return { state: "started", runId: run.run_id };
}

/** Stops the current round (the person pressed Stop). What was already said stays in the record. */
export async function cancelSessionRun(input: { organization: Organization; userId: string; sessionId: string }): Promise<boolean> {
  const orgId = input.organization.id;
  const d = db();
  const session = await d.sessions.get(orgId, input.sessionId);
  if (!session?.run_state) {
    if (session?.status === "RUNNING") await d.sessions.update(orgId, session.id, { status: "ACTIVE" });
    return false;
  }
  const { persist } = await messageWriter(orgId, session.id);
  await persist({ speaker_type: "SYSTEM", speaker_id: null, stage: "STOPPED", content: "Session round stopped", provider: null, model: null, prompt_version: null, simulated: false, metadata: { run_id: session.run_state.run_id } });
  await d.sessions.update(orgId, session.id, { status: "ACTIVE", run_state: null });
  await audit(orgId, input.userId, "session.stop", "executive_session", session.id, {});
  return true;
}

/* ------------------------------------------------------------------------ */
/* Advance a round by one bounded step                                       */
/* ------------------------------------------------------------------------ */

export interface AdvanceRunInput {
  organization: Organization;
  userId: string;
  viewerRole: Role;
  sessionId: string;
  budgetMs?: number;
  signal?: AbortSignal;
}

export async function* advanceSessionRun(input: AdvanceRunInput): AsyncGenerator<OrchestratorEvent> {
  const orgId = input.organization.id;
  const d = db();
  const found = await d.sessions.get(orgId, input.sessionId);
  const foundRun = found?.run_state ?? null;
  if (!found || !foundRun) {
    yield { type: "step_end", state: "idle" };
    return;
  }
  const session: CSuiteSession = found;
  const run: SessionRunState = foundRun;
  if (leaseActive(run)) {
    yield { type: "step_end", state: "busy" };
    return;
  }

  // Saves only while this round is still the session's round (Stop or a new question replaces it).
  const save = async (): Promise<boolean> => {
    const current = await d.sessions.get(orgId, session.id);
    if (current?.run_state?.run_id !== run.run_id) return false;
    await d.sessions.update(orgId, session.id, { run_state: { ...run } });
    return true;
  };
  run.steps += 1;
  run.lease_until = new Date(Date.now() + SESSION_STEP_LIMITS.LEASE_MS).toISOString();
  await save();

  let settled = false;
  const finish = async (status: "ACTIVE" | "FAILED"): Promise<void> => {
    settled = true;
    const current = await d.sessions.get(orgId, session.id);
    if (current?.run_state?.run_id === run.run_id) await d.sessions.update(orgId, session.id, { status, run_state: null });
  };
  try {
    yield* stepBody();
  } finally {
    // Whatever happened (budget, closed tab, crash), release the lease so the round can resume.
    if (!settled) {
      run.lease_until = null;
      await save().catch((err) => console.error("[orchestrator] could not release lease", err));
    }
  }

  async function* stepBody(): AsyncGenerator<OrchestratorEvent> {
  const { existing, persist } = await messageWriter(orgId, session.id);

  if (run.steps > SESSION_STEP_LIMITS.MAX_STEPS) {
    await persist({ speaker_type: "SYSTEM", speaker_id: null, stage: "STOPPED", content: "The round was stopped because it exceeded the maximum length for one session round", provider: null, model: null, prompt_version: null, simulated: false, metadata: { run_id: run.run_id, failed: true } });
    await finish("FAILED");
    yield { type: "done", status: "FAILED" };
    yield { type: "step_end", state: "failed", error: "The round exceeded the maximum length." };
    return;
  }

  const modeDef = SESSION_MODES[run.mode];
  const executives = await AIExecutiveRegistry.resolveMany(orgId, run.participant_ids);
  const allExecs = await AIExecutiveRegistry.getAllExecutives(orgId);
  const chair = (session.chair_executive_id && (await AIExecutiveRegistry.resolve(orgId, session.chair_executive_id))) || (await AIExecutiveRegistry.resolve(orgId, allExecs.find((e) => e.role_code === "CEO")?.id ?? ""));
  if (!executives.length || !chair) {
    await finish("FAILED");
    yield { type: "step_end", state: "failed", error: "No executives are available for this session." };
    return;
  }
  const plan = planStages(modeDef, executives, chair, run.only_executive_id ?? undefined);
  const titleOf = new Map<string, string>([...executives, chair].map((e) => [e.id, e.title]));

  if (run.stage_index < plan.length) {
    const stage = plan[run.stage_index];
    if (!Object.keys(run.turns).length) {
      yield { type: "stage", stage: stage.def.key, label: stage.def.label };
      await persist({ speaker_type: "SYSTEM", speaker_id: null, stage: stage.def.key, content: stage.def.label, provider: null, model: null, prompt_version: null, simulated: false, metadata: { run_id: run.run_id } });
      run.turns = Object.fromEntries(stage.turns.map((t) => [t.exec.id, { text: "", done: false, attempts: 0, empty_steps: 0 }]));
    } else {
      yield { type: "stage", stage: stage.def.key, label: stage.def.label };
    }

    // Shared record of the conversation so far (bounded), rebuilt from persisted messages.
    const fresh = await d.sessionMessages.list(orgId, { where: { session_id: session.id }, orderBy: "sequence_number" });
    const record = (fresh.length ? fresh : existing)
      .filter((m) => m.speaker_type !== "SYSTEM")
      .slice(-14)
      .map((m) => ({ speaker: m.speaker_type === "USER" ? "Leadership" : (titleOf.get(m.speaker_id ?? "") ?? "Executive"), stage: m.stage, content: m.content }));

    yield* runStageStep({ input, session, run, stage, executives, record, persist, budgetMs: input.budgetMs ?? SESSION_STEP_LIMITS.STEP_BUDGET_MS, modeLabel: modeDef.label, modeDescription: modeDef.description });

    if (Object.values(run.turns).every((t) => t.done)) {
      run.stage_index += 1;
      run.turns = {};
    }
  }

  if (run.stage_index >= plan.length) {
    // Round complete: votes and the structured decision record.
    const roundMessages = (await d.sessionMessages.list(orgId, { where: { session_id: session.id }, orderBy: "sequence_number" })).filter((m) => m.metadata?.run_id === run.run_id);
    for (const m of roundMessages.filter((x) => x.stage === "VOTE" && x.speaker_type === "EXECUTIVE")) {
      const v = parseVote(m.content);
      if (v) await d.votes.insert({ id: newId(), organization_id: orgId, session_id: session.id, executive_id: m.speaker_id!, option_id: v.option, score: 0, reason: m.content.slice(0, 400), confidence: v.confidence / 100, created_at: nowIso() });
    }
    const synthesis = [...roundMessages].reverse().find((m) => m.stage === "SYNTHESIS" && m.speaker_type === "EXECUTIVE");
    if (synthesis) {
      const decisionId = await recordDecision(session, input, run, synthesis.content);
      yield { type: "decision", decisionId };
    }
    const anySpoke = roundMessages.some((m) => m.speaker_type === "EXECUTIVE");
    await finish(anySpoke ? "ACTIVE" : "FAILED");
    yield { type: "done", status: anySpoke ? "ADJOURNED" : "FAILED" };
    yield { type: "step_end", state: "done" };
    return;
  }

  yield { type: "step_end", state: "continue" };
  }
}

/** Runs one bounded step of the current stage: pending turns stream until done or the budget ends. */
async function* runStageStep(args: {
  input: AdvanceRunInput;
  session: CSuiteSession;
  run: SessionRunState;
  stage: PlannedStage;
  executives: ResolvedExecutive[];
  record: { speaker: string; stage: string; content: string }[];
  persist: (m: NewMessage) => Promise<CSuiteSessionMessage>;
  budgetMs: number;
  modeLabel: string;
  modeDescription: string;
}): AsyncGenerator<OrchestratorEvent> {
  const { input, session, run, stage } = args;
  const orgId = input.organization.id;
  const pending = stage.turns.filter((t) => !run.turns[t.exec.id]?.done);
  const active = stage.parallel ? pending : pending.slice(0, 1);
  const template = await PromptRegistry.resolve(orgId, stage.def.promptKey);
  const transcript = formatTranscript(args.record);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), args.budgetMs);
  const onAbort = () => ctrl.abort();
  input.signal?.addEventListener("abort", onAbort);

  const turnGen = async function* (exec: ResolvedExecutive): AsyncGenerator<OrchestratorEvent> {
    const state = run.turns[exec.id];
    yield { type: "turn_start", executiveId: exec.id, executiveTitle: exec.title, stage: stage.def.key, text: state.text };
    const task = fill(template.content, {
      objective: session.objective || run.question,
      mode_label: args.modeLabel,
      mode_description: args.modeDescription,
      participants: args.executives.map((e) => e.title).join(", "),
      mandate: exec.functional_mandate,
      transcript,
      options: (run.vote_options ?? [{ id: "A", label: "Proceed" }, { id: "B", label: "Do not proceed" }]).map((o) => `- ${o.id}: ${o.label}`).join("\n"),
    });
    const built = await assembleExecutiveContext({ organization: input.organization, viewerRole: input.viewerRole, exec, query: `${session.objective} ${run.question}`, fileIds: run.attachment_ids, taskInstructions: task });
    const content = state.text
      ? `${run.question}\n\n<your_answer_so_far>\n${state.text.slice(-30_000)}\n</your_answer_so_far>\n\nYour answer above is unfinished. Continue it from exactly where it ends. Output only the continuation — do not repeat any text already written.`
      : run.question;

    let added = "";
    let finished = false;
    let error: string | null = null;
    let provider: string | null = null;
    let model: string | null = null;
    let simulated = false;
    for await (const c of aiGateway.stream({
      organizationId: orgId,
      userId: input.userId,
      executiveId: exec.id,
      executiveRole: exec.role_code,
      taskType: STAGE_TASK[stage.def.key],
      system: built.system,
      messages: [{ role: "user", content }],
      // Medium effort keeps time-to-first-text inside one step; continuations only keep writing.
      modelPreference: { provider: exec.model.primary_provider, model: exec.model.primary_model, fallbackProvider: exec.model.fallback_provider, fallbackModel: exec.model.fallback_model, effort: state.text || state.empty_steps > 0 ? "low" : "medium" },
      maxTokens: SESSION_LIMITS.maxTokensPerTurn,
      promptVersion: template.versionTag,
      signal: ctrl.signal,
    })) {
      if (c.type === "meta" && c.provider) {
        provider = c.provider;
        model = c.model ?? null;
        simulated = Boolean(c.simulated);
      } else if (c.type === "text" && c.text) {
        added += c.text;
        yield { type: "delta", executiveId: exec.id, text: c.text };
      } else if (c.type === "done") finished = c.stopReason !== "max_tokens";
      else if (c.type === "error") error = c.error ?? "Unknown error";
    }
    state.text += added;
    // An abort here is the step budget (or a closed tab), not a provider failure.
    if (ctrl.signal.aborted) error = null;

    if (finished && !ctrl.signal.aborted && !error && state.text.trim()) {
      const row = await args.persist({ speaker_type: "EXECUTIVE", speaker_id: exec.id, stage: stage.def.key, content: state.text, provider: (provider as CSuiteSessionMessage["provider"]) ?? null, model, prompt_version: `${built.promptVersion}+${template.versionTag}`, simulated, metadata: { run_id: run.run_id, memory_ids: built.memoryIds, layers: built.layers } });
      state.done = true;
      yield { type: "turn_end", executiveId: exec.id, messageId: row.id, simulated, provider, model };
      return;
    }
    // Failure without any text: retry once, then record it. Never invent a response.
    if (error && !state.text.trim()) {
      state.attempts += 1;
      if (state.attempts > SESSION_LIMITS.maxRetries) {
        await args.persist({ speaker_type: "SYSTEM", speaker_id: exec.id, stage: stage.def.key, content: `${exec.title} could not complete the analysis.`, provider: null, model: null, prompt_version: null, simulated: false, metadata: { run_id: run.run_id, failed: true, error } });
        state.done = true;
        yield { type: "turn_failed", executiveId: exec.id, executiveTitle: exec.title, error };
      }
      return;
    }
    // Budget reached mid-answer: keep the partial text for the next step.
    if (!added.trim()) {
      state.empty_steps += 1;
      if (state.empty_steps >= SESSION_STEP_LIMITS.MAX_EMPTY_STEPS) {
        await args.persist({ speaker_type: "SYSTEM", speaker_id: exec.id, stage: stage.def.key, content: `${exec.title} could not respond within the time limit.`, provider: null, model: null, prompt_version: null, simulated: false, metadata: { run_id: run.run_id, failed: true } });
        state.done = true;
        yield { type: "turn_failed", executiveId: exec.id, executiveTitle: exec.title, error: "No response within the time limit." };
      }
    } else state.empty_steps = 0;
  };

  try {
    yield* mergeGenerators(active.map((t) => turnGen(t.exec)));
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", onAbort);
  }
}

/** Merges several event generators, yielding events as they arrive (bounded by the participants in one stage). */
async function* mergeGenerators(gens: AsyncGenerator<OrchestratorEvent>[]): AsyncGenerator<OrchestratorEvent> {
  const queue: OrchestratorEvent[] = [];
  const waker: { fn: (() => void) | null } = { fn: null };
  let active = gens.length;
  for (const g of gens) {
    (async () => {
      try {
        for await (const ev of g) {
          queue.push(ev);
          waker.fn?.();
        }
      } catch (err) {
        console.error("[orchestrator] turn crashed", err);
      } finally {
        active -= 1;
        waker.fn?.();
      }
    })();
  }
  while (active > 0 || queue.length) {
    if (!queue.length) await new Promise<void>((r) => (waker.fn = r));
    waker.fn = null;
    while (queue.length) yield queue.shift()!;
  }
}

async function recordDecision(session: CSuiteSession, input: AdvanceRunInput, run: SessionRunState, synthesis: string): Promise<string> {
  const section = (name: string) => synthesis.split(/\n## /).find((s) => s.toLowerCase().startsWith(name.toLowerCase()))?.split("\n").slice(1).join("\n").trim() ?? "";
  const confMatch = section("Confidence").match(/(\d{1,3})\s*%/);
  const risks = section("Key risks")
    .split("\n")
    .filter((l) => l.startsWith("|") && !/---|Risk \|/i.test(l))
    .map((l) => l.split("|").map((c) => c.trim()).filter(Boolean))
    .filter((c) => c.length >= 2)
    .map((c) => ({ risk: c[0], severity: (["LOW", "MEDIUM", "HIGH"].find((s) => c[1].toUpperCase().includes(s)) ?? "MEDIUM") as "LOW" | "MEDIUM" | "HIGH" }));
  const id = newId();
  await db().decisions.insert({
    id,
    organization_id: input.organization.id,
    project_id: session.project_id,
    session_id: session.id,
    title: session.title,
    question: run.question,
    options_json: run.vote_options ?? [],
    chosen_option: null,
    recommendation: section("Recommendation") || synthesis.slice(0, 600),
    rationale: section("Rationale"),
    risks_json: risks,
    financial_implications_json: null,
    technology_implications_json: null,
    people_implications_json: null,
    impact_implications_json: null,
    confidence: confMatch ? Math.min(100, Number(confMatch[1])) / 100 : 0.5,
    status: "PROPOSED",
    created_by: input.userId,
    created_at: nowIso(),
  });
  return id;
}
