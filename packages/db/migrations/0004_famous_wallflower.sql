CREATE TYPE "public"."till_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "till_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_number" serial NOT NULL,
	"shift_id" uuid NOT NULL,
	"opened_by" uuid NOT NULL,
	"device_id" text NOT NULL,
	"opening_float" integer NOT NULL,
	"status" "till_status" DEFAULT 'open' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"closing_summary" jsonb
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "till_session_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "till_sessions_device_active_uniq" ON "till_sessions" USING btree ("device_id") WHERE "till_sessions"."status" = 'open';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_till_session_id_till_sessions_id_fk" FOREIGN KEY ("till_session_id") REFERENCES "public"."till_sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
