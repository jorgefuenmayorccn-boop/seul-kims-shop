# 📧 Entrega — Prueba de los 27 Correos Automáticos (SESSION 20)

**Fecha:** 2026-08-29
**Proyecto:** SEUL KING OS v1.0 — Seoul Kims Viña del Mar (seoulshop.cl)
**Alcance:** Sesión de prueba y limpieza de código. No se construyeron subsistemas de producto nuevos (pagos, inventario, caja, ciclo de vida B2B completo).

---

## 1. Resumen ejecutivo — 27/27 correos de prueba

Se corrigieron los 11 disparadores de correo que ya existían en código, se sembraron los datos mínimos para desbloquear el canal B2B y de entregas, y se construyó un arnés de prueba que dispara los 27 correos documentados en `FASE_2_COMPLETADA.md`. **Los 27 quedaron con `status='sent'` en la tabla `email_queue` de Neon**, verificado de forma independiente (no solo por el output del script).

| # | Categoría | Correo | Tipo | Estado final |
|---|---|---|---|---|
| 1 | B2C | Confirmación de pedido al comprar online | **Real** | ✅ sent |
| 2 | B2C | "Preparando" al entrar en preparación | **Real** | ✅ sent |
| 3 | B2C | "Listo para retiro" | **Real** | ✅ sent |
| 4 | B2C | "Despachado / en ruta" | **Real** | ✅ sent |
| 5 | B2C | "En ruta" con ETA | **Real** | ✅ sent |
| 6 | B2C | Entregado con foto (prueba de entrega) | **Real** | ✅ sent |
| 7 | B2C | Notificación de entrega fallida (al cliente) | Simulado | ✅ sent |
| 8 | B2B | Cotización creada (copia admin) | **Real** | ✅ sent |
| 9 | B2B | Cotización enviada al comprador | **Real** | ✅ sent |
| 10 | B2B | Cotización aceptada | **Real** | ✅ sent |
| 11 | B2B | Cotización rechazada | **Real** | ✅ sent |
| 12 | B2B | Confirmación de orden desde cotización | Simulado | ✅ sent |
| 13 | B2B | Orden B2B en preparación | Simulado | ✅ sent |
| 14 | B2B | Orden B2B despachada | Simulado | ✅ sent |
| 15 | B2B | Orden B2B entregada | Simulado | ✅ sent |
| 16 | B2B | Factura enviada | Simulado | ✅ sent |
| 17 | Driver | Entrega asignada | **Real** | ✅ sent |
| 18 | Driver | Briefing diario (8am) | Simulado | ✅ sent |
| 19 | Driver | Recordatorio de entrega | Simulado | ✅ sent |
| 20 | Driver | Comprobante recibido | Simulado | ✅ sent |
| 21 | Driver | Resumen de jornada | Simulado | ✅ sent |
| 22 | Admin | Alerta pedido grande (≥$2.000.000) | **Real** | ✅ sent |
| 23 | Admin | Alerta entrega fallida | **Real** | ✅ sent |
| 24 | Admin | Problema de pago | Simulado | ✅ sent |
| 25 | Admin | Reporte de ventas diario (11pm) | Simulado | ✅ sent |
| 26 | Admin | Stock bajo | Simulado | ✅ sent |
| 27 | Admin | Efectivo recolectado | Simulado | ✅ sent |

**Real** = el correo lo dispara una ruta HTTP que existe hoy en `packages/api/src/server.ts`.
**Simulado** = no existe el subsistema real detrás (ver Sección 3) — el arnés de prueba llamó directamente al motor de correo con contenido realista, solo para verificar que la tubería Resend → `email_queue` → bandeja de entrada funciona.

**13 de 27 son reales hoy** (11 originales + 2 alertas nuevas agregadas en esta sesión: pedido grande y entrega fallida).

---

## 2. Credenciales de acceso

⚠️ **La documentación previa (`FASE_2_COMPLETADA.md`, `CREDENCIALES_PRODUCCION.md`) tenía usuarios y contraseñas que NO existen en la base de datos real** (`admin@seoulshop.cl`, `cajero.admi@seoulshop.cl`, `founder@seoulkims.cl` — dominio incorrecto). Los únicos 2 usuarios administrativos que existen realmente en la tabla `users` de Neon son:

| Usuario | Email | Rol | Contraseña temporal |
|---|---|---|---|
| Fundador/Dueño | `founder@seoulshop.cl` | `owner` (acceso total) | `Seoul2026!04mQYcs9` |
| Gerente Operacional | `gerente@seoulshop.cl` | `admin` (limitado) | `Seoul2026!bFIEwiKm` |

**El cliente debe cambiar ambas contraseñas en su primer uso.** Las contraseñas anteriores en `users.password_hash` estaban en dos formatos distintos e inconsistentes entre sí (uno parecía bcrypt corrupto, el otro `pbkdf2$sha...`) y no correspondían a ninguna contraseña documentada — se resetearon a hashes bcrypt frescos y verificados.

