'use client'
// Adición post-entrega (2-sep-2026): apps/(b2b)/layout.tsx era un Server
// Component que SIEMPRE mostraba "Iniciar sesión"/"Solicitar cuenta", sin
// importar si había una sesión de cliente con empresa asociada — nunca
// revisaba la cookie `seul_customer_session` (httpOnly, no legible desde JS,
// así que el layout no puede resolverlo en el servidor sin reenviar la
// cookie él mismo). Extraído a un Client Component aparte (el layout se
// queda Server Component porque exporta `metadata`, que no puede coexistir
// con 'use client') que confirma la sesión contra GET /api/b2b/empresa/me
// con credentials:'include' al montar — mismo patrón exacto que
// apps/web/.../b2b/dashboard/page.tsx (S11) y .../b2b/credito/page.tsx.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { LogIn, LogOut, ShoppingBag, Building2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

const linkClass =
  'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]'

interface Empresa { razonSocial: string }

export function B2BAuthNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)

  // `pathname` en las dependencias (no solo montaje): este nav vive en
  // (b2b)/layout.tsx, que el App Router NO remonta al navegar entre rutas
  // del mismo grupo (ej. /b2b/login → /b2b/dashboard tras un login exitoso,
  // vía router.replace) — sin esto, el header se queda pegado en "Iniciar
  // sesión" después de loguearse hasta un refresh manual completo (bug real
  // encontrado con Playwright al verificar este mismo cambio).
  useEffect(() => {
    let cancelled = false
    fetch(`${API}/api/b2b/empresa/me`, { credentials: 'include' })
      .then(async res => (res.ok ? (await res.json()) as Empresa : null))
      .then(data => { if (!cancelled) setEmpresa(data) })
      .catch(() => { if (!cancelled) setEmpresa(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [pathname])

  async function handleLogout() {
    setEmpresa(null)
    try {
      await fetch(`${API}/api/customer/logout`, { method: 'POST', credentials: 'include' })
    } catch {
      // best-effort — igual limpiamos el estado local y volvemos al inicio
    }
    router.push('/')
    router.refresh()
  }

  // Mismo criterio que AuthSlot (apps/web/.../shop/auth-slot.tsx): reservar el
  // ancho mientras se confirma la sesión evita el salto visual del nav.
  if (loading) return <div className="h-9 w-56" />

  if (empresa) {
    return (
      <>
        <Link href="/b2b/dashboard" className={linkClass}>
          <Building2 className="size-4" />
          {empresa.razonSocial}
        </Link>
        <button type="button" onClick={handleLogout} className={linkClass}>
          <LogOut className="size-4" />
          Cerrar sesión
        </button>
      </>
    )
  }

  return (
    <>
      <Link href="/b2b/login" className={linkClass}>
        <LogIn className="size-4" />
        Iniciar sesión
      </Link>
      <Link
        href="/b2b/registro"
        className="flex items-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <ShoppingBag className="size-4" />
        Solicitar cuenta
      </Link>
    </>
  )
}
