import "server-only";
import { SESSION_LIMITS, SESSION_MODES, type SessionStageDef } from "@/config/sessions/modes";
import { AIExecutiveRegistry } from "@/server/executives/registry";
import { db, newId, nowIso } from "@/server/db/store";
import { audit } from "@/server/audit";
import { aiGateway } from "../gateway";
import { fill, PromptRegistry } from "../prompts/registry";
import { formatTranscript } from "../prompts/builders";
import { assembleExecutiveContext } from "../executives/context";
import type { TaskType } from "../gateway/types";
import type { CSuiteSession, CSuiteSessionMessage, Organization, ResolvedExecutive, Role, SessionMode } from "@/types/domain";
import { planStages, parseVote, type PlannedTurn } from "./plan";

/**
 * C-SUITE ORCHESTRATOR (server-side only).
 *
 * USER QUESTION → analyze objective → resolve participants → retrieve context
 * → independent analyses (bounded parallel) → specialty reviews → challenge
 * → vote → CEO synthesis → persist transcript → structured decision record.
 *
 * Hard bounds: maxParticipants, maxRounds (stage count), maxRetries, per-turn
 * token caps, request timeout and a cost budget. There are no open-ended
 * agent loops: the stage plan is computed up-front from the mode definition.
 */

export type OrchestratorEvent =
  | { type: "stage"; stage: string; label: string }
  | { type: "turn_start"; executiveId: string; executiveTitle: string; stage: string }
  | { type: "delta"; executiveId: string; text: string }
  | { type: "turn_end"; executiveId: string; messageId: string; simulated: boolean; provider: string | null; model: string | null }
  | { type: "turn_failed"; executiveId: string; executiveTitle: string; error: string }
  | { type: "decision"; decisionId: string }
  | { type: "done"; status: "ADJOURNED" | "FAILED" }
  | { type: "error"; error: string };

export interface RunCSuiteSessionInput {
  organization: Organization;
  userId: string;
  viewerRole: Role;
  sessionId: string;
  userMessage: string;
  mode?: SessionMode;
  participantExecutiveIds?: string[];
  attachmentIds?: string[];
  options?: { voteOptions?: { id: string; label: string }[]; onlyExecutiveId?: string };
  signal?: AbortSignal;
}

const STAGE_TASK: Record<SessionStageDef["key"], TaskType> = {
  INDEPENDENT: "session_position",
  SPECIALTY_REVIEW: "session_review",
  CHALLENGE: "session_review",
  VOTE: "session_vote",
  SYNTHESIS: "session_synthesis",
};

