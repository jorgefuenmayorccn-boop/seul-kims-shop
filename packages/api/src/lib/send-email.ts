import type { Bindings } from '../index'

const FROM_DEFAULT = 'SEUL SHOP <noreply@seoulshop.cl>'
const QA_REDIRECT  = 'contact@verticeproductions.com'

export async function sendEmail(
  env: Bindings,
  opts: { to: string; subject: string; html: string; from?: string }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!env.RESEND_API_KEY) {
    console.warn('[send-email] RESEND_API_KEY not set — skipping send to', opts.to)
    return { ok: true, id: 'mock' }
  }

  // Redirect all emails to QA inbox during local testing
  const recipient = (env as Record<string, unknown>).QA_EMAIL_REDIRECT === 'true' ? QA_REDIRECT : opts.to

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    opts.from ?? FROM_DEFAULT,
        to:      [recipient],
        subject: opts.subject + (recipient !== opts.to ? ` [QA→${opts.to}]` : ''),
        html:    opts.html,
      }),
    })
    const data = await res.json() as { id?: string; name?: string; message?: string }
    if (!res.ok) return { ok: false, error: data.message ?? 'Error al enviar email' }
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('[send-email] fetch error:', err)
    return { ok: false, error: String(err) }
  }
}

// Templates HTML simples (hasta tener @seul/emails)
export function templateWelcome(name: string, verifyUrl: string, tempPassword: string) {
  return `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#1A1A1A">
<h1 style="color:#D7263D;font-size:28px;margin-bottom:4px">서울킴스</h1>
<p style="color:#888;font-size:12px;margin-top:0">SEOUL KIMS · Viña del Mar</p>
<h2>Hola, ${name}</h2>
<p>Tu cuenta ha sido creada. Confirma tu correo haciendo clic en el botón:</p>
<a href="${verifyUrl}" style="display:inline-block;background:#D7263D;color:white;padding:12px 28px;text-decoration:none;font-weight:bold;margin:16px 0">CONFIRMAR CORREO</a>
<p>Tu contraseña temporal es: <strong style="font-family:monospace">${tempPassword}</strong></p>
<p style="color:#666;font-size:12px">Te pediremos que la cambies en tu primer inicio de sesión.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#aaa;font-size:11px">Este enlace expira en 24 horas. Si no creaste esta cuenta, ignora este email.</p>
</body></html>`
}

export function templateVerify(name: string, verifyUrl: string) {
  return `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#1A1A1A">
<h1 style="color:#D7263D;font-size:28px;margin-bottom:4px">서울킴스</h1>
<h2>Confirma tu correo, ${name}</h2>
<p>Haz clic en el botón para activar tu cuenta:</p>
<a href="${verifyUrl}" style="display:inline-block;background:#D7263D;color:white;padding:12px 28px;text-decoration:none;font-weight:bold;margin:16px 0">CONFIRMAR CORREO</a>
<p style="color:#aaa;font-size:11px">Expira en 24 horas.</p>
</body></html>`
}

export function templatePasswordReset(name: string, resetUrl: string) {
  return `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#1A1A1A">
<h1 style="color:#D7263D;font-size:28px;margin-bottom:4px">서울킴스</h1>
<h2>Recuperación de contraseña</h2>
<p>Hola ${name}, recibimos una solicitud para restablecer tu contraseña:</p>
<a href="${resetUrl}" style="display:inline-block;background:#D7263D;color:white;padding:12px 28px;text-decoration:none;font-weight:bold;margin:16px 0">RESTABLECER CONTRASEÑA</a>
<p style="color:#aaa;font-size:11px">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este email.</p>
</body></html>`
}

// ── Correos transaccionales de pedidos ──────────────────────────────────────

type OrderItem = { name: string; quantity: string; unitPrice: string; subtotal: string }

function formatCLP(n: string | number) {
  return `$${Number(n).toLocaleString('es-CL')}`
}

const baseStyle = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:40px auto;color:#1A1A1A;`
const headerHtml = `
<div style="border-bottom:2px solid #D7263D;padding-bottom:16px;margin-bottom:24px">
  <span style="font-size:22px;font-weight:700;letter-spacing:0.04em;color:#1A1A1A">SEOUL KIMS</span>
  <span style="font-size:11px;color:#888;display:block;margin-top:2px;letter-spacing:0.12em;text-transform:uppercase">Productos Coreanos · Viña del Mar</span>
</div>`
const footerHtml = `
<div style="border-top:1px solid #eee;margin-top:32px;padding-top:16px;color:#aaa;font-size:11px;line-height:1.6">
  SEUL SHOP · Viña del Mar, Chile<br>
  <a href="https://seoulshop.cl" style="color:#D7263D;text-decoration:none">seoulshop.cl</a>
</div>`

