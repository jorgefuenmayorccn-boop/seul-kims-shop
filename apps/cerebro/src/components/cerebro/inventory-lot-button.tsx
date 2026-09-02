import Link from 'next/link'
import { Plus } from 'lucide-react'

// Antes de esta sesión, este botón abría InventoryLotModal — un modal con
// selector de producto que llamaba a POST /api/inventory/lot, un endpoint
// que NUNCA existió en el backend (grep confirmado antes de tocar código:
// 0 resultados). El dueño pidió eliminar ese flujo separado y consolidar
// ingreso/ajuste de inventario dentro de Editar Producto (ver
// product-inventory.tsx) — este botón ahora navega a Productos para que el
// usuario elija el producto y agregue el lote desde su ficha, en vez de abrir
// el modal viejo. InventoryLotModal.tsx se deja sin borrar (código muerto,
// sin riesgo) pero ya no es accesible desde ningún botón visible.
export function InventoryLotButton() {
  return (
    <Link
      href="/products"
      className="flex items-center gap-2 text-sm text-white bg-brand px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
    >
      <Plus size={14} /> Agregar inventario (ir a Producto)
    </Link>
  )
}
