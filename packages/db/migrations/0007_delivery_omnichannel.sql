-- Migration 0007: Omnichannel Delivery + Transactional Email Pipeline
-- Ejecutar con: DATABASE_URL=... npx tsx packages/db/src/migrate-0007.ts

-- Campos de entrega manual para pedidos sin cuenta registrada (WhatsApp/teléfono)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "guest_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "guest_phone" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "guest_email" text;--> statement-breakpoint

-- Bifurcación de flota en asignaciones de delivery
ALTER TABLE "delivery_assignments" ADD COLUMN IF NOT EXISTS "dispatch_type" text NOT NULL DEFAULT 'internal';--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD COLUMN IF NOT EXISTS "third_party_name" text;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD COLUMN IF NOT EXISTS "third_party_tracking" text;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD COLUMN IF NOT EXISTS "third_party_saved_at" timestamp;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD COLUMN IF NOT EXISTS "third_party_saved_by" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_third_party_saved_by_users_id_fk"
   FOREIGN KEY ("third_party_saved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Tabla de auditoría del pipeline de correos transaccionales
CREATE TABLE IF NOT EXISTS "email_queue_log" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id"        uuid NOT NULL,
  "trigger_type"    text NOT NULL,
  "status"          text NOT NULL DEFAULT 'queued',
  "attempt"         integer NOT NULL DEFAULT 1,
  "recipient_email" text,
  "resend_id"       text,
  "error_detail"    text,
  "queued_at"       timestamp DEFAULT now() NOT NULL,
  "processed_at"    timestamp
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_queue_log" ADD CONSTRAINT "email_queue_log_order_id_orders_id_fk"
   FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Índices
CREATE INDEX IF NOT EXISTS "email_queue_log_order_idx" ON "email_queue_log" ("order_id", "queued_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_assignments_dispatch_type_idx" ON "delivery_assignments" ("dispatch_type");
