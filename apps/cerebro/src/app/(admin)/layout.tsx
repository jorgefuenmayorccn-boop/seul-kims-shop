import { Sidebar } from '@/components/layout/sidebar'
import { requireSession } from '@/lib/session'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession(['owner', 'admin', 'staff'])

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
