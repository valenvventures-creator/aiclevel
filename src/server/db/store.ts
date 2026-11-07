import "server-only";
import { randomUUID } from "node:crypto";
import { dataMode } from "@/lib/env";
import { supabaseServer } from "./supabase";
import type * as D from "@/types/domain";

/**
 * TENANT DATA ACCESS LAYER
 *
 * Every tenant-owned table is reached through a `TenantRepo`, whose methods
 * all require the organization id. Callers obtain that id from
 * `requireContext()` (server-verified membership) — never from the browser.
 *
 *  - demo mode:     in-process memory store, seeded with "Thought Authorities Demo".
 *  - supabase mode: PostgreSQL via the user-scoped client, so RLS is enforced
 *                   *in addition to* the explicit organization_id filter.
 */

export interface ListOptions<T> {
  where?: Partial<T>;
  orderBy?: keyof T & string;
  desc?: boolean;
  limit?: number;
}

export interface TenantRepo<T extends { id: string; organization_id: string }> {
  list(orgId: string, opts?: ListOptions<T>): Promise<T[]>;
  get(orgId: string, id: string): Promise<T | null>;
  insert(row: T): Promise<T>;
  insertMany(rows: T[]): Promise<void>;
  update(orgId: string, id: string, patch: Partial<T>): Promise<T | null>;
  remove(orgId: string, id: string): Promise<boolean>;
}

/* ---------------------------- memory backend ---------------------------- */

type Row = { id: string; organization_id: string };
const g = globalThis as unknown as { __taMem?: Map<string, Map<string, Row>> };
export const memoryTables = (g.__taMem ??= new Map());

function memTable(name: string): Map<string, Row> {
  let t = memoryTables.get(name);
  if (!t) memoryTables.set(name, (t = new Map()));
  return t;
}

function matches<T>(row: T, where?: Partial<T>): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v);
}

const clone = <T>(v: T): T => structuredClone(v);

class MemoryRepo<T extends Row> implements TenantRepo<T> {
  constructor(private readonly name: string) {}
  private get t() {
    return memTable(this.name) as unknown as Map<string, T>;
  }
  async list(orgId: string, opts: ListOptions<T> = {}) {
    let rows = [...this.t.values()].filter((r) => r.organization_id === orgId && matches(r, opts.where));
    if (opts.orderBy) {
      const k = opts.orderBy;
      rows.sort((a, b) => {
        const av = a[k] as unknown as string | number;
        const bv = b[k] as unknown as string | number;
        return (av < bv ? -1 : av > bv ? 1 : 0) * (opts.desc ? -1 : 1);
      });
    }
    if (opts.limit) rows = rows.slice(0, opts.limit);
    return rows.map(clone);
  }
  async get(orgId: string, id: string) {
    const r = this.t.get(id);
    return r && r.organization_id === orgId ? clone(r) : null;
  }
  async insert(row: T) {
    this.t.set(row.id, clone(row));
    return clone(row);
  }
  async insertMany(rows: T[]) {
    for (const r of rows) this.t.set(r.id, clone(r));
  }
  async update(orgId: string, id: string, patch: Partial<T>) {
    const r = this.t.get(id);
    if (!r || r.organization_id !== orgId) return null;
    const next = { ...r, ...patch, id: r.id, organization_id: r.organization_id };
    this.t.set(id, next);
    return clone(next);
  }
  async remove(orgId: string, id: string) {
    const r = this.t.get(id);
    if (!r || r.organization_id !== orgId) return false;
    return this.t.delete(id);
  }
}

/* --------------------------- supabase backend --------------------------- */

