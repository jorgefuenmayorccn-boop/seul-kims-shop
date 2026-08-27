-- Migración: Agregar tabla inventory_summary y triggers
-- Fecha: 2026-08-27
-- Propósito: Optimizar queries de disponibilidad de inventario

-- 1. Crear tabla si no existe
CREATE TABLE IF NOT EXISTS inventory_summary (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  qty_total INTEGER NOT NULL DEFAULT 0,
  qty_available INTEGER NOT NULL DEFAULT 0,
  qty_reserved INTEGER NOT NULL DEFAULT 0,
  qty_frozen INTEGER NOT NULL DEFAULT 0,
  last_movement_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Crear índices
CREATE INDEX IF NOT EXISTS idx_inventory_summary_qty_available
  ON inventory_summary(qty_available DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_summary_updated_at
  ON inventory_summary(updated_at DESC);

-- 3. Trigger: Actualizar inventory_summary cuando cambia inventory
CREATE OR REPLACE FUNCTION update_inventory_summary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inventory_summary (product_id, qty_total, qty_available, qty_frozen, last_movement_at, updated_at)
  SELECT
    p.id,
    COALESCE(SUM(i.quantity), 0) as qty_total,
    COALESCE(SUM(i.quantity), 0) as qty_available,
    COALESCE(SUM(CASE WHEN i.location IN ('freezer', 'fridge') THEN i.quantity ELSE 0 END), 0) as qty_frozen,
    NOW(),
    NOW()
  FROM products p
  LEFT JOIN inventory i ON p.id = i.product_id
  WHERE p.id = COALESCE(NEW.product_id, OLD.product_id)
  GROUP BY p.id
  ON CONFLICT (product_id) DO UPDATE SET
    qty_total = EXCLUDED.qty_total,
    qty_available = EXCLUDED.qty_available,
    qty_frozen = EXCLUDED.qty_frozen,
    last_movement_at = EXCLUDED.last_movement_at,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_inventory_update ON inventory;
CREATE TRIGGER trigger_inventory_update
AFTER INSERT OR UPDATE OR DELETE ON inventory
FOR EACH ROW
EXECUTE FUNCTION update_inventory_summary();

-- 4. Trigger: Actualizar qty_reserved basado en órdenes
CREATE OR REPLACE FUNCTION update_reserved_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar inventory_summary para todos los productos en esta orden
  UPDATE inventory_summary ism
  SET qty_reserved = (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status NOT IN ('completed', 'cancelled')
      AND oi.product_id = ism.product_id
  ),
  qty_available = (
    SELECT COALESCE(SUM(i.quantity), 0)
    FROM inventory i
    WHERE i.product_id = ism.product_id
  ) - (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status NOT IN ('completed', 'cancelled')
      AND oi.product_id = ism.product_id
  ),
  updated_at = NOW()
  WHERE ism.product_id IN (
    SELECT DISTINCT oi.product_id
    FROM order_items oi
    WHERE oi.order_id = COALESCE(NEW.id, OLD.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reserved_update ON orders;
CREATE TRIGGER trigger_reserved_update
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_reserved_inventory();

-- 5. Inicializar tabla con datos actuales
INSERT INTO inventory_summary (product_id, qty_total, qty_available, qty_reserved, qty_frozen, updated_at)
SELECT
  p.id,
  COALESCE(SUM(i.quantity), 0) as qty_total,
  COALESCE(SUM(i.quantity), 0) as qty_available,
  0 as qty_reserved,
  COALESCE(SUM(CASE WHEN i.location IN ('freezer', 'fridge') THEN i.quantity ELSE 0 END), 0) as qty_frozen,
  NOW()
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id
GROUP BY p.id
ON CONFLICT (product_id) DO NOTHING;

-- 6. Índice para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_inventory_summary_qty_gt_zero
  ON inventory_summary(product_id) WHERE qty_available > 0;
