CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'assigned', 'accepted', 'in_transit', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_at_door" AS ENUM('not_required', 'pending', 'collected', 'refused');--> statement-breakpoint
CREATE TYPE "public"."loyalty_ledger_type" AS ENUM('earn', 'redeem', 'adjust', 'expire');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"driver_id" uuid,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"payment_at_door" "payment_at_door" DEFAULT 'not_required' NOT NULL,
	"amount_to_collect" integer DEFAULT 0,
	"payment_method" text,
	"route_index" integer,
	"notes" text,
	"assigned_at" timestamp,
	"accepted_at" timestamp,
	"picked_up_at" timestamp,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_location_pings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"assignment_id" uuid,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"accuracy" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_pods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"recipient_name" text,
	"recipient_rut" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"signature_r2_key" text,
	"captured_at" timestamp DEFAULT now(),
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_id" uuid,
	"type" "loyalty_ledger_type" NOT NULL,
	"points" integer NOT NULL,
	"reason" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pos_void_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"voided_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"amount_clp" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "cost_price" numeric(10, 0);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "price_web" numeric(10, 0);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "price_pos" numeric(10, 0);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount_web_pct" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount_pos_pct" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount_b2b_pct" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cashier_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "voided_by" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "voided_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "document_type" text DEFAULT 'rut';--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "document_number" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "created_channel" text DEFAULT 'web';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_location_pings" ADD CONSTRAINT "delivery_location_pings_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_location_pings" ADD CONSTRAINT "delivery_location_pings_assignment_id_delivery_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."delivery_assignments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_pods" ADD CONSTRAINT "delivery_pods_assignment_id_delivery_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."delivery_assignments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pos_void_events" ADD CONSTRAINT "pos_void_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pos_void_events" ADD CONSTRAINT "pos_void_events_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
