'use client'

interface ShiftCloseGuardProps {
  onCloseTill: () => void
  onDismiss:   () => void
}

export function ShiftCloseGuard({ onCloseTill, onDismiss }: ShiftCloseGuardProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-2xl font-bold text-gray-900">No puedes cerrar el turno</span>
          <p className="text-gray-500 text-sm leading-relaxed">
            Hay una caja abierta en este terminal. Debes cerrar la caja antes de cerrar el turno.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onCloseTill}
            className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold tracking-wide hover:bg-gray-700 transition-colors"
          >
            Ir a cerrar caja
          </button>
          <button
            onClick={onDismiss}
            className="w-full bg-gray-100 text-gray-700 rounded-xl py-3 text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