export async function* runCSuiteSession(input: RunCSuiteSessionInput): AsyncGenerator<OrchestratorEvent> {
  const orgId = input.organization.id;
  const d = db();
  const session = await d.sessions.get(orgId, input.sessionId);
  if (!session) {
    yield { type: "error", error: "Session not found." };
    return;
  }
  const mode = input.mode ?? session.mode;
  const modeDef = SESSION_MODES[mode];
  const participantIds = (input.participantExecutiveIds ?? session.participant_executive_ids).slice(0, SESSION_LIMITS.maxParticipants);
  const executives = await AIExecutiveRegistry.resolveMany(orgId, participantIds);
  const allExecs = await AIExecutiveRegistry.getAllExecutives(orgId);
  const chair = (session.chair_executive_id && (await AIExecutiveRegistry.resolve(orgId, session.chair_executive_id))) || (await AIExecutiveRegistry.resolve(orgId, allExecs.find((e) => e.role_code === "CEO")?.id ?? ""));
  if (!executives.length || !chair) {
    yield { type: "error", error: "No executives are available for this session." };
    return;
  }

  await d.sessions.update(orgId, session.id, { status: "RUNNING", started_at: session.started_at ?? nowIso(), mode });
  await audit(orgId, input.userId, "session.run", "executive_session", session.id, { mode, participants: executives.map((e) => e.role_code) });

  const existing = await d.sessionMessages.list(orgId, { where: { session_id: session.id }, orderBy: "sequence_number" });
  let seq = existing.length;
  const persist = async (m: Omit<CSuiteSessionMessage, "id" | "organization_id" | "session_id" | "sequence_number" | "created_at">) => {
    const row: CSuiteSessionMessage = { ...m, id: newId(), organization_id: orgId, session_id: session.id, sequence_number: ++seq, created_at: nowIso() };
    await d.sessionMessages.insert(row);
    return row;
  };

  await persist({ speaker_type: "USER", speaker_id: input.userId, stage: "QUESTION", content: input.userMessage, provider: null, model: null, prompt_version: null, simulated: false, metadata: {} });

  const titleOf = new Map<string, string>([...executives, chair].map((e) => [e.id, e.title]));
  const record: { speaker: string; stage: string; content: string }[] = existing
    .filter((m) => m.speaker_type !== "SYSTEM")
    .slice(-14)
    .map((m) => ({ speaker: m.speaker_type === "USER" ? "Leadership" : (titleOf.get(m.speaker_id ?? "") ?? "Executive"), stage: m.stage, content: m.content }));
  record.push({ speaker: "Leadership", stage: "QUESTION", content: input.userMessage });

  const plan = planStages(modeDef, executives, chair, input.options?.onlyExecutiveId);
  const deadline = Date.now() + SESSION_LIMITS.requestTimeoutMs * plan.length;
  let failures = 0;
  const votes: { executiveId: string; option: string; confidence: number; reason: string }[] = [];

  for (const stage of plan) {
    if (input.signal?.aborted || Date.now() > deadline) break;
    yield { type: "stage", stage: stage.def.key, label: stage.def.label };
    await persist({ speaker_type: "SYSTEM", speaker_id: null, stage: stage.def.key, content: stage.def.label, provider: null, model: null, prompt_version: null, simulated: false, metadata: {} });

    const template = await PromptRegistry.resolve(orgId, stage.def.promptKey);
    const transcript = formatTranscript(record);

    // Independent and vote stages run in parallel (bounded); review/synthesis stages are sequential by nature.
    const results = await runTurns(stage.turns, async function* (turn) {
      const exec = turn.exec;
      const task = fill(template.content, {
        objective: session.objective || input.userMessage,
        mode_label: modeDef.label,
        mode_description: modeDef.description,
        participants: executives.map((e) => e.title).join(", "),
        mandate: exec.functional_mandate,
        transcript,
        options: (input.options?.voteOptions ?? [{ id: "A", label: "Proceed" }, { id: "B", label: "Do not proceed" }]).map((o) => `- ${o.id}: ${o.label}`).join("\n"),
      });
      const built = await assembleExecutiveContext({ organization: input.organization, viewerRole: input.viewerRole, exec, query: `${session.objective} ${input.userMessage}`, fileIds: input.attachmentIds, taskInstructions: task });
      yield* runOneTurn({ exec, built, stage: stage.def.key, userMessage: input.userMessage, input, persist, templateTag: template.versionTag, taskType: STAGE_TASK[stage.def.key] });
    }, stage.parallel);

    for await (const ev of results) {
      if (ev.type === "turn_failed") failures += 1;
      if (ev.type === "turn_end") {
        const msg = await d.sessionMessages.get(orgId, ev.messageId);
        if (msg) {
          record.push({ speaker: titleOf.get(ev.executiveId) ?? "Executive", stage: stage.def.key, content: msg.content });
          if (stage.def.key === "VOTE") {
            const v = parseVote(msg.content);
            if (v) votes.push({ executiveId: ev.executiveId, ...v, reason: msg.content.slice(0, 400) });
          }
        }
      }
      yield ev;
    }
  }

  for (const v of votes) {
    await d.votes.insert({ id: newId(), organization_id: orgId, session_id: session.id, executive_id: v.executiveId, option_id: v.option, score: 0, reason: v.reason, confidence: v.confidence / 100, created_at: nowIso() });
  }

  const synthesis = [...record].reverse().find((r) => r.stage === "SYNTHESIS");
  if (synthesis) {
    const decisionId = await recordDecision(session, input, synthesis.content);
    yield { type: "decision", decisionId };
  }

  const status = failures > 0 && failures >= plan.reduce((n, s) => n + s.turns.length, 0) ? "FAILED" : "ADJOURNED";
  await d.sessions.update(orgId, session.id, { status: status === "FAILED" ? "FAILED" : "ACTIVE" });
  yield { type: "done", status };
}

