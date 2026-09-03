'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ProductTile } from '@seul/ui/pos/product-tile'
import { CartLine } from '@seul/ui/pos/cart-line'
import { ColdChainAlert } from '@seul/ui/pos/cold-chain-alert'
import { EmptyState, formatCLP } from '@seul/ui'
import { CheckoutShell } from '@/components/pos/checkout/checkout-shell'
import { TopBar } from '@/components/pos/top-bar'
import { CategoryRail } from '@/components/pos/category-rail'
import { ShortcutHints } from '@/components/pos/shortcut-hints'
import { ShiftGate } from '@/components/pos/shift-gate'
import { TillGate } from '@/components/pos/till-gate'
import { TillZReportModal } from '@/components/pos/till-z-report-modal'
import { MasterShiftZReportModal } from '@/components/pos/master-shift-z-report-modal'
import { ShiftCloseGuard } from '@/components/pos/shift-close-guard'
import { IncomingOrdersDrawer } from '@/components/pos/incoming-orders-drawer'
import { ComandasView } from '@/components/pos/comandas-view'
import { DeliveryOrderModal } from '@/components/pos/delivery/delivery-order-modal'
import { B2BCompanyModal } from '@/components/pos/b2b/b2b-company-modal'
import { AssignDriverModal, type PendingAssign } from '@/components/pos/delivery/assign-driver-modal'
import { PostTillOptions } from '@/components/pos/post-till-options'
import { VoidAuthModal } from '@/components/pos/void-auth-modal'
import { SalesHistoryPanel } from '@/components/pos/sales-history-panel'
import { useOrderEventsConnection, useUnreadCount } from '@/lib/order-events'
import { usePOSStore, type POSProduct } from '@/lib/pos-store'
import { useBarcodeScanner } from '@/lib/barcode-scanner'
import { useKeyboardShortcuts } from '@/lib/keyboard-shortcuts'
import { useTheme } from '@/lib/theme-store'
import { haptics } from '@/lib/haptics'
import { IconSearch, IconCart, IconClose } from '@/components/icons/pos-icons'
import { detectPrintMode, reprintLast, printComanda } from '@/lib/print-service'
import { fetchCurrentUser, logoutUser as logoutUserFn, useAuthStore } from '@/lib/auth-store'
import { fetchActiveShift, setActiveShift, useShiftStore, getActiveShift } from '@/lib/shift-store'
import { fetchActiveTillSession, setActiveTillSession, useTillSessionStore, getActiveTillSession } from '@/lib/till-session-store'
import { getDeviceId } from '@/lib/device'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

