import "server-only";
import { and, eq, sql } from "drizzle-orm";

/**
 * RECORD STORE — persistence for the platform when Supabase is not configured.
 *
 *  - Netlify Database (Postgres) whenever `NETLIFY_DB_URL` is available, so every
 *    serverless instance shares the same users, sessions, organizations and
 *    tenant data. This is what makes sign-up, log-in and the demo organization
 *    survive across requests on Netlify.
 *  - An in-process Map only when no database is reachable (unit tests, offline
 *    local development). Set `TA_STORE=memory` to force it.
 *
 * Rows are JSON documents grouped by `collection`. Tenant isolation is still
 * enforced by callers (`TenantRepo` methods always filter on organization id).
 */

export type StoredRow = Record<string, unknown> & { id: string };

export interface FindOptions {
  organizationId?: string;
  lookupKey?: string;
  /** Exact-match filter on top-level fields. */
  where?: Record<string, unknown>;
}

export interface PutMeta {
  organizationId: string;
  lookupKey?: string | null;
}

export interface RecordStore {
  readonly kind: "postgres" | "memory";
  get<T extends StoredRow>(collection: string, id: string): Promise<T | null>;
  find<T extends StoredRow>(collection: string, opts?: FindOptions): Promise<T[]>;
  put(collection: string, row: StoredRow, meta: PutMeta): Promise<void>;
  putMany(collection: string, rows: { row: StoredRow; meta: PutMeta }[]): Promise<void>;
  /** Inserts only if no row with this id exists. Returns true when inserted. */
  insertIfAbsent(collection: string, row: StoredRow, meta: PutMeta): Promise<boolean>;
  remove(collection: string, id: string): Promise<boolean>;
}

const clone = <T>(v: T): T => structuredClone(v);

function matches(row: Record<string, unknown>, where?: Record<string, unknown>) {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => row[k] === v);
}

/* ------------------------------ memory store ------------------------------ */

interface MemEntry { row: StoredRow; organizationId: string; lookupKey: string | null }
const g = globalThis as unknown as { __taRecords?: Map<string, Map<string, MemEntry>> };

class MemoryRecordStore implements RecordStore {
  readonly kind = "memory" as const;
  private get tables() {
    return (g.__taRecords ??= new Map());
  }
  private table(name: string) {
    let t = this.tables.get(name);
    if (!t) this.tables.set(name, (t = new Map()));
    return t;
  }
  async get<T extends StoredRow>(collection: string, id: string) {
    const e = this.table(collection).get(id);
    return e ? (clone(e.row) as T) : null;
  }
  async find<T extends StoredRow>(collection: string, opts: FindOptions = {}) {
    const out: T[] = [];
    for (const e of this.table(collection).values()) {
      if (opts.organizationId !== undefined && e.organizationId !== opts.organizationId) continue;
      if (opts.lookupKey !== undefined && e.lookupKey !== opts.lookupKey) continue;
      if (!matches(e.row, opts.where)) continue;
      out.push(clone(e.row) as T);
    }
    return out;
  }
  async put(collection: string, row: StoredRow, meta: PutMeta) {
    this.table(collection).set(row.id, { row: clone(row), organizationId: meta.organizationId, lookupKey: meta.lookupKey ?? null });
  }
  async putMany(collection: string, rows: { row: StoredRow; meta: PutMeta }[]) {
    for (const r of rows) await this.put(collection, r.row, r.meta);
  }
  async insertIfAbsent(collection: string, row: StoredRow, meta: PutMeta) {
    const t = this.table(collection);
    if (t.has(row.id)) return false;
    if (meta.lookupKey != null && [...t.values()].some((e) => e.lookupKey === meta.lookupKey)) return false;
    await this.put(collection, row, meta);
    return true;
  }
  async remove(collection: string, id: string) {
    return this.table(collection).delete(id);
  }
}

/* ----------------------------- postgres store ----------------------------- */

type DrizzleDb = (typeof import("../../../db/index"))["database"];
type Schema = typeof import("../../../db/schema");

