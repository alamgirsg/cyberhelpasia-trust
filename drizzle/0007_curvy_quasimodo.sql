CREATE TABLE "probe_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"engagement_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"passed" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"errored" integer DEFAULT 0 NOT NULL,
	"requests_made" integer DEFAULT 0 NOT NULL,
	"summary" text,
	"results" jsonb,
	"started_by" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "engagements" ADD COLUMN "target_url" text;--> statement-breakpoint
ALTER TABLE "engagements" ADD COLUMN "target_req_field" text;--> statement-breakpoint
ALTER TABLE "engagements" ADD COLUMN "target_res_path" text;--> statement-breakpoint
ALTER TABLE "engagements" ADD COLUMN "target_auth_header" text;--> statement-breakpoint
ALTER TABLE "engagements" ADD COLUMN "target_auth_value_enc" text;--> statement-breakpoint
ALTER TABLE "engagements" ADD COLUMN "verification_token" text;--> statement-breakpoint
ALTER TABLE "engagements" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "probe_runs" ADD CONSTRAINT "probe_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probe_runs" ADD CONSTRAINT "probe_runs_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probe_runs" ADD CONSTRAINT "probe_runs_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "probe_runs_engagement_idx" ON "probe_runs" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "probe_runs_tenant_idx" ON "probe_runs" USING btree ("tenant_id");