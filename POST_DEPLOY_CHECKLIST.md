# ✅ POST-DEPLOY CHECKLIST — SEUL KING OS v1.0

**Fecha de Deploy:** 2026-08-26  
**Dominio:** seoulshop.cl  
**Estado:** DESPLEGANDO

---

## 🔗 URLs DESPLEGADAS

Validar que cada URL está en línea y responde correctamente:

### Frontend Apps (Vercel)

- [ ] **SEUL SHOP** — https://seoulshop.cl
  - [ ] Carga página home
  - [ ] Productos visibles
  - [ ] Carrito funciona
  
- [ ] **SEUL POS** — https://pos.seoulshop.cl
  - [ ] Página login carga
  - [ ] Responsivo en tablet (10")
  - [ ] Botones accesibles
  
- [ ] **SEUL DRIVE** — https://drive.seoulshop.cl
  - [ ] Página login carga
  - [ ] PWA instalable
  - [ ] Funciona en mobile
  
- [ ] **SEUL KING OS (Cerebro)** — https://cmr.seoulshop.cl
  - [ ] Página login carga
  - [ ] Dashboard accesible
  - [ ] Sidebar visible

### API Gateway (Cloudflare Workers)

- [ ] **API** — https://api.seoulshop.cl/health
  - [ ] Endpoint `/health` responde 200
  - [ ] Logs visibles en Cloudflare
  - [ ] Workers está activo

---

## 🔐 LOGIN & USUARIOS

Validar acceso con credenciales iniciales:

### ROOT ADMIN (Dueño)
```
Email:      founder@seoulkims.cl
Contraseña: e3c4749c2bbd1f1d2b699c0af8272a10
URL:        https://cmr.seoulshop.cl/login
```

**Tests:**
- [ ] Acceder a https://cmr.seoulshop.cl/login
- [ ] Ingresar email + contraseña
- [ ] Sistema pide cambiar contraseña (obligatorio)
- [ ] Redirige a dashboard después
- [ ] Settings → Usuarios muestra opción crear usuario
- [ ] Crear usuario test da opción
- [ ] Guardar nueva contraseña en gestor

### STAFF ADMIN (Administradora)
```
Email:      gerente@seoulkims.cl
Contraseña: 5d63cc31206b84ddef421d9efb67e6e9
URL:        https://cmr.seoulshop.cl/login
```

**Tests:**
- [ ] Acceder con gerente@seoulkims.cl
- [ ] Ingresar a dashboard
- [ ] Settings → Usuarios NO muestra opción crear
- [ ] Puede ver inventario
- [ ] Puede ver órdenes

---

## 🌐 DNS & CLOUDFLARE

Validar configuración DNS en Cloudflare:

- [ ] Zona seoulshop.cl está activa
- [ ] Registros A/CNAME están correctos:
  ```
  @ (raíz)        → 76.76.21.21 (Vercel)
  shop            → cname.vercel-dns.com
  pos             → cname.vercel-dns.com
  drive           → cname.vercel-dns.com
  cmr             → cname.vercel-dns.com
  api             → workers.dev
  ```
- [ ] Certificado SSL activo (Full strict)
- [ ] Proxying habilitado (orange cloud)

**Verificar con nslookup:**
```bash
nslookup seoulshop.cl
nslookup pos.seoulshop.cl
nslookup api.seoulshop.cl
```

---

## 🗄️ DATABASE

Validar conexión y seed:

- [ ] Neon está conectada
- [ ] Base de datos tiene usuarios:
  ```sql
  SELECT email, role, is_active FROM users;
  ```
  Debe mostrar:
  - founder@seoulkims.cl | owner | t
  - gerente@seoulkims.cl | admin | t

- [ ] Tablas principales existen:
  - [ ] `users`
  - [ ] `sessions`
  - [ ] `products`
  - [ ] `orders`
  - [ ] `inventory`

---

## 📊 MONITOREO

Configurar alertas y logging:

### Sentry
- [ ] Proyecto "SEUL KING OS" creado
- [ ] DSN inyectado en apps
- [ ] Test error: `throw new Error('test')`
- [ ] Error aparece en Sentry dashboard

### Cloudflare Logs
- [ ] Ir a Workers → seul-kims-api
- [ ] Tail logs: `wrangler tail`
- [ ] Ver requests entrantes

### Vercel Logs
- [ ] Ir a cada proyecto en Vercel
- [ ] Settings → Logs
- [ ] Verificar builds exitosos

---

## 🔒 SEGURIDAD

Validar configuración de seguridad:

- [ ] HTTPS activo (candado verde)
- [ ] CORS configurado:
  ```bash
  curl -i https://seoulshop.cl
  # Debe incluir headers de seguridad
  ```

- [ ] Rate limiting activo en Cloudflare
- [ ] WAF básico habilitado
- [ ] Contraseñas hasheadas (PBKDF2)

**Test CORS:**
```bash
curl -H "Origin: https://seoulshop.cl" \
     -H "Access-Control-Request-Method: POST" \
     https://api.seoulshop.cl/orders
```

---

## 📱 SMOKE TESTS

Validar flujos críticos:

### SEUL SHOP (Tienda B2C)
- [ ] [ Ver productos en catálogo
- [ ] Agregar producto a carrito
- [ ] Ver carrito
- [ ] Iniciar checkout
- [ ] Llegar a resumen (sin pagar)

### SEUL POS (Caja)
- [ ] Login como admin
- [ ] Abrir turno (si no está abierto)
- [ ] Crear venta test
- [ ] Generar boleta
- [ ] Cerrar turno

### SEUL DRIVE (Repartidor)
- [ ] Login como driver
- [ ] Ver lista de pedidos
- [ ] Marcar pedido en tránsito
- [ ] Actualizar ubicación (GPS mock)
- [ ] Marcar como entregado

### SEUL KING OS (Admin)
- [ ] Login como founder
- [ ] Ir a Inventario
- [ ] Ver productos
- [ ] Ir a Comandas
- [ ] Ver órdenes
- [ ] Ir a Settings

---

## 🚨 TROUBLESHOOTING

Si algo falla:

| Problema | Solución |
|----------|----------|
| DNS no resuelve | Esperar 24-48h propagación. Verificar en Cloudflare DNS. |
| 404 en URLs | Vercel project assignment. Ir a Settings → Domains en cada proyecto. |
| CORS error | Revisar `next.config.mjs` headers. Redeployar. |
| Login falla | Verificar DB seed ejecutado. Revisar Sentry logs. |
| API no responde | Verificar wrangler deploy. Revisar Cloudflare Workers dashboard. |

---

## 📋 SIGN-OFF

Una vez que TODOS los checks estén ✅:

- [ ] Notificar a cliente Seoul Kims
- [ ] Enviar URLs + credenciales
- [ ] Agendar onboarding/training
- [ ] Activar alertas en Sentry
- [ ] Configurar backups BD
- [ ] Documentar incidentes post-launch

---

**Completado por:** _______________  
**Fecha:** _______________  
**Validado por:** _______________  

---

✅ **SEUL KING OS v1.0 — LISTO PARA PRODUCCIÓN**
