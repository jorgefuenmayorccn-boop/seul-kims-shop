# 🔐 CREDENCIALES PRODUCCIÓN — SEUL KING OS (seoulshop.cl)

**Fecha de generación:** 2026-08-26  
**Proyecto:** Seoul Kims Viña del Mar  
**Dominio:** seoulshop.cl  
**Ambiente:** PRODUCCIÓN

---

## 👤 USUARIOS INICIALES

### 1. ROOT ADMIN (Fundador & Dueño)
```
Email:      founder@seoulkims.cl
Contraseña: e3c4749c2bbd1f1d2b699c0af8272a10
Rol:        owner (ROOT)
Nombre:     Fundador & Dueño Seoul Kims
Acceso:     Creación de usuarios, Configuración del sistema, Total acceso
```

**URL de acceso:** https://cmr.seoulshop.cl/login

### 2. STAFF ADMIN (Gerente Operacional)
```
Email:      gerente@seoulkims.cl
Contraseña: 5d63cc31206b84ddef421d9efb67e6e9
Rol:        admin (STAFF)
Nombre:     Gerente Operacional
Acceso:     Inventario, Órdenes, Reportes (NO crear usuarios)
```

**URL de acceso:** https://cmr.seoulshop.cl/login

---

## ⚠️ INSTRUCCIONES CRÍTICAS

### 1. Ejecutar Seed de Usuarios
```bash
cd /Users/vertice/vertice_productions/seul-kims-os

# Configurar DATABASE_URL (Neon producción)
export DATABASE_URL="postgresql://user:pass@host/dbname"

# Ejecutar seed
npx tsx packages/db/src/seed-production.ts
```

### 2. Primer Login
- [ ] Acceder a https://cmr.seoulshop.cl/login
- [ ] Ingresar credenciales de ROOT ADMIN
- [ ] El sistema pedirá CAMBIAR contraseña (obligatorio)
- [ ] Crear contraseña fuerte personal
- [ ] Guardar en gestor de contraseñas

### 3. Crear Usuarios Adicionales
**SOLO el ROOT ADMIN puede crear usuarios.** Pasos:
1. Login como `founder@seoulkims.cl`
2. Ir a Settings → Usuarios → Crear Usuario
3. Seleccionar rol (admin, staff, delivery, viewer)
4. El sistema genera contraseña temporal
5. Compartir con nuevo usuario

---

## 🔒 SEGURIDAD

✅ **Qué hacer:**
- Guardar credenciales en gestor de contraseñas (1Password, Dashlane, etc.)
- Cambiar contraseña en primer login
- Usar contraseñas fuertes (mínimo 16 caracteres)
- Habilitar 2FA cuando esté disponible
- Auditar accesos regularmente

❌ **NO hacer:**
- Compartir credenciales por email
- Guardar contraseñas en notas o documentos
- Usar la misma contraseña en otros sitios
- Dejar sesión activa sin vigilancia

---

## 📋 CONFIGURACIÓN POST-DEPLOY

Después de desplegar a seoulshop.cl:

### 1. Verificar Acceso
```bash
curl -I https://cmr.seoulshop.cl
# Debe retornar HTTP 200 OK
```

### 2. Verificar Base de Datos
```bash
psql $DATABASE_URL -c "SELECT email, role, is_active FROM users;"
# Debe mostrar:
# founder@seoulkims.cl | owner | t
# gerente@seoulkims.cl | admin | t
```

### 3. Test de Login
- Abrir https://cmr.seoulshop.cl/login
- Ingresar `founder@seoulkims.cl` + contraseña
- Debe redirigir a dashboard
- Cambiar contraseña en Settings → Perfil

### 4. Logs & Monitoreo
- Verificar Sentry para errores
- Verificar Cloudflare para tráfico DNS
- Verificar Vercel para builds exitosos

---

## 🚨 EN CASO DE EMERGENCIA

### Contraseña olvidada
1. No hay "Olvide mi contraseña" en v1.0
2. El ROOT ADMIN debe resetear manualmente
3. Contactar al desarrollador para reset manual en DB

### Cuenta bloqueada (3+ intentos fallidos)
- Esperar 15 minutos (se desbloquea automáticamente)
- O ROOT ADMIN resetea en Settings → Usuarios

### Pérdida total de acceso
- Contactar desarrollador
- Requerir verificación de identidad
- Reset manual de base de datos

---

## 📞 CONTACTO SOPORTE

**Proyecto:** SEUL KING OS v1.0  
**Cliente:** Seoul Kims (@seulshopcl)  
**Período:** 2026-08-26 en adelante  
**Desarrollador:** VÉRTICE Productions

---

**Generado:** 2026-08-26  
**Versión:** 1.0  
**Estado:** LISTO PARA PRODUCCIÓN ✅
