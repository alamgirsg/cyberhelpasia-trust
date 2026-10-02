ALTER TABLE "policies" ADD COLUMN "file_key" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "file_sha256" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "file_size" integer;