**URLs:**
- Tienda: https://seoulshop.cl
- Panel admin (Cerebro): https://cmr.seoulshop.cl
- POS: https://pos.seoulshop.cl
- Repartidor: https://drive.seoulshop.cl

⚠️ **No se pudo confirmar login exitoso end-to-end** porque `packages/api/src/server.ts` **no tiene implementado `POST /api/auth/login` ni `GET /api/auth/me`** — las rutas que `apps/cerebro/src/app/login/page.tsx` y `apps/cerebro/src/lib/session.ts` sí esperan. Solo existe `POST /api/auth/register`. Esto es un hallazgo de esta sesión, no algo que se haya intentado arreglar (está fuera del alcance de "probar los 27 correos"), pero **bloquea el login real hasta que se implemente**.

---

## 3. Roadmap pendiente (no implementado hoy)

Los siguientes sistemas quedan fuera de esta entrega — no se construyeron, solo se simuló su disparador de correo para la prueba:

- **Login real** (`POST /api/auth/login`, `GET /api/auth/me`) — bloqueante para que el panel admin funcione en absoluto.
- **Ciclo de vida B2B completo** — conversión de cotización aceptada → orden → preparación → despacho → entrega → factura.
- **Cron jobs** (briefing diario 8am, recordatorios, reporte de ventas 11pm) — el backend corre en Node/Railway, no en Cloudflare Workers, por lo que cualquier cron necesita un mecanismo distinto (ej. Railway cron o un scheduler externo).
- **Integración de pagos** — sin esto, "problema de pago" no puede dispararse de verdad.
- **Gestión de inventario/stock** — sin esto, "stock bajo" no puede dispararse de verdad.
- **Sistema de caja** — sin esto, "efectivo recolectado" no puede dispararse de verdad.
- **Notificación de entrega fallida al cliente** — hoy solo se alerta al admin (email #23); el cliente no es notificado automáticamente.

---

## 4. Cómo auditar esta prueba

Consulta directa a Neon (tabla `email_queue`):

```sql
SELECT email, type, subject, status, created_at
FROM email_queue
ORDER BY created_at DESC
LIMIT 27;
```

Todos deben mostrar `status = 'sent'` y `last_error IS NULL`, con `type` correspondiendo al contenido real del correo (ya no aparece `contact-form-reply` en todo).

---

## 5. Qué cambió en el código (resumen técnico)

- `packages/api/src/db.ts` — nuevo módulo con la conexión Postgres y config de env, extraído de `server.ts`.
- `packages/api/src/email-queue.ts` — nuevo módulo con `enqueueEmail()`, `processEmailQueue()` y los templates HTML, extraído de `server.ts` para reutilizarlo desde el arnés de prueba sin duplicar lógica.
- `packages/api/src/server.ts` — `enqueueEmail()` ahora recibe un `type` real (ya no hardcodea `'contact-form-reply'`); los 11 endpoints devuelven `queue_id`/`queue_ids` en su respuesta JSON; 2 alertas nuevas (pedido grande ≥$2M, entrega fallida a admin); `orderStatus()` acepta `eta` opcional.
- `packages/db/src/schema/email.ts` — enum `email_type` ampliado con 7 valores nuevos (`quote-sent`, `quote-accepted`, `quote-rejected`, `delivery-assigned`, `delivery-failed`, `large-order-alert`, `user-created`).
- `packages/db/src/migrate-0012.ts` — migración que aplicó esos 7 valores al enum en Neon.
- `packages/db/src/migrate-0013.ts` — **fix de bug real**: `b2b_quotes.id` no tenía `DEFAULT gen_random_uuid()` en la tabla viva de Neon (aunque el schema Drizzle sí lo declaraba) — el endpoint de cotizaciones B2B nunca había funcionado por esto. Corregido.
- Datos sembrados: 1 `b2b_companies` (antes 0 filas, bloqueaba todo el canal B2B), 1 usuario con `role='delivery'` (antes 0), 1 `delivery_assignments` de prueba.

### Herramientas de QA interna (NO forman parte del entregable al cliente)

- `packages/api/src/test-harness.ts` — dispara los 27 correos (reales vía HTTP, simulados vía `enqueueEmail()` directo).
- `packages/api/src/run-test-harness.ts` — ejecuta el arnés y hace polling real contra `email_queue`.
- `packages/api/test-all-emails.sh` — script que levanta el servidor local, corre la prueba y lo apaga.

Estos 3 archivos no están conectados a ninguna ruta de `server.ts` — no hay endpoint HTTP expuesto que un cliente o atacante pueda invocar. Solo se ejecutan localmente con acceso a `.dev.vars`. Se documentan aquí para transparencia, pero VÉRTICE recomienda no incluirlos en el paquete final entregado al cliente (o dejarlos claramente marcados como herramienta interna).
