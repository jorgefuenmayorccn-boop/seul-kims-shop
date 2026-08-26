import { Bike, Train, Store, Package, type LucideIcon } from 'lucide-react'
import { getRecentOrders } from '@/lib/api'

const CH: Record<string, { label: string; color: string }> = {
  pos:      { label: 'POS',      color: 'bg-channel-pos/10 text-channel-pos' },
  web:      { label: 'Web',      color: 'bg-channel-web/10 text-channel-web' },
  b2b:      { label: 'B2B',      color: 'bg-channel-b2b/10 text-channel-b2b' },
  whatsapp: { label: 'WhatsApp', color: 'bg-channel-whatsapp/10 text-channel-whatsapp' },
}

const ST: Record<string, { label: string; color: string }> = {
  nueva:      { label: 'Nueva',      color: 'bg-comanda-nueva/10 text-comanda-nueva' },
  preparando: { label: 'Preparando', color: 'bg-comanda-preparando/10 text-comanda-preparando' },
  lista:      { label: 'Lista',      color: 'bg-comanda-lista/10 text-comanda-lista' },
  entregada:  { label: 'Entregada',  color: 'bg-comanda-entregada/10 text-comanda-entregada' },
  cancelada:  { label: 'Cancelada',  color: 'bg-comanda-cancelada/10 text-comanda-cancelada' },
}

const DM: Record<string, { Icon: LucideIcon; label: string }> = {
  rappi:    { Icon: Bike,    label: 'Rappi'   },
  metro:    { Icon: Train,   label: 'Metro'   },
  pickup:   { Icon: Store,   label: 'Retiro'  },
  shipping: { Icon: Package, label: 'Envío'   },
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

export async function RecentOrdersTable() {
  const { orders } = await getRecentOrders(10)

  if (orders.length === 0) return <p className="text-sm text-text-muted font-body py-4">Sin pedidos todavía.</p>

  return (
    <div className="bg-elevated rounded-lg border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-surface">
            <th className="px-4 py-2.5 text-left text-xs text-text-muted font-body font-medium">#</th>
            <th className="px-4 py-2.5 text-left text-xs text-text-muted font-body font-medium">Canal</th>
            <th className="px-4 py-2.5 text-left text-xs text-text-muted font-body font-medium">Estado</th>
            <th className="px-4 py-2.5 text-left text-xs text-text-muted font-body font-medium">Entrega</th>
            <th className="px-4 py-2.5 text-right text-xs text-text-muted font-body font-medium">Total</th>
            <th className="px-4 py-2.5 text-right text-xs text-text-muted font-body font-medium">Cuándo</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => {
            const ch = CH[o.channel] ?? { label: o.channel, color: 'bg-surface text-text-muted' }
            const st = ST[o.status]  ?? { label: o.status,  color: 'bg-surface text-text-muted' }
            return (
              <tr key={o.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-surface/50 transition-colors">
                <td className="px-4 py-3 font-mono text-sm font-bold text-text">#{o.number}</td>
                <td className="px-4 py-3"><span className={`text-xs font-body font-medium px-2 py-0.5 rounded-full ${ch.color}`}>{ch.label}</span></td>
                <td className="px-4 py-3"><span className={`text-xs font-body font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span></td>
                <td className="px-4 py-3 text-sm font-body text-text-muted">
                  {(() => { const dm = DM[o.deliveryMode]; if (!dm) return o.deliveryMode; const { Icon, label } = dm; return <span className="flex items-center gap-1"><Icon size={13} />{label}</span> })()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-brand">${Number(o.total).toLocaleString('es-CL')}</td>
                <td className="px-4 py-3 text-right text-xs font-body text-text-muted">{timeAgo(o.createdAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
