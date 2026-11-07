CREATE TABLE "app_records" (
	"collection" text,
	"id" text,
	"organization_id" text NOT NULL,
	"lookup_key" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_records_pkey" PRIMARY KEY("collection","id")
);
--> statement-breakpoint
CREATE INDEX "app_records_org_idx" ON "app_records" ("collection","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_records_lookup_idx" ON "app_records" ("collection","lookup_key");