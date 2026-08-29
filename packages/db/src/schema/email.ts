import { pgTable, uuid, text, timestamp, integer, pgEnum, jsonb, boolean } from 'drizzle-orm/pg-core'
import { customers } from './customers'

export const emailTypeEnum = pgEnum('email_type', [
  'welcome',                // Bienvenida al registrarse
  'password-reset',         // Cambio de contraseña
  'order-confirmation',     // Confirmación de orden (cliente + copia admin)
  'order-shipped',          // Orden despachada
  'order-delivered',        // Orden entregada / foto de entrega
  'delivery-update',        // Update genérico de estado de orden
  'invoice',                // Envío de boleta/invoice
  'newsletter',             // Newsletter
  'contact-form-reply',     // Reply a formulario
  // Agregados en migrate-0012 (SESSION 20 — fix de `type` hardcodeado)
  'quote-sent',             // Cotización B2B enviada (comprador + copia admin)
  'quote-accepted',         // Cotización B2B aceptada
  'quote-rejected',         // Cotización B2B rechazada
  'delivery-assigned',      // Entrega asignada a repartidor
  'delivery-failed',        // Entrega fallida — alerta admin
  'large-order-alert',      // Pedido grande — alerta admin
  'user-created',           // Nuevo usuario registrado — alerta admin
])

export const emailStatusEnum = pgEnum('email_status', [
  'pending',     // En cola, no enviado aún
  'processing',  // Siendo enviado
  'sent',        // Enviado exitosamente
  'failed',      // Falló (sin reintentos)
  'bounced',     // Email inválido
])

// Queue de emails para procesar asincronicamente
export const emailQueue = pgTable('email_queue', {
  id:           uuid('id').primaryKey().defaultRandom(),
  customerId:   uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  email:        text('email').notNull(),                    // dirección destino
  type:         emailTypeEnum('type').notNull(),
  subject:      text('subject').notNull(),
  templateId:   text('template_id'),                        // 'welcome', 'password-reset', etc
  templateData: jsonb('template_data'),                     // variables para el template
  status:       emailStatusEnum('status').default('pending'),
  attempts:     integer('attempts').default(0),
  maxAttempts:  integer('max_attempts').default(3),
  lastError:    text('last_error'),
  sentAt:       timestamp('sent_at'),
  scheduledFor:  timestamp('scheduled_for').defaultNow(),  // cuándo enviar
  createdAt:    timestamp('created_at').defaultNow(),
})

// Log de emails enviados (auditoría, 6 años)
export const emailLog = pgTable('email_log', {
  id:          uuid('id').primaryKey().defaultRandom(),
  queueId:     uuid('queue_id').references(() => emailQueue.id),
  customerId:  uuid('customer_id').references(() => customers.id),
  email:       text('email').notNull(),
  type:        emailTypeEnum('type').notNull(),
  subject:     text('subject').notNull(),
  status:      text('status'),        // 'delivered', 'failed', 'bounced'
  provider:    text('provider'),      // 'resend', 'sendgrid'
  providerRef: text('provider_ref'),  // message ID del provider
  sentAt:      timestamp('sent_at').defaultNow(),
  openedAt:    timestamp('opened_at'),
  clickedAt:   timestamp('clicked_at'),
})
