CREATE TABLE "ai_systems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"business_owner" text,
	"vendor" text,
	"model" text,
	"status" text DEFAULT 'proposed' NOT NULL,
	"factors" jsonb NOT NULL,
	"computed_rating" text NOT NULL,
	"override_rating" text,
	"override_reason" text,
	"last_reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "frameworks" ADD COLUMN "ref_label" text DEFAULT 'ISO/IEC 27001:2022 (indicative)' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_systems" ADD CONSTRAINT "ai_systems_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_systems" ADD CONSTRAINT "ai_systems_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_systems_tenant_idx" ON "ai_systems" USING btree ("tenant_id");