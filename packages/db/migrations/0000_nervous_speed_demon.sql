CREATE TYPE "public"."cold_chain" AS ENUM('ambient', 'refrigerated', 'frozen');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'inactive', 'discontinued');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('purchase', 'sale', 'adjustment', 'return', 'expired', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."delivery_mode" AS ENUM('rappi', 'metro', 'pickup', 'shipping');--> statement-breakpoint
CREATE TYPE "public"."dte_status" AS ENUM('pending', 'sending', 'issued', 'accepted_sii', 'rejected_sii', 'failed');--> statement-breakpoint
CREATE TYPE "public"."dte_type" AS ENUM('nota_venta', 'boleta', 'factura');--> statement-breakpoint
CREATE TYPE "public"."order_channel" AS ENUM('pos', 'web', 'b2b', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('nueva', 'preparando', 'lista', 'entregada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."b2b_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."b2b_tier" AS ENUM('hoobae', 'sunbae', 'hyung');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('pending', 'approved', 'rejected', 'processed');--> statement-breakpoint
CREATE TYPE "public"."return_type" AS ENUM('defective', 'wrong_item', 'changed_mind', 'other');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"emoji" text,
	"sort_order" integer DEFAULT 0,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_sellos" (
	"product_id" uuid NOT NULL,
	"sello" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"barcode" text,
	"name" text NOT NULL,
	"name_ko" text,
	"slug" text NOT NULL,
	"description" text,
	"brand" text,
	"category_id" uuid,
	"price_retail" numeric(10, 0) NOT NULL,
	"price_b2b" numeric(10, 0),
	"weight_grams" integer,
	"is_weighable" boolean DEFAULT false,
	"is_baes_eligible" boolean DEFAULT false,
	"cold_chain" "cold_chain" DEFAULT 'ambient',
	"status" "product_status" DEFAULT 'active',
	"image_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "products_barcode_unique" UNIQUE("barcode"),
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"lot" text,
	"quantity" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"cost_per_unit" numeric(10, 0),
	"location" text DEFAULT 'main',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"inventory_id" uuid,
	"type" "movement_type" NOT NULL,
	"quantity" integer NOT NULL,
	"reference_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(8, 3) NOT NULL,
	"unit_price" numeric(10, 0) NOT NULL,
	"is_baes" boolean DEFAULT false,
	"subtotal" numeric(10, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"channel" "order_channel" NOT NULL,
	"customer_id" uuid,
	"status" "order_status" DEFAULT 'nueva',
	"delivery_mode" "delivery_mode" NOT NULL,
	"delivery_address" text,
	"metro_station" text,
	"metro_slot" text,
	"subtotal" numeric(10, 0) NOT NULL,
	"baes_amount" numeric(10, 0) DEFAULT '0',
	"total" numeric(10, 0) NOT NULL,
	"dte_type" "dte_type" DEFAULT 'nota_venta' NOT NULL,
	"dte_status" "dte_status" DEFAULT 'pending' NOT NULL,
	"dte_folio" text,
	"dte_track_id" text,
	"dte_provider" text,
	"pdf_token" text,
	"pdf_url" text,
	"pdf_expires_at" timestamp,
	"receiver_rut" text,
	"receiver_name" text,
	"receiver_giro" text,
	"receiver_address" text,
	"receiver_comuna" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tienda_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"method" text NOT NULL,
	"amount" numeric(10, 0) NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "arcop_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending',
	"notes" text,
	"deadline" timestamp,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "b2b_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"razon_social" text NOT NULL,
	"rut" text NOT NULL,
	"giro" text,
	"address" text,
	"tier" "b2b_tier" DEFAULT 'hoobae',
	"status" "b2b_status" DEFAULT 'pending',
	"credit_limit_clp" integer DEFAULT 500000,
	"credit_used_clp" integer DEFAULT 0,
	"payment_days" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"approved_at" timestamp,
	CONSTRAINT "b2b_companies_rut_unique" UNIQUE("rut")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"phone" text,
	"name" text NOT NULL,
	"rut" text,
	"is_baes" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "customers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"type" "return_type" NOT NULL,
	"reason" text NOT NULL,
	"refund_amount_clp" integer,
	"resolution" text,
	"status" "return_status" DEFAULT 'pending',
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dte_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"status" text NOT NULL,
	"provider" text NOT NULL,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_sellos" ADD CONSTRAINT "product_sellos_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "arcop_requests" ADD CONSTRAINT "arcop_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "b2b_companies" ADD CONSTRAINT "b2b_companies_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "returns" ADD CONSTRAINT "returns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dte_events" ADD CONSTRAINT "dte_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dte_events_order_idx" ON "dte_events" USING btree ("order_id","created_at");