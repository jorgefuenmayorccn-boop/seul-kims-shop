import { Sidebar } from '@/components/layout/sidebar'
import { requireSession } from '@/lib/session'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 'manager' agregado (Gerente de local, pedido del dueño, 3-sep-2026,
  // Fase 2 multilocal) — si no está acá, un manager ni siquiera podría
  // entrar al panel.
  const user = await requireSession(['owner', 'admin', 'manager', 'staff'])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={user} />
      {/* pt-14 compensa la barra superior mobile (fixed) del Sidebar —
          desde `md` esa barra no existe, así que el padding se anula. */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
