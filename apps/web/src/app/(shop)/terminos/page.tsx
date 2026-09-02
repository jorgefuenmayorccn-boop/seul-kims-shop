import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos y Condiciones | SEUL SHOP',
  description: 'Términos y condiciones de uso de SEUL SHOP CL. Plataforma de venta de productos coreanos en Viña del Mar, Chile.',
}

export default function TerminosPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-baek-pure)' }}>
      <div className="max-w-3xl mx-auto px-6 md:px-8 py-16">

        {/* Aviso borrador */}
        <div
          className="mb-8 px-4 py-3 border-l-4 font-body text-sm"
          style={{ borderColor: 'var(--color-seoul-red)', background: 'rgba(215,38,61,0.05)', color: 'var(--color-heuk)' }}
        >
          <strong>BORRADOR</strong> — Pendiente revisión por asesor legal. Vigente hasta aprobación definitiva.
        </div>

        {/* Encabezado */}
        <p className="font-korean font-black text-3xl" style={{ color: 'var(--color-seoul-red)' }}>약관</p>
        <h1 className="font-headline font-bold text-2xl mt-1 mb-2" style={{ color: 'var(--color-heuk)' }}>
          Términos y Condiciones
        </h1>
        <p className="font-body text-xs mb-10" style={{ color: 'var(--color-heuk)', opacity: 0.45 }}>
          Última actualización: agosto 2026 · Seoul Kims, Viña del Mar, Chile
        </p>

        <div className="space-y-8 font-body text-sm leading-relaxed" style={{ color: 'var(--color-heuk)', opacity: 0.85 }}>

          <section>
            <h2 className="font-headline font-bold text-base mb-3" style={{ opacity: 1 }}>1. Objeto y ámbito de aplicación</h2>
            <p>
              Los presentes Términos y Condiciones regulan el acceso y uso de la plataforma digital de Seoul Kims
              (en adelante, "la Plataforma"), operada por Seoul Kims (RUT pendiente de confirmación),
              con domicilio en Viña del Mar, Región de Valparaíso, República de Chile.
            </p>
            <p className="mt-2">
              El uso de la Plataforma implica la aceptación plena e irrestricta de las presentes condiciones.
              Si no estás de acuerdo con alguno de los términos, debes abstenerte de usar la Plataforma.
            </p>
          </section>

          <section>
            <h2 className="font-headline font-bold text-base mb-3" style={{ opacity: 1 }}>2. Proceso de compra</h2>
            <p>
              Las compras realizadas a través de la Plataforma se procesan mediante coordinación por WhatsApp.
              Al confirmar tu pedido, recibirás un enlace al número de WhatsApp de Seoul Kims con el resumen
              de tu pedido. El pago se acuerda directamente con el vendedor.
            </p>
            <p className="mt-2">
              Seoul Kims se reserva el derecho de rechazar o cancelar pedidos por razones de stock insuficiente,
              error en el precio publicado u otras causas justificadas, notificando al cliente a la brevedad.
            </p>
            <p className="mt-2">
              Los precios publicados son en Pesos Chilenos (CLP) e incluyen IVA cuando corresponda.
            </p>
          </section>

          <section>
            <h2 className="font-headline font-bold text-base mb-3" style={{ opacity: 1 }}>3. Despacho y entrega</h2>
            <p>Seoul Kims ofrece las siguientes modalidades de entrega:</p>
            <ul className="mt-2 space-y-1 pl-4 list-disc">
              <li><strong>Retiro en Metro Merval:</strong> Gratuito en la estación acordada de la línea Valparaíso–Viña del Mar (la estación específica se confirma al finalizar el pedido).</li>
              <li><strong>Rappi:</strong> Delivery a domicilio en Viña del Mar, Reñaca y Concón. Sujeto a disponibilidad de la plataforma.</li>
              <li><strong>Regiones:</strong> Coordinación manual vía WhatsApp. No disponible para productos de cadena de frío (congelados o refrigerados).</li>
            </ul>
            <p className="mt-2">
              Los plazos de entrega son referenciales y pueden variar por causas externas.
              Seoul Kims no se hace responsable por retrasos imputables a terceros transportistas.
            </p>
          </section>

          <section>
            <h2 className="font-headline font-bold text-base mb-3" style={{ opacity: 1 }}>4. Política de devoluciones y cambios</h2>
            <p>
              De conformidad con el artículo 3 bis de la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores,
              el cliente tiene derecho a retracto dentro de los <strong>10 días corridos</strong> desde la recepción del producto,
              siempre que el producto se encuentre en perfecto estado, sin uso y en su empaque original.
            </p>
            <p className="mt-2">
              Los productos perecibles, de cadena de frío, o que por su naturaleza no puedan ser devueltos en condiciones
              de higiene adecuadas, quedan excluidos del derecho a retracto, salvo defecto imputable a Seoul Kims.
            </p>
            <p className="mt-2">
              Para iniciar una devolución, visita la sección <a href="/devoluciones" className="underline" style={{ color: 'var(--color-seoul-red)' }}>Devoluciones</a> de nuestra Plataforma.
            </p>
          </section>

          <section>
            <h2 className="font-headline font-bold text-base mb-3" style={{ opacity: 1 }}>5. Protección de datos personales</h2>
            <p>
              El tratamiento de tus datos personales se rige por la Ley N° 21.719 sobre Protección de Datos Personales
              de la República de Chile, vigente desde el 1° de diciembre de 2026.
            </p>
            <p className="mt-2">
              Seoul Kims trata tus datos con las siguientes finalidades: (i) gestión de pedidos y entregas,
              (ii) comunicaciones de servicio, y (iii) comunicaciones comerciales, únicamente si has otorgado
              tu consentimiento explícito para ello.
            </p>
            <p className="mt-2">
              Puedes ejercer tus derechos de acceso, rectificación, cancelación, oposición y portabilidad
              a través de nuestra página de <a href="/privacidad" className="underline" style={{ color: 'var(--color-seoul-red)' }}>Privacidad y Datos Personales</a>.
            </p>
          </section>

          <section>
            <h2 className="font-headline font-bold text-base mb-3" style={{ opacity: 1 }}>6. Propiedad intelectual</h2>
            <p>
              Todos los contenidos de la Plataforma (textos, imágenes, logotipos, diseño) son propiedad de Seoul Kims
              o de sus licenciantes, y están protegidos por las leyes de propiedad intelectual de Chile.
              Queda prohibida su reproducción sin autorización expresa.
            </p>
          </section>

          <section>
            <h2 className="font-headline font-bold text-base mb-3" style={{ opacity: 1 }}>7. Limitación de responsabilidad</h2>
            <p>
              Seoul Kims no será responsable por daños indirectos, incidentales o consecuentes derivados del uso
              o imposibilidad de uso de la Plataforma. La responsabilidad total de Seoul Kims frente a un cliente
              no podrá exceder el valor del pedido involucrado.
            </p>
          </section>

          <section>
            <h2 className="font-headline font-bold text-base mb-3" style={{ opacity: 1 }}>8. Legislación aplicable y jurisdicción</h2>
            <p>
              Los presentes Términos se rigen por las leyes de la República de Chile.
              Cualquier controversia derivada será sometida a los Tribunales de Justicia de Viña del Mar,
              Región de Valparaíso, con renuncia expresa a cualquier otro fuero que pudiera corresponder.
            </p>
          </section>

          <section>
            <h2 className="font-headline font-bold text-base mb-3" style={{ opacity: 1 }}>9. Modificaciones</h2>
            <p>
              Seoul Kims se reserva el derecho de modificar estos Términos en cualquier momento.
              Las modificaciones serán notificadas a los usuarios registrados por correo electrónico
              con al menos 10 días de anticipación. El uso continuado de la Plataforma tras la notificación
              implica la aceptación de los términos modificados.
            </p>
          </section>

          <section>
            <h2 className="font-headline font-bold text-base mb-3" style={{ opacity: 1 }}>10. Contacto</h2>
            <p>Para consultas sobre estos Términos, contáctanos en:</p>
            <ul className="mt-2 space-y-1 pl-4 list-disc">
              <li>Correo electrónico: contacto@seoulshop.cl</li>
              <li>WhatsApp: +56 9 3645 1991</li>
              <li>Viña del Mar, Región de Valparaíso, Chile</li>
            </ul>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t text-center" style={{ borderColor: 'var(--color-border-editorial)' }}>
          <p className="font-korean font-bold" style={{ color: 'var(--color-celadon)' }}>감사합니다</p>
          <p className="font-body text-xs mt-1" style={{ color: 'var(--color-heuk)', opacity: 0.35 }}>
            Seoul Kims · Viña del Mar · Chile
          </p>
        </div>
      </div>
    </div>
  )
}