class SupabaseRepo<T extends Row> implements TenantRepo<T> {
  constructor(private readonly table: string) {}
  async list(orgId: string, opts: ListOptions<T> = {}) {
    const sb = await supabaseServer();
    let q = sb.from(this.table).select("*").eq("organization_id", orgId);
    for (const [k, v] of Object.entries(opts.where ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v as string);
    if (opts.orderBy) q = q.order(opts.orderBy, { ascending: !opts.desc });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw new DataError(this.table, "list", error.message);
    return (data ?? []) as T[];
  }
  async get(orgId: string, id: string) {
    const sb = await supabaseServer();
    const { data, error } = await sb.from(this.table).select("*").eq("organization_id", orgId).eq("id", id).maybeSingle();
    if (error) throw new DataError(this.table, "get", error.message);
    return (data as T) ?? null;
  }
  async insert(row: T) {
    const sb = await supabaseServer();
    const { data, error } = await sb.from(this.table).insert(row).select("*").single();
    if (error) throw new DataError(this.table, "insert", error.message);
    return data as T;
  }
  async insertMany(rows: T[]) {
    if (!rows.length) return;
    const sb = await supabaseServer();
    const { error } = await sb.from(this.table).insert(rows);
    if (error) throw new DataError(this.table, "insertMany", error.message);
  }
  async update(orgId: string, id: string, patch: Partial<T>) {
    const sb = await supabaseServer();
    const { id: _i, organization_id: _o, ...safe } = patch as Row & Record<string, unknown>;
    void _i; void _o;
    const { data, error } = await sb.from(this.table).update(safe).eq("organization_id", orgId).eq("id", id).select("*").maybeSingle();
    if (error) throw new DataError(this.table, "update", error.message);
    return (data as T) ?? null;
  }
  async remove(orgId: string, id: string) {
    const sb = await supabaseServer();
    const { error, count } = await sb.from(this.table).delete({ count: "exact" }).eq("organization_id", orgId).eq("id", id);
    if (error) throw new DataError(this.table, "remove", error.message);
    return (count ?? 0) > 0;
  }
}

export class DataError extends Error {
  constructor(table: string, op: string, detail: string) {
    super(`Data error on ${table}.${op}: ${detail}`);
    this.name = "DataError";
  }
}

/* ------------------------------- registry ------------------------------- */

const TABLES = {
  members: "organization_members",
  constitutions: "organization_constitutions",
  executives: "ai_executives",
  personas: "ai_executive_personas",
  skills: "ai_executive_skills",
  modelConfigs: "ai_executive_model_configs",
  voices: "ai_executive_voices",
  promptTemplates: "prompt_templates",
  ceoIntelligence: "human_ceo_intelligence",
  conversations: "conversations",
  messages: "messages",
  communications: "communications",
  sessions: "executive_sessions",
  sessionMessages: "executive_session_messages",
  votes: "executive_session_votes",
  decisions: "decisions",
  memory: "memory_records",
  files: "files",
  reports: "reports",
  projects: "projects",
  productionJobs: "production_jobs",
  artifacts: "production_artifacts",
  invitations: "invitations",
  notifications: "notifications",
  approvals: "approval_requests",
  usage: "ai_usage_records",
  credentials: "provider_credentials",
  audit: "audit_logs",
} as const;

export interface PromptTemplateRow {
  id: string;
  organization_id: string; // "platform" for platform-wide templates
  key: string;
  executive_role: string | null;
  type: "EXECUTIVE_CORE" | "SESSION" | "REVIEW" | "STUDIO" | "MEMORY" | "PLATFORM";
  version: number;
  content: string;
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
  created_by: string | null;
  created_at: string;
  published_at: string | null;
}

export interface Database {
  members: TenantRepo<D.OrganizationMember>;
  constitutions: TenantRepo<D.OrganizationConstitution>;
  executives: TenantRepo<D.AIExecutive>;
  personas: TenantRepo<D.AIExecutivePersona>;
  skills: TenantRepo<D.AIExecutiveSkill>;
  modelConfigs: TenantRepo<D.AIExecutiveModelConfig>;
  voices: TenantRepo<D.AIExecutiveVoice>;
  promptTemplates: TenantRepo<PromptTemplateRow>;
  ceoIntelligence: TenantRepo<D.HumanCeoIntelligence>;
  conversations: TenantRepo<D.Conversation>;
  messages: TenantRepo<D.Message>;
  communications: TenantRepo<D.Communication>;
  sessions: TenantRepo<D.CSuiteSession>;
  sessionMessages: TenantRepo<D.CSuiteSessionMessage>;
  votes: TenantRepo<D.CSuiteVote>;
  decisions: TenantRepo<D.Decision>;
  memory: TenantRepo<D.MemoryRecord>;
  files: TenantRepo<D.FileRecord>;
  reports: TenantRepo<D.Report>;
  projects: TenantRepo<D.Project>;
  productionJobs: TenantRepo<D.ProductionJob>;
  artifacts: TenantRepo<D.ProductionArtifact>;
  invitations: TenantRepo<D.Invitation>;
  notifications: TenantRepo<D.Notification>;
  approvals: TenantRepo<D.ApprovalRequest>;
  usage: TenantRepo<D.UsageRecord>;
  credentials: TenantRepo<D.ProviderCredential>;
  audit: TenantRepo<D.AuditLog & { organization_id: string }>;
}

let cached: { mode: string; db: Database } | null = null;

export function db(): Database {
  const mode = dataMode();
  if (cached?.mode === mode) return cached.db;
  const make = mode === "supabase" ? (t: string) => new SupabaseRepo(t) : (t: string) => new MemoryRepo(t);
  const out = Object.fromEntries(Object.entries(TABLES).map(([k, t]) => [k, make(t)])) as unknown as Database;
  cached = { mode, db: out };
  return out;
}

export const newId = () => randomUUID();
export const nowIso = () => new Date().toISOString();
