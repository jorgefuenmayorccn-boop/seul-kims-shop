'use client'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { InventoryLotModal } from './inventory-lot-modal'

export function InventoryLotButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleCreated() {
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-white bg-brand px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
      >
        <Plus size={14} /> Ingresar lote
      </button>

      {open && (
        <InventoryLotModal
          onClose={() => setOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}
