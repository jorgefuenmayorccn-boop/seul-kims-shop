import { Snowflake, AlertTriangle } from 'lucide-react'

interface ColdChainAlertProps {
  hasFrozen:       boolean
  hasRefrigerated: boolean
  deliveryMode?:   'rappi' | 'metro' | 'pickup' | 'shipping'
}

export function ColdChainAlert({ hasFrozen, hasRefrigerated, deliveryMode }: ColdChainAlertProps) {
  if (!hasFrozen && !hasRefrigerated) return null

  const isShipping = deliveryMode === 'shipping'

  return (
    <div className={
      isShipping
        ? 'flex items-start gap-2 px-3 py-2.5 bg-error-subtle border border-error/30 rounded-md'
        : 'flex items-start gap-2 px-3 py-2.5 bg-cold-frozen-bg border border-cold-frozen/30 rounded-md'
    }>
      {isShipping
        ? <AlertTriangle size={14} className="text-error shrink-0 mt-0.5" />
        : <Snowflake size={14} className="text-cold-frozen shrink-0 mt-0.5" />
      }
      <div>
        {isShipping ? (
          <p className="text-xs font-semibold text-error font-body">
            No se puede despachar a regiones — producto con cadena de frío
          </p>
        ) : (
          <>
            <p className="text-xs font-semibold text-cold-frozen font-body">
              Contiene {hasFrozen ? 'congelados' : 'refrigerados'}
            </p>
            <p className="text-[11px] text-text-muted font-body mt-0.5">
              Entregar en &lt;20 min si es delivery · conservar temperatura
            </p>
          </>
        )}
      </div>
    </div>
  )
}
