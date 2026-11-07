import { index, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Persistent store for the platform when Supabase is not configured
 * (Netlify Database). Every logical table of the in-process data model
 * (identity, organizations and all tenant tables) is stored as JSON
 * documents in a single collection-keyed table, so serverless instances
 * share one consistent state.
 *
 *  - collection:      logical table name (e.g. "organization_members", "users")
 *  - id:              row id (unique within its collection)
 *  - organization_id: tenant id for tenant tables; "global" for identity rows
 *  - lookup_key:      optional unique secondary lookup (user email, organization slug)
 */
export const appRecords = pgTable(
  "app_records",
  {
    collection: text("collection").notNull(),
    id: text("id").notNull(),
    organizationId: text("organization_id").notNull(),
    lookupKey: text("lookup_key"),
    data: jsonb("data").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.collection, t.id] }),
    index("app_records_org_idx").on(t.collection, t.organizationId),
    // Unique per collection (emails, organization slugs). NULLs never collide.
    uniqueIndex("app_records_lookup_idx").on(t.collection, t.lookupKey),
  ],
);
