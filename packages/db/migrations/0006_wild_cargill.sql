ALTER TYPE "public"."delivery_mode" ADD VALUE 'delivery';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'en_ruta' BEFORE 'entregada';--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "commune" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "address_notes" text;