function itemsTable(items: OrderItem[]) {
  const rows = items.map(i => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px">${i.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:center;color:#555">${i.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:right">${formatCLP(i.subtotal)}</td>
    </tr>`).join('')
  return `
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <thead>
      <tr style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888">
        <th style="text-align:left;padding-bottom:8px;border-bottom:1px solid #ddd">Producto</th>
        <th style="text-align:center;padding-bottom:8px;border-bottom:1px solid #ddd">Cant.</th>
        <th style="text-align:right;padding-bottom:8px;border-bottom:1px solid #ddd">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

export function templateOrderCreated(opts: {
  recipientName: string
  orderNumber: number
  items: OrderItem[]
  total: string
  deliveryAddress?: string | null
}) {
  return `<!DOCTYPE html><html><body style="${baseStyle}">
${headerHtml}
<h2 style="font-size:18px;font-weight:600;margin-bottom:4px">Tu pedido esta en preparacion</h2>
<p style="color:#555;font-size:14px;margin-top:0">Hola ${opts.recipientName}, hemos recibido tu pedido <strong>#SK-${opts.orderNumber}</strong> y ya esta siendo preparado.</p>
${itemsTable(opts.items)}
<div style="background:#f9f9f9;padding:14px 16px;border-radius:4px;margin-top:8px;display:flex;justify-content:space-between">
  <span style="font-weight:600;font-size:15px">Total</span>
  <span style="font-weight:700;font-size:15px;color:#D7263D">${formatCLP(opts.total)}</span>
</div>
${opts.deliveryAddress ? `<p style="font-size:13px;color:#555;margin-top:16px"><strong>Direccion de entrega:</strong><br>${opts.deliveryAddress}</p>` : ''}
<p style="font-size:13px;color:#777;margin-top:16px">Recibirás una notificacion cuando tu pedido este en camino.</p>
${footerHtml}
</body></html>`
}

export function templateOrderDispatched(opts: {
  recipientName: string
  orderNumber: number
  deliveryAddress?: string | null
  dispatchType: 'internal' | 'rappi' | 'other'
  thirdPartyName?: string | null
  thirdPartyTracking?: string | null
}) {
  const rappiInfo = opts.dispatchType === 'rappi' && opts.thirdPartyName
    ? `<div style="background:#fff8f0;border-left:3px solid #FF441F;padding:12px 16px;margin:16px 0;font-size:14px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:6px">Repartidor Rappi</div>
        <div style="font-weight:600">${opts.thirdPartyName}</div>
        ${opts.thirdPartyTracking ? `<div style="color:#555;margin-top:4px">Codigo: <strong>${opts.thirdPartyTracking}</strong></div>` : ''}
      </div>`
    : ''

  return `<!DOCTYPE html><html><body style="${baseStyle}">
${headerHtml}
<h2 style="font-size:18px;font-weight:600;margin-bottom:4px">Tu pedido va en camino</h2>
<p style="color:#555;font-size:14px;margin-top:0">Hola ${opts.recipientName}, tu pedido <strong>#SK-${opts.orderNumber}</strong> ha sido despachado y esta en ruta hacia ti.</p>
${rappiInfo}
${opts.deliveryAddress ? `<p style="font-size:13px;color:#555"><strong>Direccion de entrega:</strong><br>${opts.deliveryAddress}</p>` : ''}
<p style="font-size:13px;color:#777;margin-top:16px">Ten a la mano el monto exacto si pagos al recibir.</p>
${footerHtml}
</body></html>`
}

export function templateOrderDelivered(opts: {
  recipientName: string
  orderNumber: number
  total: string
}) {
  return `<!DOCTYPE html><html><body style="${baseStyle}">
${headerHtml}
<h2 style="font-size:18px;font-weight:600;margin-bottom:4px">Tu pedido fue entregado</h2>
<p style="color:#555;font-size:14px;margin-top:0">Hola ${opts.recipientName}, el pedido <strong>#SK-${opts.orderNumber}</strong> por <strong>${formatCLP(opts.total)}</strong> fue entregado exitosamente.</p>
<p style="font-size:14px;color:#555">Esperamos que disfrutes tus productos. Gracias por elegirnos.</p>
<p style="font-size:13px;color:#777;margin-top:8px">Si tienes alguna consulta sobre tu pedido, comunícate con nosotros por WhatsApp.</p>
${footerHtml}
</body></html>`
}

export function templateNewsletterConfirm(confirmUrl: string) {
  return `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#1A1A1A">
<h1 style="color:#D7263D;font-size:28px;margin-bottom:4px">서울킴스</h1>
<h2>Confirma tu suscripción</h2>
<p>Gracias por suscribirte a las novedades de SEUL SHOP. Haz clic para confirmar:</p>
<a href="${confirmUrl}" style="display:inline-block;background:#D7263D;color:white;padding:12px 28px;text-decoration:none;font-weight:bold;margin:16px 0">CONFIRMAR SUSCRIPCIÓN</a>
<p style="color:#aaa;font-size:11px">Si no solicitaste esto, ignora este email.</p>
</body></html>`
}