class PostgresRecordStore implements RecordStore {
  readonly kind = "postgres" as const;
  private conn: Promise<{ database: DrizzleDb; schema: Schema }> | null = null;

  private load() {
    return (this.conn ??= Promise.all([import("../../../db/index"), import("../../../db/schema")]).then(([i, s]) => ({ database: i.database, schema: s })));
  }

  async get<T extends StoredRow>(collection: string, id: string) {
    const { database, schema } = await this.load();
    const t = schema.appRecords;
    const rows = await database.select({ data: t.data }).from(t).where(and(eq(t.collection, collection), eq(t.id, id))).limit(1);
    return (rows[0]?.data as T | undefined) ?? null;
  }

  async find<T extends StoredRow>(collection: string, opts: FindOptions = {}) {
    const { database, schema } = await this.load();
    const t = schema.appRecords;
    const conds = [eq(t.collection, collection)];
    if (opts.organizationId !== undefined) conds.push(eq(t.organizationId, opts.organizationId));
    if (opts.lookupKey !== undefined) conds.push(eq(t.lookupKey, opts.lookupKey));
    if (opts.where && Object.keys(opts.where).length) conds.push(sql`${t.data} @> ${JSON.stringify(opts.where)}::jsonb`);
    const rows = await database.select({ data: t.data }).from(t).where(and(...conds));
    // Containment treats a missing key and `null` differently from strict equality; re-check in JS.
    return rows.map((r) => r.data as T).filter((r) => matches(r, opts.where));
  }

  async put(collection: string, row: StoredRow, meta: PutMeta) {
    await this.putMany(collection, [{ row, meta }]);
  }

  async putMany(collection: string, rows: { row: StoredRow; meta: PutMeta }[]) {
    if (!rows.length) return;
    const { database, schema } = await this.load();
    const t = schema.appRecords;
    const values = rows.map(({ row, meta }) => ({ collection, id: row.id, organizationId: meta.organizationId, lookupKey: meta.lookupKey ?? null, data: row, updatedAt: new Date() }));
    for (let i = 0; i < values.length; i += 200) {
      await database
        .insert(t)
        .values(values.slice(i, i + 200))
        .onConflictDoUpdate({
          target: [t.collection, t.id],
          set: { organizationId: sql`excluded.organization_id`, lookupKey: sql`excluded.lookup_key`, data: sql`excluded.data`, updatedAt: sql`excluded.updated_at` },
        });
    }
  }

  async insertIfAbsent(collection: string, row: StoredRow, meta: PutMeta) {
    const { database, schema } = await this.load();
    const t = schema.appRecords;
    const inserted = await database
      .insert(t)
      .values({ collection, id: row.id, organizationId: meta.organizationId, lookupKey: meta.lookupKey ?? null, data: row })
      .onConflictDoNothing()
      .returning({ id: t.id });
    return inserted.length > 0;
  }

  async remove(collection: string, id: string) {
    const { database, schema } = await this.load();
    const t = schema.appRecords;
    const deleted = await database.delete(t).where(and(eq(t.collection, collection), eq(t.id, id))).returning({ id: t.id });
    return deleted.length > 0;
  }
}

/* -------------------------------- selection ------------------------------- */

let store: RecordStore | null = null;

export function hasPersistentStore(): boolean {
  return process.env.TA_STORE !== "memory" && Boolean(process.env.NETLIFY_DB_URL);
}

export function records(): RecordStore {
  return (store ??= hasPersistentStore() ? new PostgresRecordStore() : new MemoryRecordStore());
}

/** Sort + limit helper shared by repositories (ordering happens in-process). */
export function sortAndLimit<T>(rows: T[], orderBy?: string, desc?: boolean, limit?: number): T[] {
  let out = rows;
  if (orderBy) {
    out = [...rows].sort((a, b) => {
      const av = (a as Record<string, unknown>)[orderBy] as string | number;
      const bv = (b as Record<string, unknown>)[orderBy] as string | number;
      return (av < bv ? -1 : av > bv ? 1 : 0) * (desc ? -1 : 1);
    });
  }
  return limit ? out.slice(0, limit) : out;
}
