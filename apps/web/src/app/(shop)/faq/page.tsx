import { ShopFooter } from '@seul/ui/shop/shop-footer'
import { FaqAccordion } from '@/components/shop/faq-accordion'

interface FaqEntry {
  id:       string
  question: string
  answer:   string
  category: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

const STATIC_FAQ: FaqEntry[] = [
  { id: 's1', category: 'Pedidos', question: '¿Cómo puedo hacer un pedido?', answer: 'Puedes pedir directamente en nuestra tienda online, seleccionando tus productos y eligiendo el método de entrega. También puedes escribirnos por WhatsApp al +56 9 3645 1991 y te ayudamos a gestionar tu pedido.' },
  { id: 's2', category: 'Pedidos', question: '¿Puedo modificar o cancelar un pedido?', answer: 'Puedes modificar o cancelar tu pedido dentro de los 30 minutos siguientes a su confirmación. Pasado ese plazo, el pedido ya está en preparación y no es posible hacer cambios.' },
  { id: 's3', category: 'Envíos', question: '¿Cuáles son los métodos de entrega?', answer: 'Ofrecemos: (1) Retiro gratis en Estación Miramar del Merval, (2) Delivery con Rappi en menos de 60 minutos para Viña del Mar, Reñaca y Concón, (3) Despacho por Starken o Chilexpress para el resto de Chile (solo productos sin cadena de frío).' },
  { id: 's4', category: 'Envíos', question: '¿Despachan productos congelados o refrigerados a regiones?', answer: 'No. Los productos con cadena de frío (congelados y refrigerados) solo se pueden retirar en tienda o recibir mediante Rappi dentro de la zona de cobertura del Gran Valparaíso. Esto es para garantizar la calidad del producto.' },
  { id: 's5', category: 'Productos', question: '¿Son productos originales de Corea?', answer: 'Sí. Todos nuestros productos son importados directamente desde Corea del Sur, con sus respectivos registros sanitarios en Chile. Vendemos marcas reconocidas como Nongshim, Ottogi, Samyang, CJ, Lotte y muchas más.' },
  { id: 's6', category: 'Productos', question: '¿Tienen productos veganos o sin gluten?', answer: 'Tenemos algunos productos aptos para dietas veganas o sin gluten. Filtra por alérgenos en nuestra tienda o pregúntanos por WhatsApp para orientarte según tus necesidades.' },
  { id: 's7', category: 'Pagos', question: '¿Qué medios de pago aceptan?', answer: 'Aceptamos tarjetas de débito y crédito (Visa, Mastercard, American Express), transferencia bancaria y pago en efectivo al retirar en tienda. Para pedidos Rappi, el pago se gestiona directamente en la app.' },
  { id: 's8', category: 'Pagos', question: '¿Puedo usar tarjeta JUNAEB (TNE)?', answer: 'Sí, en nuestra tienda física (POS). Los productos elegibles BAES están marcados. El sistema valida automáticamente los montos aplicables al subsidio JUNAEB.' },
  { id: 's9', category: 'Privacidad', question: '¿Cómo protegen mis datos personales?', answer: 'Cumplimos con la Ley 21.719 de Protección de Datos Personales de Chile. Tus datos se utilizan exclusivamente para gestionar tus pedidos y, si diste tu consentimiento, para enviarte comunicaciones de marketing. Puedes ejercer tus derechos de acceso, rectificación y supresión en cualquier momento desde tu cuenta o enviando un correo a contacto@seoulshop.cl.' },
  { id: 's10', category: 'Privacidad', question: '¿Cómo puedo eliminar mi cuenta?', answer: 'Puedes solicitar la eliminación de tu cuenta desde tu perfil en "Mi Cuenta". Tu información se anonimizará en un plazo de 15 días hábiles, conservando solo los registros contables obligatorios por ley.' },
  { id: 's11', category: 'Devoluciones', question: '¿Cuál es la política de devoluciones?', answer: 'Aceptamos devoluciones dentro de los 10 días hábiles desde la recepción del producto, siempre que esté en su estado original y sellado. Productos perecederos o refrigerados no tienen devolución salvo defecto de fábrica. Inicia tu solicitud en /devoluciones.' },
  { id: 's12', category: 'Devoluciones', question: '¿Qué hago si recibí un producto en mal estado?', answer: 'Toma fotos del producto y del embalaje, y contáctanos en las primeras 24 horas por WhatsApp o email. Te reponemos el producto o te hacemos el reembolso total según prefieras.' },
]

async function getFaqEntries(): Promise<FaqEntry[]> {
  try {
    const r = await fetch(`${API_URL}/api/faq`, { next: { tags: ['faq'], revalidate: 3600 } })
    if (!r.ok) return STATIC_FAQ
    const d = await r.json() as { ok: boolean; entries: FaqEntry[] }
    return d.ok && d.entries.length > 0 ? d.entries : STATIC_FAQ
  } catch { return STATIC_FAQ }
}

export default async function FaqPage() {
  const entries = await getFaqEntries()

  const grouped: Record<string, FaqEntry[]> = {}
  for (const e of entries) {
    if (!grouped[e.category]) grouped[e.category] = []
    grouped[e.category].push(e)
  }

  return (
    <div style={{ background: 'var(--color-baek-pure, var(--baek-50))' }}>
      {/* Header editorial */}
      <section
        className="px-8 md:px-16 py-16 border-b"
        style={{ borderColor: 'var(--border-editorial)' }}
      >
        <span
          className="font-korean text-xs font-medium block mb-2"
          style={{ color: 'var(--color-celadon)', letterSpacing: '0.2em' }}
        >
          자주 묻는 질문
        </span>
        <h1
          className="font-headline font-bold leading-none"
          style={{ fontSize: 'clamp(28px, 5vw, 52px)', color: 'var(--color-heuk)' }}
        >
          Preguntas frecuentes
        </h1>
        <p
          className="font-body text-sm mt-3 max-w-lg"
          style={{ color: 'var(--color-heuk)', opacity: 0.55 }}
        >
          Todo lo que necesitas saber sobre SEUL SHOP — pedidos, envíos, productos y privacidad.
        </p>
      </section>

      {/* FaqAccordion es client component */}
      <div className="px-8 md:px-16 py-12 max-w-3xl">
        <FaqAccordion grouped={grouped} />
      </div>

      {/* CTA WhatsApp */}
      <section
        className="px-8 md:px-16 py-10 border-t flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        style={{ borderColor: 'var(--border-editorial)' }}
      >
        <div>
          <span className="font-korean text-xs block mb-1" style={{ color: 'var(--color-celadon)', letterSpacing: '0.18em' }}>더 궁금한 점</span>
          <p className="font-headline font-bold text-xl" style={{ color: 'var(--color-heuk)' }}>
            ¿No encontraste tu respuesta?
          </p>
          <p className="font-body text-sm mt-1" style={{ color: 'var(--color-heuk)', opacity: 0.5 }}>
            Escríbenos y te respondemos en minutos
          </p>
        </div>
        <a
          href="https://wa.me/56936451991?text=Hola%2C+tengo+una+pregunta+sobre+Seoul+Kims"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-8 py-4 font-body font-semibold text-sm tracking-widest"
          style={{
            background: '#25d366',
            color: '#fff',
            letterSpacing: '0.1em',
          }}
        >
          ESCRIBIR POR WHATSAPP
        </a>
      </section>

      <ShopFooter />
    </div>
  )
}
