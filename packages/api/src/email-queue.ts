import { Resend } from 'resend'
import { sql, RESEND_KEY } from './db'

const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null

// ============================================================================
// EMAIL ENGINE
// ============================================================================
// Extraído de server.ts en SESSION 20 para poder reutilizarlo desde
// test-harness.ts sin duplicar lógica de negocio real.

export async function enqueueEmail(email: string, subject: string, html: string, type: string = 'contact-form-reply'): Promise<string> {
  try {
    const templateData = { html }
    const [record] = await sql`
      INSERT INTO email_queue (email, type, subject, template_data, status, attempts, max_attempts)
      VALUES (${email}, ${type}, ${subject}, ${templateData}, 'pending', 0, 3)
      RETURNING id
    `

    console.log(`📧 Email enqueued: ${email} | ${subject}`)

    // Send async
    setTimeout(() => processEmailQueue(record.id).catch(e => console.error('Queue error:', e)), 100)
    return record.id
  } catch (err) {
    console.error('Enqueue error:', err)
    throw err
  }
}

export async function processEmailQueue(queueId: string, retryCount = 0): Promise<void> {
  try {
    const [record] = await sql`SELECT * FROM email_queue WHERE id = ${queueId}`
    if (!record) return

    if (record.attempts >= record.max_attempts) {
      await sql`UPDATE email_queue SET status = 'failed' WHERE id = ${queueId}`
      return
    }

    const updatedAttempts = record.attempts + 1
    await sql`UPDATE email_queue SET attempts = ${updatedAttempts} WHERE id = ${queueId}`

    const htmlContent = typeof record.template_data === 'string'
      ? JSON.parse(record.template_data).html
      : record.template_data?.html

    if (!htmlContent) {
      throw new Error(`No HTML content for email: ${record.id}`)
    }

    const result = await resend.emails.send({
      from: 'Seoul Shop Viña del Mar <noreply@seoulshop.cl>',
      to: record.email,
      subject: record.subject,
      html: htmlContent,
    })

    if (result.error) throw new Error(`Resend: ${JSON.stringify(result.error)}`)

    // Log delivery
    await sql`
      INSERT INTO email_log (queue_id, email, type, subject, status, provider, provider_ref)
      VALUES (${queueId}, ${record.email}, ${record.type}, ${record.subject}, 'delivered', 'resend', ${result.data?.id})
    `

    await sql`UPDATE email_queue SET status = 'sent', sent_at = NOW() WHERE id = ${queueId}`

    console.log(`✅ Email sent: ${record.email}`)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    const [record] = await sql`SELECT * FROM email_queue WHERE id = ${queueId}`

    if (record && record.attempts < record.max_attempts) {
      const delay = Math.pow(2, record.attempts) * 1000
      console.log(`⏳ Retry ${queueId} in ${delay}ms`)
      setTimeout(() => processEmailQueue(queueId, retryCount + 1), delay)
    } else {
      await sql`UPDATE email_queue SET status = 'failed', last_error = ${errorMsg} WHERE id = ${queueId}`
    }
  }
}

// ============================================================================
// TEMPLATES
// ============================================================================