export default function POSPage() {
  const store = usePOSStore()
  const { isDark, toggleTheme } = useTheme()
  const { user } = useAuthStore()
  const { shift } = useShiftStore()
  const { tillSession } = useTillSessionStore()

  const [products,     setProducts]     = useState<POSProduct[]>([])
  const [loading,      setLoading]      = useState(true)
  const [query,        setQuery]        = useState('')
  const [category,     setCategory]     = useState<string | null>(null)
  const [scannerReady, setScannerReady] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [printerMode,  setPrinterMode]  = useState<'agent' | 'fallback' | 'unavailable'>('fallback')
  const [printerName,  setPrinterName]  = useState('')
  const [deviceId,     setDeviceId]     = useState('')
  const [booting,           setBooting]           = useState(true)
  const [shiftReady,        setShiftReady]        = useState(false)
  const [tillReady,         setTillReady]         = useState(false)
  const [showTillZReport,   setShowTillZReport]   = useState(false)
  const [showShiftZReport,  setShowShiftZReport]  = useState(false)
  const [shiftGuarded,      setShiftGuarded]      = useState(false)
  const [showIncoming,       setShowIncoming]       = useState(false)
  const [showComandas,       setShowComandas]       = useState(false)
  const [showPostTillOpts,   setShowPostTillOpts]   = useState(false)
  const [showSalesHistory,   setShowSalesHistory]   = useState(false)
  const [showDeliveryModal,  setShowDeliveryModal]  = useState(false)
  const [showB2BModal,       setShowB2BModal]       = useState(false)
  const [closedTillId,       setClosedTillId]       = useState<string | null>(null)
  const [totalSold,          setTotalSold]          = useState(0)
  const [ticketCount,        setTicketCount]        = useState(0)
  const [voidTarget, setVoidTarget] = useState<{
    orderId: string; number: number; total: number
    items: Array<{ name: string; qty: number }>
  } | null>(null)
  const [pendingAssign, setPendingAssign] = useState<PendingAssign | null>(null)

  // Realtime — SSE para pedidos web entrantes (solo cuando la caja está operativa)
  useOrderEventsConnection(tillReady ? API : '', tillReady ? deviceId : '')
  const unreadCount = useUnreadCount()

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Boot: cargar user + shift activo al montar
  useEffect(() => {
    const device = getDeviceId()
    setDeviceId(device)

    async function boot() {
      const u = await fetchCurrentUser(API)
      if (!u) { window.location.href = '/login'; return }
      const activeShift = await fetchActiveShift(API, device)
      if (activeShift) {
        setShiftReady(true)
        const activeTill = await fetchActiveTillSession(API, device)
        setTillReady(!!activeTill)
      }
      setBooting(false)
    }

    detectPrintMode().then(({ mode, printerName }) => {
      setPrinterMode(mode)
      setPrinterName(printerName)
    })

    boot()
  }, [])

  // Asignar ref del search al store para F1
  useEffect(() => {
    store.searchRef.current = searchInputRef.current
  })

  // Cargar productos — AbortController cancela fetches superpuestos al escribir rápido
  useEffect(() => {
    if (!tillReady) return
    const controller = new AbortController()
    const params = new URLSearchParams({ status: 'active' })
    if (query)    params.set('q', query)
    if (category) params.set('category', category)

    setLoading(true)
    fetch(`${API}/api/products?${params}`, { credentials: 'include', signal: controller.signal })
      .then(r => r.json() as Promise<{ products: POSProduct[] }>)
      .then(d => setProducts((d.products ?? []).map(p => ({
        ...p,
        priceRetail: Number(p.priceRetail),
        stockTotal:  Number(p.stockTotal ?? 0),
      }))))
      .catch(err => { if (err.name !== 'AbortError') setProducts([]) })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [query, category, tillReady])

  // Scanner de código de barras
  const handleScan = useCallback(async (code: string) => {
    setScannerReady(true)

    const local = products.find(p => p.barcode === code || p.sku === code)
    if (local) {
      store.addProduct(local)
      haptics.add()
      return
    }

    try {
      const res = await fetch(`${API}/api/products/barcode/${encodeURIComponent(code)}`, {
        credentials: 'include',
      })
      if (!res.ok) return
      const data = await res.json() as { product: POSProduct }
      if (data.product) {
        store.addProduct({
          ...data.product,
          priceRetail: Number(data.product.priceRetail),
          stockTotal:  Number(data.product.stockTotal ?? 0),
        })
        haptics.add()
      }
    } catch { /* producto no encontrado */ }
  }, [products, store])

  useBarcodeScanner(handleScan)

  useKeyboardShortcuts({
    onFocusSearch:  store.focusSearch,
    onClearCart:    () => {
      if (!store.cart.length) return
      if (clearConfirm) {
        store.clearCart()
        setClearConfirm(false)
        haptics.remove()
      } else {
        setClearConfirm(true)
        setTimeout(() => setClearConfirm(false), 3000)
      }
    },
    onOpenCheckout: () => store.cart.length > 0 && store.setCheckoutOpen(true),
    onCloseModal:   () => {
      store.setCheckoutOpen(false)
      setClearConfirm(false)
    },
    onToggleTheme:  toggleTheme,
    onReprintLast:  () => { reprintLast() },
    onCartUp:       store.cartUp,
    onCartDown:     store.cartDown,
    onCartIncrease: store.increaseSelected,
    onCartDecrease: store.decreaseSelected,
  })

  async function handleConfirm(
    tenders:   import('@/lib/payment-methods').Tender[],
    dteType:   'nota_venta' | 'boleta' | 'factura',
    receiver?: { rut: string; razonSocial: string; giro: string; direccion: string; comuna: string },
  ) {
    // Leer del módulo en el momento de ejecución — nunca de la closure
    const currentShift = getActiveShift()
    const currentTill  = getActiveTillSession()
    if (!currentShift?.id) throw new Error('No hay turno activo. Recarga el POS.')
    if (!currentTill?.id)  throw new Error('No hay caja activa. Recarga el POS.')

    const delivery = store.deliveryOrder
    const allTenders = delivery?.paymentAtDoor
      ? [...tenders, { method: 'cod', amount: store.total }]
      : tenders

    const res = await fetch(`${API}/api/orders`, {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        channel:         'pos',
        deliveryMode:    delivery?.deliveryMode ?? 'pickup',
        dteType,
        shiftId:         currentShift.id,
        tillSessionId:   currentTill.id,
        customerId:      delivery?.customerId ?? undefined,
        deliveryAddress: delivery?.deliveryAddress ?? undefined,
        comuna:          delivery?.comuna ?? undefined,
        guestName:       delivery?.guestName ?? undefined,
        guestPhone:      delivery?.guestPhone ?? undefined,
        guestEmail:      delivery?.guestEmail ?? undefined,
        // Venta B2B presencial (adición post-entrega) — companyId opcional,
        // solo viaja cuando el cajero seleccionó una empresa con el toggle
        // "B2B" del TopBar. El backend (POST /api/orders) valida la empresa,
        // guarda company_id en la orden y autocompleta el receptor (RUT/
        // razón social) si no se llenó a mano.
        companyId:       store.b2bCompany?.id ?? undefined,
        payments:  allTenders.map(t => ({ method: t.method, amount: t.amount })),
        receiver,
        items: store.cart.map(i => ({
          productId: i.id,
          quantity:  Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          isBaes:    store.baesSession ? i.isBaes : false,
        })),
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>
      const msg = typeof body.error === 'string'
        ? body.error
        : typeof body.detail === 'string'
          ? body.detail
          : `Error ${res.status} al crear pedido`
      throw new Error(msg)
    }
    const data = await res.json() as { orderId: string; number: number; total: number; dteStatus?: string; assignmentId?: string }
    haptics.confirm()

    // Actualizar stats del turno
    setTicketCount(prev => prev + 1)
    setTotalSold(prev => prev + (data.total ?? 0))

    // Delivery: imprimir comanda de cocina + preparar asignación de repartidor
    if (delivery && data.assignmentId) {
      printComanda({
        orderId:      data.orderId,
        number:       data.number,
        channel:      'pos',
        createdAt:    new Date().toISOString(),
        deliveryMode: delivery.deliveryMode === 'rappi' ? 'rappi' : 'shipping',
        items:        store.cart.map(i => ({ name: i.name, qty: Number(i.quantity) })),
        cashierName:  user?.name ?? undefined,
      })
      setPendingAssign({
        orderId:       data.orderId,
        assignmentId:  data.assignmentId,
        number:        data.number,
        total:         data.total,
        deliveryMode:  delivery.deliveryMode,
        paymentAtDoor: delivery.paymentAtDoor,
        customerName:  delivery.guestName ?? '',
        address:       delivery.deliveryAddress ?? '',
      })
    }

    store.clearCart()
    return { orderId: data.orderId, number: data.number, dteStatus: data.dteStatus }
  }

  function handleShiftOpen(openedShift: import('@/lib/shift-store').ActiveShift) {
    setActiveShift(openedShift)
    setShiftReady(true)
    // Till will be opened next — don't set tillReady yet
  }

  function handleTillOpen(openedTill: import('@/lib/till-session-store').ActiveTillSession) {
    setActiveTillSession(openedTill)
    setTillReady(true)
    setTotalSold(0)
    setTicketCount(0)
  }

  function handleCloseTill() {
    setShowTillZReport(true)
  }

  function handleTillClosed() {
    const id = tillSession?.id ?? null
    setActiveTillSession(null)
    setTillReady(false)
    setShowTillZReport(false)
    setClosedTillId(id)
    setShowPostTillOpts(true)
  }

  function handleCloseShift() {
    if (tillReady) {
      setShiftGuarded(true)
    } else {
      setShowShiftZReport(true)
    }
  }

  function handleLogoutAfterShiftClose() {
    setActiveShift(null)
    setActiveTillSession(null)
    setShiftReady(false)
    setTillReady(false)
    setShowShiftZReport(false)
    logoutUserFn(API)
  }

  // Pantalla de carga boot
  if (booting) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: 'var(--color-background)' }}
      >
        <div className="text-center">
          <p className="font-korean font-black text-4xl mb-2" style={{ color: 'var(--color-brand)' }}>
            서울킴스
          </p>
          <p className="font-body text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Cargando sistema…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: 'var(--color-background)' }}
    >
      {/* TopBar */}
      <TopBar
        cashierName={user?.name ?? 'Cajera'}
        tillOpenerName={tillSession?.openedByName ?? undefined}
        shiftNumber={shift?.shiftNumber}
        tillSessionNumber={tillSession?.sessionNumber}
        totalSold={totalSold}
        ticketCount={ticketCount}
        isDark={isDark}
        scannerReady={scannerReady}
        printerMode={printerMode}
        printerName={printerName}
        incomingOrderCount={unreadCount}
        onToggleTheme={toggleTheme}
        onReprintLast={() => reprintLast()}
        onCloseTill={tillReady ? handleCloseTill : undefined}
        onCloseShift={shiftReady ? handleCloseShift : undefined}
        onOpenIncoming={() => setShowIncoming(true)}
        onOpenComandas={() => setShowComandas(true)}
        onOpenHistory={tillSession || closedTillId ? () => setShowSalesHistory(true) : undefined}
        onLogout={() => logoutUserFn(API)}
        onOpenB2B={() => setShowB2BModal(true)}
        b2bCompanyName={store.b2bCompany?.razonSocial}
        onClearB2B={() => store.setB2BCompany(null)}
      />

      {/* Body — 3 columnas */}
      <div className="flex flex-1 overflow-hidden">

        {/* Columna 1 — Categorías */}
        <CategoryRail
          active={category}
          onSelect={setCategory}
          totalSold={totalSold}
          ticketCount={ticketCount}
          tillReady={tillReady}
          onCloseTill={tillReady ? handleCloseTill : undefined}
          onCloseShift={shiftReady ? handleCloseShift : undefined}
        />

        {/* Columna 2 — Catálogo */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div
            className="px-4 py-3 border-b shrink-0"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-elevated)' }}
          >
            <div className="relative">
              <IconSearch
                size={16}
                color="var(--color-text-muted)"
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar producto o SKU… (F1)"
                className="w-full pl-9 pr-9 py-2.5 rounded text-sm font-body focus:outline-none"
                style={{
                  background: 'var(--color-surface)',
                  border:     '1px solid var(--color-border)',
                  color:      'var(--color-text)',
                }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  aria-label="Limpiar búsqueda"
                >
                  <IconClose size={14} color="var(--color-text-muted)" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg animate-pulse"
                    style={{ minHeight: 'var(--pos-hit-area-min)', background: 'var(--color-surface)' }}
                  />
                ))}
              </div>
            ) : products.length === 0 ? (
              <EmptyState variant="no-results" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {products.map(p => (
                  <ProductTile
                    key={p.id}
                    product={{
                      ...p,
                      stockTotal:  Number(p.stockTotal ?? 0),
                      priceRetail: Number(p.priceRetail),
                    }}
                    onAdd={(id) => {
                      const product = products.find(pr => pr.id === id)
                      if (!product) return
                      store.addProduct(product)
                      haptics.add()
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Columna 3 — Carrito */}
        <aside
          className="flex flex-col border-l shrink-0"
          style={{
            width:       'var(--pos-cart-width)',
            minWidth:    260,
            maxWidth:    360,
            borderColor: 'var(--color-border)',
            background:  'var(--color-surface-elevated)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center gap-2">
              <IconCart size={16} color="var(--color-text-muted)" />
              <span className="font-body text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                Carrito
              </span>
              {store.itemCount > 0 && (
                <span
                  className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--color-brand)', color: '#fff' }}
                >
                  {store.itemCount}
                </span>
              )}
            </div>
            {store.cart.length > 0 && (
              <button
                onClick={() => {
                  if (clearConfirm) {
                    store.clearCart()
                    setClearConfirm(false)
                  } else {
                    setClearConfirm(true)
                    setTimeout(() => setClearConfirm(false), 3000)
                  }
                }}
                className="font-body text-xs px-2 py-1 rounded transition-colors"
                style={{
                  color:      clearConfirm ? 'var(--color-error)' : 'var(--color-text-muted)',
                  background: clearConfirm ? 'var(--color-error-subtle)' : 'transparent',
                }}
              >
                {clearConfirm ? 'Confirmar (F2)' : 'Vaciar'}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {store.cart.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-full gap-3 p-6"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <IconCart size={32} color="var(--color-text-disabled)" />
                <p className="text-sm font-body text-center">
                  Agrega productos del catálogo o escanea un código de barras
                </p>
                <p className="font-korean text-xs" style={{ opacity: 0.5 }}>빈 카트</p>
              </div>
            ) : (
              store.cart.map((item, i) => (
                <div
                  key={item.id}
                  style={{
                    background: i === store.selectedCartIndex
                      ? 'var(--color-brand-subtle)'
                      : 'transparent',
                  }}
                  onClick={() => store.setSelectedCartIndex(i)}
                >
                  <CartLine
                    item={item}
                    baesActive={!!store.baesSession}
                    onRemove={(id) => { store.removeProduct(id); haptics.remove() }}
                    onQuantityChange={store.updateQuantity}
                  />
                </div>
              ))
            )}
          </div>

          {store.hasColdChain && (
            <div className="px-3 pb-2">
              <ColdChainAlert hasFrozen={store.hasFrozen} hasRefrigerated={store.hasRefrigerated} />
            </div>
          )}

          {store.cart.length > 0 && (
            <div
              className="border-t px-4 pt-3 pb-2 space-y-1.5 shrink-0"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex justify-between text-sm font-body">
                <span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span>
                <span className="font-mono" style={{ color: 'var(--color-text)' }}>
                  {formatCLP(store.subtotal)}
                </span>
              </div>
              {store.baesAmount > 0 && (
                <div className="flex justify-between text-sm font-body">
                  <span style={{ color: 'var(--color-baes-applied-text)', fontWeight: 600 }}>
                    BAES (−)
                  </span>
                  <span className="font-mono font-semibold" style={{ color: 'var(--color-baes-applied-text)' }}>
                    {formatCLP(store.baesAmount)}
                  </span>
                </div>
              )}
              <div
                className="flex justify-between items-baseline pt-1.5 border-t"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span className="font-headline font-bold" style={{ color: 'var(--color-text)' }}>
                  Total
                </span>
                <span className="font-mono font-black text-2xl" style={{ color: 'var(--color-text)' }}>
                  {formatCLP(store.total)}
                </span>
              </div>
            </div>
          )}

          <div className="px-4 pb-3 pt-2 shrink-0 space-y-2">
            {/* Indicador venta B2B — visible en el carrito para que el
                cajero no pierda de vista que está cobrando precios
                mayoristas (adición post-entrega). */}
            {store.b2bCompany && (
              <div
                className="flex items-center justify-between px-3 py-2 rounded text-xs font-body"
                style={{ background: 'var(--color-warning-subtle, #fef3c7)', border: '1px solid var(--color-warning, #d97706)', color: 'var(--color-warning, #92400e)' }}
              >
                <span className="font-semibold">
                  Venta B2B · {store.b2bCompany.razonSocial} · precios mayoristas
                </span>
                <button
                  onClick={() => store.setB2BCompany(null)}
                  className="hover:opacity-70 transition-opacity font-light"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Delivery order indicator */}
            {store.deliveryOrder && (
              <div
                className="flex items-center justify-between px-3 py-2 rounded text-xs font-body"
                style={{ background: 'var(--color-brand-subtle)', border: '1px solid var(--color-brand)', color: 'var(--color-brand)' }}
              >
                <span className="font-semibold">
                  Delivery · {store.deliveryOrder.deliveryMode === 'rappi' ? 'Rappi' : 'Flota interna'}
                  {store.deliveryOrder.paymentAtDoor ? ' · COD' : ''}
                </span>
                <button
                  onClick={() => store.setDeliveryOrder(null)}
                  className="hover:opacity-70 transition-opacity font-light"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Botón Delivery */}
            {!store.deliveryOrder && store.cart.length > 0 && (
              <button
                onClick={() => setShowDeliveryModal(true)}
                className="w-full font-body text-sm font-semibold rounded transition-all hover:opacity-80"
                style={{
                  minHeight:  44,
                  border:     '1px solid var(--color-border)',
                  background: 'transparent',
                  color:      'var(--color-text-muted)',
                }}
              >
                Pedido Delivery
              </button>
            )}

            <button
              onClick={() => store.cart.length > 0 && store.setCheckoutOpen(true)}
              disabled={store.cart.length === 0}
              className="w-full font-headline font-bold text-lg rounded transition-all active:scale-[0.98]"
              style={{
                minHeight: 'var(--pos-hit-area-min)',
                background: store.cart.length > 0 ? 'var(--heuk-950, #0a0a0a)' : 'var(--color-border)',
                color:      store.cart.length > 0 ? '#f5f5f2' : 'var(--color-text-disabled)',
                cursor:     store.cart.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              {store.cart.length > 0
                ? `Cobrar ${formatCLP(store.total)}`
                : 'Sin productos'
              }
            </button>
          </div>

          <ShortcutHints hasItems={store.cart.length > 0} />
        </aside>
      </div>

      {/* Shift Gate — step 1: abre turno */}
      {!shiftReady && !booting && (
        <ShiftGate
          cashierName={user?.name ?? 'Cajera'}
          apiUrl={API}
          deviceId={deviceId}
          onShiftOpen={handleShiftOpen}
        />
      )}

      {/* Post-till options — after closing a till: open new or close shift */}
      {showPostTillOpts && (
        <PostTillOptions
          totalSold={totalSold}
          ticketCount={ticketCount}
          onNewTill={() => setShowPostTillOpts(false)}
          onCloseShift={() => { setShowPostTillOpts(false); handleCloseShift() }}
          onViewHistory={() => setShowSalesHistory(true)}
        />
      )}

      {/* Till Gate — step 2: abre caja dentro del turno */}
      {shiftReady && !tillReady && !booting && shift && !showShiftZReport && !showPostTillOpts && (
        <TillGate
          shift={shift}
          cashierName={user?.name ?? 'Cajera'}
          apiUrl={API}
          deviceId={deviceId}
          onTillOpen={handleTillOpen}
          onLogout={() => logoutUserFn(API)}
        />
      )}

      {/* Till Z-Report modal — cierre de caja */}
      {showTillZReport && tillSession && (
        <TillZReportModal
          tillSessionId={tillSession.id}
          apiUrl={API}
          onClose={() => setShowTillZReport(false)}
          onClosed={handleTillClosed}
        />
      )}

      {/* Drawer pedidos web entrantes */}
      {showIncoming && (
        <IncomingOrdersDrawer onClose={() => setShowIncoming(false)} />
      )}

      {/* Comandas — Kanban táctil sin salir de POS */}
      {showComandas && (
        <ComandasView onClose={() => setShowComandas(false)} />
      )}

      {/* Historial ventas de la caja actual o recién cerrada */}
      {showSalesHistory && (tillSession?.id || closedTillId) && (
        <SalesHistoryPanel
          tillSessionId={(tillSession?.id ?? closedTillId)!}
          apiUrl={API}
          onClose={() => setShowSalesHistory(false)}
        />
      )}

      {/* Shift close guard — bloquea cierre de turno si hay caja abierta */}
      {shiftGuarded && (
        <ShiftCloseGuard
          onCloseTill={() => { setShiftGuarded(false); setShowTillZReport(true) }}
          onDismiss={() => setShiftGuarded(false)}
        />
      )}

      {/* Master Shift Z-Report modal — cierre de turno (solo cuando todas las cajas están cerradas) */}
      {showShiftZReport && shift && (
        <MasterShiftZReportModal
          shiftId={shift.id}
          apiUrl={API}
          onClose={() => setShowShiftZReport(false)}
          onLogout={handleLogoutAfterShiftClose}
        />
      )}

      {/* Modal datos delivery */}
      {showDeliveryModal && (
        <DeliveryOrderModal
          apiUrl={API}
          total={store.total}
          onConfirm={info => {
            store.setDeliveryOrder(info)
            setShowDeliveryModal(false)
            store.setCheckoutOpen(true)
          }}
          onClose={() => setShowDeliveryModal(false)}
        />
      )}

      {/* Modal venta B2B — buscar/seleccionar empresa mayorista (adición
          post-entrega). Al seleccionar, los productos agregados DESPUÉS de
          este punto usan priceB2B (ver pos-store.ts addProduct). */}
      {showB2BModal && (
        <B2BCompanyModal
          apiUrl={API}
          onSelect={company => { store.setB2BCompany(company); setShowB2BModal(false) }}
          onClose={() => setShowB2BModal(false)}
        />
      )}

      {/* Assign Driver Modal — aparece después del checkout para pedidos delivery */}
      {pendingAssign && (
        <AssignDriverModal
          assignment={pendingAssign}
          apiUrl={API}
          onDone={() => setPendingAssign(null)}
        />
      )}

      {/* Void Auth Modal — z-[100] para quedar sobre el checkout */}
      {voidTarget && (
        <div className="z-[100] fixed inset-0">
          <VoidAuthModal
            target={voidTarget}
            apiUrl={API}
            onVoided={() => { setVoidTarget(null) }}
            onDismiss={() => setVoidTarget(null)}
          />
        </div>
      )}

      {/* Checkout */}
      {store.checkoutOpen && (
        <CheckoutShell
          subtotal={store.subtotal}
          baesAmount={store.baesAmount}
          total={store.total}
          hasFrozen={store.hasFrozen}
          hasRefrigerated={store.hasRefrigerated}
          baesSession={store.baesSession}
          onBAESValidated={store.setBAESSession}
          onConfirm={handleConfirm}
          onClose={() => store.setCheckoutOpen(false)}
          apiUrl={API}
          cartItems={store.cart}
          cashierName={user?.name ?? 'Cajera'}
          shiftNumber={shift?.shiftNumber}
          tillSessionNumber={tillSession?.sessionNumber}
          deliveryMode={store.deliveryOrder?.deliveryMode ?? undefined}
        />
      )}
    </div>
  )
}