async function* runOneTurn(args: {
  exec: ResolvedExecutive;
  built: Awaited<ReturnType<typeof assembleExecutiveContext>>;
  stage: string;
  userMessage: string;
  input: RunCSuiteSessionInput;
  persist: (m: Omit<CSuiteSessionMessage, "id" | "organization_id" | "session_id" | "sequence_number" | "created_at">) => Promise<CSuiteSessionMessage>;
  templateTag: string;
  taskType: TaskType;
}): AsyncGenerator<OrchestratorEvent> {
  const { exec } = args;
  yield { type: "turn_start", executiveId: exec.id, executiveTitle: exec.title, stage: args.stage };
  for (let attempt = 0; attempt <= SESSION_LIMITS.maxRetries; attempt++) {
    let text = "";
    let provider: string | null = null;
    let model: string | null = null;
    let simulated = false;
    let error: string | null = null;
    for await (const c of aiGateway.stream({
      organizationId: args.input.organization.id,
      userId: args.input.userId,
      executiveId: exec.id,
      executiveRole: exec.role_code,
      taskType: args.taskType,
      system: args.built.system,
      messages: [{ role: "user", content: args.userMessage }],
      modelPreference: { provider: exec.model.primary_provider, model: exec.model.primary_model, fallbackProvider: exec.model.fallback_provider, fallbackModel: exec.model.fallback_model, effort: exec.model.effort },
      maxTokens: Math.min(SESSION_LIMITS.maxTokensPerTurn * 2, 16000),
      promptVersion: args.templateTag,
      signal: args.input.signal,
    })) {
      if (c.type === "meta" && c.provider) {
        provider = c.provider;
        model = c.model ?? null;
        simulated = Boolean(c.simulated);
      } else if (c.type === "text" && c.text) {
        text += c.text;
        yield { type: "delta", executiveId: exec.id, text: c.text };
      } else if (c.type === "error") error = c.error ?? "Unknown error";
    }
    if (!error && text.trim()) {
      const row = await args.persist({ speaker_type: "EXECUTIVE", speaker_id: exec.id, stage: args.stage, content: text, provider: (provider as CSuiteSessionMessage["provider"]) ?? null, model, prompt_version: `${args.built.promptVersion}+${args.templateTag}`, simulated, metadata: { memory_ids: args.built.memoryIds, layers: args.built.layers } });
      yield { type: "turn_end", executiveId: exec.id, messageId: row.id, simulated, provider, model };
      return;
    }
    if (attempt === SESSION_LIMITS.maxRetries || text.trim()) {
      // Record the failure; never invent a response.
      await args.persist({ speaker_type: "SYSTEM", speaker_id: exec.id, stage: args.stage, content: `${exec.title} could not complete the analysis.`, provider: null, model: null, prompt_version: null, simulated: false, metadata: { failed: true, error } });
      yield { type: "turn_failed", executiveId: exec.id, executiveTitle: exec.title, error: error ?? "Empty response" };
      return;
    }
  }
}

/** Runs turn generators either sequentially or with bounded parallelism, merging their events. */
async function* runTurns(turns: PlannedTurn[], fn: (t: PlannedTurn) => AsyncGenerator<OrchestratorEvent>, parallel: boolean): AsyncGenerator<OrchestratorEvent> {
  if (!parallel) {
    for (const t of turns) yield* fn(t);
    return;
  }
  const queue: OrchestratorEvent[] = [];
  const waker: { fn: (() => void) | null } = { fn: null };
  let active = turns.length;
  for (const t of turns) {
    (async () => {
      try {
        for await (const ev of fn(t)) {
          queue.push(ev);
          waker.fn?.();
        }
      } catch (err) {
        queue.push({ type: "turn_failed", executiveId: t.exec.id, executiveTitle: t.exec.title, error: err instanceof Error ? err.message : "Unknown error" });
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

async function recordDecision(session: CSuiteSession, input: RunCSuiteSessionInput, synthesis: string): Promise<string> {
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
    question: input.userMessage,
    options_json: input.options?.voteOptions ?? [],
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