export const templates = {
  orderConfirmation: (order: any) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">✅ Orden Confirmada #${order.number}</h2>
      <p>Tu orden ha sido registrada. Total: $${Number(order.total).toLocaleString('es-CL')}</p>
      <p>Tu pedido está siendo preparado. Recibirás notificaciones sobre su estado.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop Viña del Mar | +56 32 250 0000</p>
    </div>
  `,
  orderStatus: (order: any, status: string, eta?: string) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">📦 Actualización Orden #${order.number}</h2>
      <p>Tu pedido cambió a: <strong>${status.toUpperCase()}</strong></p>
      ${eta ? `<p>⏱️ Tiempo estimado de llegada: <strong>${eta}</strong></p>` : ''}
      <p>Recibirás más actualizaciones pronto.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop Viña del Mar</p>
    </div>
  `,
  quote: (quote: any) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">📋 Cotización #${quote.number}</h2>
      <p>Tu cotización está lista. Total: $${Number(quote.total).toLocaleString('es-CL')}</p>
      <p>Válida hasta: ${quote.validUntilAt}</p>
      <p>Contacta con nosotros para aceptar o discutir.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop B2B | b2b@seoulshop.cl</p>
    </div>
  `,
  deliveryPhoto: (order: any) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #4caf50;">✅ Pedido Entregado #${order.number}</h2>
      <p>Tu orden ha sido entregada exitosamente.</p>
      <p>¡Gracias por tu compra!</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop Viña del Mar</p>
    </div>
  `,
  deliveryAssigned: () => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">🚚 Nueva Entrega Asignada</h2>
      <p>Tienes una nueva entrega. Revisá tu aplicación para más detalles.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop - Sistema de Entregas</p>
    </div>
  `,
  largeOrderAlert: (order: any) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff3e0;">
      <h2 style="color: #e65100;">⚠️ Pedido Grande #${order.number}</h2>
      <p>Se registró un pedido de monto elevado: <strong>$${Number(order.total).toLocaleString('es-CL')}</strong></p>
      <p>Revísalo cuanto antes en el panel de administración.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop - Alertas del Sistema</p>
    </div>
  `,
  deliveryFailed: (assignmentId: string) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffebee;">
      <h2 style="color: #c62828;">🚫 Entrega Fallida — Acción Requerida</h2>
      <p>La entrega <strong>${assignmentId}</strong> fue marcada como fallida.</p>
      <p>Contacta al repartidor y al cliente para coordinar un nuevo intento.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop - Sistema de Entregas</p>
    </div>
  `,

  // ==========================================================================
  // Templates SOLO usados por test-harness.ts (simulan emails sin subsistema
  // real detrás — B2B lifecycle post-cotización, cron jobs, driver ops, admin ops)
  // ==========================================================================
  b2bOrderConfirmation: (quote: any) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">✅ Orden B2B Confirmada (desde Cotización #${quote.number})</h2>
      <p>Tu cotización aceptada se convirtió en orden. Total: $${Number(quote.total).toLocaleString('es-CL')}</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop B2B</p>
    </div>
  `,
  b2bOrderStatus: (quote: any, status: string) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">📦 Orden B2B #${quote.number}: ${status.toUpperCase()}</h2>
      <p>Tu pedido mayorista cambió de estado.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop B2B</p>
    </div>
  `,
  invoiceSent: (quote: any) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">🧾 Factura — Orden B2B #${quote.number}</h2>
      <p>Adjuntamos tu factura por $${Number(quote.total).toLocaleString('es-CL')}.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop B2B | Facturación</p>
    </div>
  `,
  driverDailyBriefing: (driverName: string, deliveryCount: number) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">☀️ Briefing Diario</h2>
      <p>Hola ${driverName}, hoy tienes <strong>${deliveryCount}</strong> entregas asignadas.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop - Sistema de Entregas</p>
    </div>
  `,
  driverReminder: (orderNumber: number) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">⏰ Recordatorio de Entrega #${orderNumber}</h2>
      <p>Tienes una entrega pendiente próxima a vencer su ventana horaria.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop - Sistema de Entregas</p>
    </div>
  `,
  driverProofSubmitted: (orderNumber: number) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #4caf50;">✅ Comprobante Recibido — Orden #${orderNumber}</h2>
      <p>Tu comprobante de entrega fue recibido y registrado correctamente.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop - Sistema de Entregas</p>
    </div>
  `,
  driverShiftSummary: (driverName: string, count: number, total: string) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">📋 Resumen de Jornada</h2>
      <p>${driverName}, cerraste tu turno con ${count} entregas. Total a liquidar: $${total}</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop - Sistema de Entregas</p>
    </div>
  `,
  paymentIssue: (orderNumber: number) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffebee;">
      <h2 style="color: #c62828;">💳 Problema de Pago — Orden #${orderNumber}</h2>
      <p>El pago de esta orden no pudo procesarse. Requiere revisión manual.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop - Alertas del Sistema</p>
    </div>
  `,
  dailySalesReport: (date: string, total: string, orderCount: number) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">📊 Reporte de Ventas — ${date}</h2>
      <p>${orderCount} órdenes. Total del día: $${total}</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop - Reportes</p>
    </div>
  `,
  stockLowAlert: (productName: string, unitsLeft: number) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff3e0;">
      <h2 style="color: #e65100;">📉 Stock Bajo: ${productName}</h2>
      <p>Quedan <strong>${unitsLeft}</strong> unidades. Reabastecer pronto.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop - Alertas de Inventario</p>
    </div>
  `,
  cashCollected: (driverName: string, amount: string) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #d7263d;">💵 Efectivo Recolectado</h2>
      <p>${driverName} recolectó $${amount} en efectivo por entregas contra-entrega.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Seoul Shop - Caja</p>
    </div>
  `,

  // EMAIL: Credenciales iniciales (primer login)
  initialCredentials: ({ email, password, name, role }) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
      <div style="background: white; padding: 30px; border-radius: 8px;">
        <h1 style="color: #333; margin-top: 0;">🎉 ¡Bienvenido a SEUL KING OS!</h1>

        <p style="color: #555; line-height: 1.6;">
          Hola <strong>${name}</strong>,<br>
          Has sido agregado como <strong>${role.toUpperCase()}</strong> al sistema SEUL KING OS v1.0.
        </p>

        <div style="background: #f0f0f0; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; color: #888;"><small>Tus credenciales de acceso:</small></p>
          <p style="margin: 5px 0; font-family: monospace; font-size: 14px;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0; font-family: monospace; font-size: 14px;"><strong>Contraseña temporal:</strong> ${password}</p>
        </div>

        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #856404;"><strong>⚠️ Importante:</strong></p>
          <p style="margin: 5px 0 0 0; color: #856404; font-size: 13px;">
            En tu primer login, el sistema te pedirá que cambies esta contraseña temporal por una contraseña personalizada.
          </p>
        </div>

        <div style="margin: 30px 0;">
          <a href="https://cmr.seoulshop.cl/login" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Acceder al Sistema →
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #888; font-size: 12px; text-align: center;">
          SEUL KING OS v1.0 | Sistema de Gestión Seoul Kims<br>
          Si no solicicitaste este acceso, contáctanos inmediatamente.
        </p>
      </div>
    </div>
  `,

  // EMAIL: Confirmación de cambio de contraseña
  passwordChangedSuccess: ({ name, email, timestamp }) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <div style="background: white; padding: 30px; border-radius: 8px; border-top: 4px solid #28a745;">
        <h1 style="color: #28a745; margin-top: 0;">✅ Contraseña Cambiada con Éxito</h1>

        <p style="color: #555; line-height: 1.6;">
          Hola <strong>${name}</strong>,<br>
          Tu contraseña ha sido cambiada exitosamente.
        </p>

        <div style="background: #f0f0f0; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #666; font-size: 13px;">
            <strong>Email:</strong> ${email}<br>
            <strong>Cambio realizado:</strong> ${timestamp}
          </p>
        </div>

        <div style="background: #e8f5e9; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #1b5e20;"><strong>✓ Tu acceso es seguro</strong></p>
          <p style="margin: 5px 0 0 0; color: #1b5e20; font-size: 13px;">
            Tu cuenta está protegida con tu nueva contraseña. Ya puedes usar el sistema normalmente.
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #888; font-size: 12px; text-align: center;">
          SEUL KING OS v1.0 | Si no realizaste este cambio, contáctanos inmediatamente.
        </p>
      </div>
    </div>
  `,

  // ==========================================================================
  // CLIENTE FINAL (apps/web, tienda B2C/B2B) — S09, Fase 3. Separadas de las
  // plantillas de STAFF de arriba (initialCredentials/passwordChangedSuccess)
  // a propósito: distinto branding (Seoul Shop, no "SEUL KING OS"), distinto
  // link de destino (seoulshop.cl, no cmr.seoulshop.cl).
  // ==========================================================================

  // EMAIL: Credenciales iniciales de cliente (tras registro en /cuenta/registro)
  customerInitialCredentials: ({ email, password, name }: { email: string; password: string; name: string }) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <div style="background: white; padding: 30px; border-radius: 8px; border-top: 4px solid #d7263d;">
        <h1 style="color: #d7263d; margin-top: 0;">¡Bienvenido a Seoul Shop!</h1>

        <p style="color: #555; line-height: 1.6;">
          Hola <strong>${name}</strong>,<br>
          Tu cuenta en Seoul Shop Viña del Mar ha sido creada.
        </p>

        <div style="background: #f0f0f0; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; color: #888;"><small>Tus credenciales de acceso:</small></p>
          <p style="margin: 5px 0; font-family: monospace; font-size: 14px;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0; font-family: monospace; font-size: 14px;"><strong>Contraseña temporal:</strong> ${password}</p>
        </div>

        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #856404;"><strong>Importante:</strong></p>
          <p style="margin: 5px 0 0 0; color: #856404; font-size: 13px;">
            En tu primer inicio de sesión te pediremos cambiar esta contraseña temporal por una tuya.
          </p>
        </div>

        <div style="margin: 30px 0;">
          <a href="https://seoulshop.cl/cuenta/login" style="display: inline-block; background: #d7263d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Iniciar sesión →
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #888; font-size: 12px; text-align: center;">
          Seoul Shop Viña del Mar<br>
          Si no creaste esta cuenta, ignora este correo o contáctanos.
        </p>
      </div>
    </div>
  `,

  // EMAIL: Enlace para restablecer contraseña de cliente (POST /api/customer/password-forgot)
  customerPasswordResetLink: ({ name, resetUrl }: { name: string; resetUrl: string }) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <div style="background: white; padding: 30px; border-radius: 8px; border-top: 4px solid #d7263d;">
        <h1 style="color: #d7263d; margin-top: 0;">Recuperar contraseña</h1>

        <p style="color: #555; line-height: 1.6;">
          Hola${name ? ` <strong>${name}</strong>` : ''},<br>
          Recibimos una solicitud para restablecer la contraseña de tu cuenta en Seoul Shop.
        </p>

        <div style="margin: 30px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #d7263d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Restablecer contraseña →
          </a>
        </div>

        <p style="color: #888; font-size: 13px;">
          Este enlace expira en 1 hora y solo puede usarse una vez. Si no solicitaste este cambio, ignora este correo — tu contraseña actual seguirá funcionando.
        </p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #888; font-size: 12px; text-align: center;">
          Seoul Shop Viña del Mar
        </p>
      </div>
    </div>
  `,

  // EMAIL: Confirmación de cambio de contraseña de cliente
  customerPasswordChanged: ({ name, email, timestamp }: { name: string; email: string; timestamp: string }) => `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <div style="background: white; padding: 30px; border-radius: 8px; border-top: 4px solid #28a745;">
        <h1 style="color: #28a745; margin-top: 0;">Contraseña actualizada</h1>

        <p style="color: #555; line-height: 1.6;">
          Hola <strong>${name}</strong>,<br>
          La contraseña de tu cuenta en Seoul Shop fue cambiada exitosamente.
        </p>

        <div style="background: #f0f0f0; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #666; font-size: 13px;">
            <strong>Email:</strong> ${email}<br>
            <strong>Cambio realizado:</strong> ${timestamp}
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #888; font-size: 12px; text-align: center;">
          Seoul Shop Viña del Mar | Si no realizaste este cambio, contáctanos inmediatamente.
        </p>
      </div>
    </div>
  `,
}
