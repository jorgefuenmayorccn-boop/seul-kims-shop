# SEUL KING OS v1.0 — Manual del Cliente

**Seoul Kims** · Viña del Mar, Chile
**Versión del sistema:** v1.0 · **Fecha de entrega:** 2 de septiembre de 2026

---

## Índice

1. [Qué es SEUL KING OS — Misión y Visión](#1-qué-es-seul-king-os--misión-y-visión)
2. [Proyección a futuro](#2-proyección-a-futuro)
3. [Guía de uso — SEUL SHOP (la tienda online)](#3-guía-de-uso--seul-shop-la-tienda-online)
4. [Guía de uso — SEUL KING OS (el panel administrativo)](#4-guía-de-uso--seul-king-os-el-panel-administrativo)
5. [Guía de uso — SEUL POS (la caja)](#5-guía-de-uso--seul-pos-la-caja)
6. [Guía de uso — SEUL DRIVE (el repartidor)](#6-guía-de-uso--seul-drive-el-repartidor)
7. [Cómo se crean los usuarios del sistema](#7-cómo-se-crean-los-usuarios-del-sistema)
8. [Checklist de entrega](#8-checklist-de-entrega)

---

## 1. Qué es SEUL KING OS — Misión y Visión

Seoul Kims es una tienda de productos coreanos en Viña del Mar. Antes de este sistema, operar el negocio significaba coordinar varias piezas sueltas al mismo tiempo: un cuaderno o una caja registradora aparte para las ventas del mostrador, mensajes de WhatsApp para los pedidos, una planilla para el inventario, y ninguna forma centralizada de saber, en un momento dado, cuánto se vendió hoy, qué se está por vencer, o dónde está un pedido que salió a domicilio.

**SEUL KING OS v1.0 es el sistema operativo completo de Seoul Kims.** No es una caja registradora ni una página web sueltas — es una sola plataforma que conecta todo el ciclo del negocio: la venta en el mostrador, la tienda online, el inventario con sus fechas de vencimiento, la preparación de cada pedido, el despacho a domicilio, y el control de caja al final del turno. Todo vive en un mismo lugar, con la misma información, vista en tiempo real desde cuatro aplicaciones distintas según quién la esté usando — el dueño, la cajera, o el repartidor.

**La misión del sistema es simple: que Seoul Kims pueda operar como una tienda moderna, sin depender de papel, de sistemas sueltos que no se hablan entre sí, ni de la memoria de una sola persona.** Cada venta, cada pedido y cada movimiento de caja queda registrado automáticamente, disponible para revisión en cualquier momento — hoy, mañana, o dentro de un año.

**La visión es que este sistema crezca junto con el negocio.** Lo que se entrega en esta versión (v1.0) ya cubre la operación diaria completa: vender en mostrador, vender online, preparar comandas, despachar pedidos, controlar turnos de caja, gestionar inventario y usuarios, y mantener un registro de auditoría de todo lo que ocurre. Es una base sólida sobre la que se pueden construir las siguientes etapas sin tener que rehacer nada de lo ya construido.

---

## 2. Proyección a futuro

SEUL KING OS v1.0 está diseñado para crecer. Estas son las direcciones naturales que ya están contempladas en el sistema:

- **Boleta electrónica del Servicio de Impuestos Internos (SII).** Hoy, cada venta en la caja emite una **Nota de Venta** — un comprobante de compra válido para el cliente, pero que no reemplaza la boleta electrónica oficial. En la siguiente etapa, el sistema se conectará con el Servicio de Impuestos Internos para emitir boletas electrónicas oficiales de forma automática en cada venta, sin cambiar la forma en que la cajera cobra hoy.

- **Fidelización y promociones.** El sistema ya tiene preparado el terreno para un programa de puntos por compra y para códigos de descuento en la tienda online. Es una funcionalidad pensada para una versión futura (v1.1), una vez que el dueño defina las reglas del programa (cuántos puntos por compra, qué descuentos ofrecer, etc.).

- **Más automatización en despacho.** Hoy el despacho a repartidores externos (como Rappi) se registra manualmente desde el panel. A futuro, esto puede conectarse directamente con esos servicios para que la asignación sea automática.

- **Crecimiento del portal mayorista (B2B).** El portal para clientes mayoristas ya permite ver catálogo con precios especiales, solicitar línea de crédito y revisar el estado de cuenta. El siguiente paso natural es permitir que el propio cliente mayorista arme y confirme su pedido directamente desde el portal, sin tener que coordinarlo por WhatsApp.

- **Módulo de clientes (CRM) más completo.** El sistema ya tiene la base para un historial completo de cada cliente — sus compras, sus datos de contacto, su relación con la tienda — que puede profundizarse con el tiempo.

Ninguna de estas etapas requiere reconstruir el sistema actual: todas están pensadas como una extensión de lo que ya funciona hoy.

---

## 3. Guía de uso — SEUL SHOP (la tienda online)

**SEUL SHOP** es la tienda online de Seoul Kims, donde cualquier persona puede ver el catálogo completo y comprar sin necesidad de ir físicamente a la tienda.

### Cómo compra un cliente

1. **Explorar el catálogo.** El cliente entra a la tienda y puede ver todos los productos disponibles, organizados por categoría, con su precio, su foto y su descripción. Puede usar el buscador para encontrar un producto específico.
2. **Agregar productos al carrito.** Desde cada ficha de producto, el cliente elige la cantidad y la agrega a su carrito de compra.
3. **Elegir cómo recibir el pedido.** En el checkout (pantalla de pago), el cliente elige entre cuatro formas de entrega:
   - **Rappi Express** — entrega rápida (30 a 60 minutos) en Viña del Mar, Reñaca y Concón.
   - **Retiro en Metro Merval** — gratis, el cliente elige la estación y el horario de retiro.
   - **Retiro en tienda** — gratis, el cliente pasa directamente a buscar su pedido a la tienda.
   - **Despacho a regiones** — a través de una empresa de envíos, para clientes fuera de Viña del Mar (no disponible para productos que requieren cadena de frío).
4. **Completar sus datos y confirmar.** El cliente puede comprar como invitado (solo dejando su nombre y datos de contacto) o, si ya tiene una cuenta, comprar directamente con sus datos guardados. Al confirmar, el pedido queda registrado en el sistema y llega automáticamente a la pantalla de Comandas de la tienda para su preparación.

### Cómo un cliente crea una cuenta

Un cliente puede registrarse con su nombre, correo y contraseña desde la sección "Mi cuenta". Al registrarse, acepta los Términos y la Política de Privacidad del negocio. Una vez registrado, sus próximas compras quedan asociadas a su cuenta automáticamente.

### Cómo un cliente ve sus pedidos

Desde "Mi cuenta → Mis pedidos", un cliente registrado puede ver el historial completo de todo lo que ha comprado en la tienda, con el estado de cada pedido.

### Portal mayorista (B2B)

Seoul Kims también atiende a clientes mayoristas (almacenes, restaurantes, otros negocios) a través de un portal separado dentro de la misma tienda:

- Una empresa se registra indicando su razón social y RUT.
- Una vez aprobada, accede a un **catálogo con precios mayoristas especiales**, distintos a los precios de venta al público.
- Puede **solicitar una línea de crédito** para pagar sus pedidos a plazo.
- Puede revisar su **estado de cuenta** (saldo disponible, movimientos) en cualquier momento.
- Hoy, el pedido mayorista en sí se coordina por WhatsApp una vez revisado el catálogo — el portal muestra el catálogo y gestiona el crédito, pero la confirmación final del pedido es manual (ver sección de Proyección a futuro para la evolución de esto).

---

## 4. Guía de uso — SEUL KING OS (el panel administrativo)

**SEUL KING OS** es el panel administrativo desde donde el dueño y su equipo controlan todo el negocio. Es la torre de control de la operación diaria.

### Dashboard (Panel principal)

Al ingresar, lo primero que se ve es el Dashboard: un resumen del estado del negocio en este momento — pedidos activos, alertas de productos por vencer, y otros indicadores clave. Es el punto de partida para saber "cómo está la tienda hoy" de un solo vistazo.

### Productos

Desde aquí se administra el catálogo completo:
- **Ver todos los productos** con su precio, categoría y stock.
- **Crear un producto nuevo** — nombre, precio, categoría, código de barras, y sus fotos.
- **Editar un producto existente** — incluyendo su precio (cada cambio de precio queda registrado en la Auditoría, ver más abajo).

### Inventario

Muestra el stock real de cada producto, organizado en lotes con su fecha de vencimiento. El sistema usa un semáforo de colores (verde, amarillo, rojo) para avisar qué productos están por vencer, para que nada se eche a perder sin que nadie se dé cuenta. También se puede filtrar por categoría, por productos que requieren cadena de frío, o por elegibilidad para pago con Tarjeta Nacional Estudiantil (BAES).

### Comandas

Es el tablero donde se ve cada pedido nuevo — venga de la caja, de la tienda online o de un mayorista — y su estado de preparación: **Nueva → Preparando → Lista**. El personal mueve cada pedido de una columna a otra a medida que avanza en su preparación. Esta misma información también está disponible dentro de SEUL POS para que la cajera no tenga que salir de la caja para verla.

### Despacho

Desde aquí se asignan los pedidos que van a domicilio a un repartidor. Se puede:
- Ver todos los pedidos pendientes de despacho.
- Asignar un repartidor propio (que use SEUL DRIVE) a un pedido.
- Registrar un despacho hecho por un servicio externo como Rappi.
- Revisar las liquidaciones de pago de cada repartidor por su turno de trabajo.

### Turnos

Muestra el historial de todos los turnos de caja abiertos y cerrados — quién los abrió, cuándo, y con qué resultado. Es el respaldo de control de caja de toda la operación.

### Clientes

Un listado de los clientes del negocio, como base para futuras funciones de relación con el cliente (fidelización, historial de compras, etc. — ver Proyección a futuro).

### B2B Crédito

Aquí el dueño revisa y aprueba (o rechaza) las solicitudes de línea de crédito que hacen los clientes mayoristas desde el portal B2B.

### Usuarios

Solo visible para el dueño (rol **Owner**). Desde aquí se administra quién tiene acceso al sistema:
- **Crear un usuario nuevo** — se le asigna un nombre, correo y rol (ver sección 7 para el detalle del proceso).
- **Editar el rol** de un usuario existente.
- **Desactivar un usuario** — su cuenta queda inhabilitada pero su historial de acciones se conserva (no se borra nada, solo se le quita el acceso).

### Seguridad

Solo visible para el dueño. Reúne todo lo relacionado con el cumplimiento de la Ley de Protección de Datos Personales (Ley 21.719):
- Solicitudes de acceso, rectificación, cancelación u oposición de datos personales (derechos ARCOP) que haga cualquier persona, con el plazo legal de respuesta visible.
- Devoluciones de productos en curso.
- El PIN maestro que autoriza anular una venta en la caja (ver sección 5).

### Auditoría

Solo visible para el dueño. Es el registro histórico de todo lo importante que ha ocurrido en el sistema: quién creó o editó un usuario, quién cambió un precio, quién modificó una configuración sensible. Cada entrada muestra quién hizo qué y cuándo — es la trazabilidad completa del sistema, y no se puede editar ni borrar.

### Ajustes

Solo visible para el dueño y administradores. Aquí se configuran los datos operativos del negocio: el punto de retiro en Metro Merval, los datos de la tienda que aparecen en el comprobante impreso, el número de WhatsApp de contacto, y el PIN de acceso al historial de ventas en caja.

---

## 5. Guía de uso — SEUL POS (la caja)

**SEUL POS** es el punto de venta que usa la cajera en el mostrador de la tienda, diseñado para pantalla táctil.

### Abrir turno y caja

Al empezar el día, la cajera debe:
1. **Iniciar sesión** con su usuario y contraseña.
2. **Abrir su turno** — queda registrado quién está trabajando y desde qué hora.
3. **Abrir la caja** — se ingresa el monto de dinero con el que se empieza (fondo inicial). Recién en este punto la pantalla principal de venta queda disponible.

### Cobrar una venta

La cajera agrega los productos al pedido (escaneando el código de barras o buscándolos manualmente), confirma la forma de pago, y cobra. Al confirmar, el sistema emite automáticamente una **Nota de Venta** — el comprobante de la compra — que se imprime o se muestra para el cliente. (La boleta electrónica oficial del SII llega en una etapa posterior, ver sección 2.)

Si un producto es elegible para pago con Tarjeta Nacional Estudiantil (BAES), el sistema separa automáticamente el monto que corresponde a ese beneficio del resto del pago.

### Ver y gestionar comandas

Desde el botón "Comandas" en la caja, la cajera puede ver todos los pedidos entrantes (de la tienda online, por ejemplo) sin tener que salir de la pantalla de venta, y avanzar cada uno por su estado de preparación hasta que esté listo.

### Anular una venta

Si es necesario anular una venta ya cobrada, la cajera abre el historial de ventas, selecciona la venta, e ingresa el **PIN maestro** (el mismo que el dueño configura y controla desde Seguridad, en el panel administrativo). Sin ese PIN, ninguna venta puede anularse — es la protección contra anulaciones no autorizadas. Cada anulación queda registrada en la Auditoría.

### Cerrar caja

Al finalizar el turno, la cajera cierra la caja. El sistema genera un resumen (informe Z) con el total vendido, desglosado por forma de pago, para cuadrar el dinero físico contra lo que el sistema registró.

---

## 6. Guía de uso — SEUL DRIVE (el repartidor)

**SEUL DRIVE** es la aplicación que usa el repartidor propio de Seoul Kims para gestionar sus entregas a domicilio, pensada para usarse desde el celular.

### Ver mis entregas

Al iniciar sesión, el repartidor ve dos pestañas:
- **Activos** — las entregas que tiene pendientes en este momento.
- **Historial** — las entregas que ya completó o que no pudo completar.

### Aceptar una entrega

Cuando el panel administrativo le asigna un nuevo pedido, el repartidor recibe una alerta al instante en su pantalla (sin necesidad de recargar la aplicación) y puede aceptar el viaje con un botón.

### Marcar el progreso de la entrega

El repartidor va actualizando el estado de la entrega a medida que avanza: **Asignado → Listo para recoger → En camino → Entregado**. Mientras la entrega está en camino, la aplicación comparte automáticamente la ubicación del repartidor, para que se pueda hacer seguimiento del recorrido.

### Confirmar la entrega con foto

Al llegar al destino, el repartidor puede subir una **foto de comprobante** (por ejemplo, del pedido entregado en la puerta) antes de marcar la entrega como completada. Esto queda guardado como respaldo de que la entrega se realizó correctamente.

### Reportar un problema

Si una entrega no se pudo completar (dirección no encontrada, cliente ausente, etc.), el repartidor puede reportar la falla directamente desde la aplicación, en vez de dejarla sin resolver.

---

## 7. Cómo se crean los usuarios del sistema

El acceso a **SEUL KING OS**, **SEUL POS** y **SEUL DRIVE** está restringido — solo puede entrar quien tenga una cuenta creada por el dueño del negocio. Así funciona el proceso, de principio a fin:

1. **El dueño (rol Owner) crea el usuario nuevo** desde SEUL KING OS → Usuarios, indicando su nombre, correo electrónico y rol (Owner, Administrador, Cajero/a, Repartidor, o Solo lectura, según lo que esa persona necesite ver y hacer).
2. **El sistema genera una contraseña temporal** de forma automática y se la envía a esa persona por correo electrónico, junto con sus datos de acceso.
3. **En su primer ingreso**, la persona inicia sesión con esa contraseña temporal, y el sistema le **exige obligatoriamente crear una contraseña nueva y propia** antes de dejarla continuar. La contraseña temporal deja de servir después de ese primer cambio.
4. **Desde ese momento**, esa persona entra normalmente con su correo y su propia contraseña — en SEUL KING OS si es personal administrativo, en SEUL POS si es cajero/a, o en SEUL DRIVE si es repartidor (el mismo usuario puede tener acceso a más de una aplicación, según su rol).

Los roles disponibles y lo que cada uno puede ver:

| Rol | Qué puede hacer |
|---|---|
| **Owner (Dueño)** | Acceso completo a todo el sistema, sin restricciones. |
| **Administrador** | Acceso a toda la operación diaria, excepto Usuarios y Seguridad. |
| **Cajero/a (Staff)** | Solo Comandas, Despacho, Turnos y Clientes, más SEUL POS. |
| **Repartidor** | Solo SEUL DRIVE — no tiene acceso al panel administrativo. |
| **Solo lectura** | Solo puede ver el Dashboard, sin poder modificar nada. |

Si en algún momento una persona deja de trabajar en el negocio, el dueño la **desactiva** desde Usuarios — su acceso se corta de inmediato, pero su historial de acciones pasadas se conserva en la Auditoría (no se borra nada, por trazabilidad).

---

## 8. Checklist de entrega

Esto es lo que Seoul Kims recibe con SEUL KING OS v1.0, verificado y funcionando en un navegador real antes de la entrega:

- [x] **SEUL SHOP** (tienda online) — catálogo, ficha de producto, carrito, checkout como invitado o con cuenta, registro y login de cliente, historial de pedidos.
- [x] **SEUL KING OS** (panel administrativo) — Dashboard, Productos (crear/editar), Inventario, Comandas, Despacho, Turnos, Clientes, B2B Crédito, Usuarios, Seguridad, Auditoría, Ajustes.
- [x] **SEUL POS** (caja) — apertura de turno y caja, cobro de venta con emisión de Nota de Venta, comandas dentro de caja, anulación de venta con PIN, cierre de caja con informe Z.
- [x] **SEUL DRIVE** (repartidor) — mis entregas, aceptar viaje, actualización de estado en vivo, ubicación en tiempo real, foto de comprobante de entrega, reporte de fallas.
- [x] **Portal mayorista (B2B)** — registro de empresa, catálogo con precios especiales, solicitud de línea de crédito, estado de cuenta.
- [x] **Comprobante de venta (Nota de Venta)** — funcionando en cada venta de caja y en cada pedido de la tienda online, con aviso claro de que no es un documento tributario, a la espera de la conexión con el Servicio de Impuestos Internos en la siguiente etapa.
- [x] **Registro de auditoría** — trazabilidad completa de las acciones sensibles del sistema (usuarios, precios, configuración).
- [x] **Un único usuario administrador activo entregado al cierre**, listo para que el dueño real de Seoul Kims cree las cuentas de su equipo desde cero.

### Soporte post-entrega

VÉRTICE Productions acompaña la puesta en marcha de SEUL KING OS v1.0 con un período de soporte de **30 días** desde la entrega, para resolver cualquier duda o incidencia que surja durante las primeras semanas de uso real del sistema.

---

*Creado por VÉRTICE Productions*
