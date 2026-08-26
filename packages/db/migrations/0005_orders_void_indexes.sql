-- Migration 0005: cashier tracking, void columns, analytics indexes
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cashier_id" uuid REFERENCES "users"("id");
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "voided_by" uuid REFERENCES "users"("id");
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "voided_at" timestamp;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "void_reason" text;

CREATE INDEX IF NOT EXISTS "idx_orders_date"    ON "orders" (DATE("created_at"));
CREATE INDEX IF NOT EXISTS "idx_orders_cashier" ON "orders" ("cashier_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_orders_shift"   ON "orders" ("shift_id", "created_at" DESC);
