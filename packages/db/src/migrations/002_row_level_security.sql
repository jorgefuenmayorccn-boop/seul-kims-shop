-- Migración: Row-Level Security (RLS) para multi-tienda
-- Fecha: 2026-08-27
-- Propósito: Garantizar aislamiento de datos entre tiendas

-- NOTA: Este es el plan de RLS. Implementación completa en PASO 5.2

-- 1. Agregar columna tenant_id a tablas críticas
ALTER TABLE users ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'default-tenant';
ALTER TABLE orders ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'default-tenant';
ALTER TABLE customers ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'default-tenant';
ALTER TABLE inventory ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'default-tenant';
ALTER TABLE products ADD COLUMN tenant_id UUID NOT NULL DEFAULT 'default-tenant';

-- 2. Crear tabla de tenants
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Habilitar RLS en tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 4. Crear política para users: cada usuario ve solo su tenant
CREATE POLICY users_tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 5. Crear política para orders
CREATE POLICY orders_tenant_isolation ON orders
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 6. Crear política para customers
CREATE POLICY customers_tenant_isolation ON customers
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 7. Crear política para inventory
CREATE POLICY inventory_tenant_isolation ON inventory
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 8. Crear política para products
CREATE POLICY products_tenant_isolation ON products
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 9. Función para establecer tenant_id desde JWT
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
  SELECT current_setting('app.current_tenant_id')::uuid
$$ LANGUAGE SQL STABLE;

-- 10. Insertar tenant por defecto
INSERT INTO tenants (id, name, slug) VALUES
  ('default-tenant', 'Seoul Kims - Viña del Mar', 'seoul-kims-vina')
ON CONFLICT DO NOTHING;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);

/*
IMPLEMENTACIÓN EN API (pseudo-código):

Antes de cada query en API Worker:

  const userId = jwt.decode(token).userId
  const tenantId = await db.select().from(users)
    .where(eq(users.id, userId))
    .then(u => u[0].tenantId)

  db.client.query('SET app.current_tenant_id TO $1', [tenantId])

  // Ahora todas las queries usan RLS automáticamente

Ventaja: Si un admin hackea otro usuario, no puede ver datos de otra tienda
         porque PostgreSQL filtra automáticamente.
*/
