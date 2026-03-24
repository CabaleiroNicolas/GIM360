# Auditoria de Codigo — GYM360

**Fecha:** 23 de marzo de 2026
**Alcance:** Codigo completo del repositorio (backend, frontend, infraestructura, seguridad, base de datos)

---

## Resumen Ejecutivo

| Severidad | Cantidad | Estado requerido |
|-----------|----------|------------------|
| CRITICA   | 2        | Corregir antes de produccion |
| ALTA      | 3        | Corregir antes de produccion |
| MEDIA     | 11       | Planificar correccion |
| BAJA      | 10       | Mejora futura |

**Total: 26 hallazgos** *(13 resueltos desde auditoría inicial)*

---

## CRITICOS (Bloquean produccion)

### SEC-01 — AUTH_SECRET debil
- **Archivo:** `.env.local`
- **Descripcion:** AUTH_SECRET es `SECRETO_DE_PRUEBA`, un string predecible. NextAuth v5 lo usa para firmar JWTs.
- **Impacto:** Cualquier persona puede forjar tokens de sesion validos y acceder como cualquier usuario.
- **Solucion:** Generar con `openssl rand -base64 32` y almacenar en secret manager.

### SEC-02 — Credenciales expuestas en .env.local
- **Archivo:** `.env.local`
- **Descripcion:** DATABASE_URL con credenciales de Supabase y SUPABASE_SERVICE_ROLE_KEY estan en el archivo. Si el repo es publico o se filtra, toda la base de datos queda expuesta.
- **Impacto:** Acceso total a la base de datos y storage de Supabase.
- **Solucion:** Verificar que `.env.local` esta en `.gitignore`, rotar todas las credenciales, usar variables de entorno del hosting.

---

## ALTA (Corregir antes de produccion)

### SEC-07 — Sin rate limiting en API
- **Archivos:** Todos los route handlers en `app/api/`
- **Descripcion:** Ningun endpoint tiene rate limiting. Login, pagos, y consultas pueden ser atacados sin limite.
- **Impacto:** Ataques de fuerza bruta, DoS, extraccion masiva de datos.
- **Solucion:** Implementar rate limiting con Upstash Redis o middleware similar.

### SEC-10 — Credenciales hardcodeadas en scripts de seed
- **Archivos:** `scripts/seed.ts`, `scripts/seed-dev.ts`
- **Descripcion:** Email y password en texto plano (`admin@gym360.com / admin1234`). El guard de `NODE_ENV === "production"` fue agregado, pero las credenciales siguen hardcodeadas en codigo fuente.
- **Impacto:** Si el seed se ejecuta en produccion por error, existen credenciales conocidas en el sistema.
- **Solucion:** Leer email/password desde variables de entorno en lugar de hardcodearlos.

### DEPLOY-01 — Sin configuracion de deployment
- **Archivo:** Raiz del proyecto
- **Descripcion:** No existe Dockerfile, vercel.json, docker-compose.yml, ni pipeline CI/CD (.github/workflows).
- **Impacto:** Deployment manual propenso a errores. Sin tests automatizados en PRs.
- **Solucion:** Crear pipeline CI/CD con build + type check + lint + tests.

---

## MEDIA (Planificar correccion)

### SEC-11 — Upload de archivos sin verificacion de contenido
- **Archivo:** `app/api/students/[id]/files/route.ts` ~linea 49
- **Descripcion:** La validacion de tipo usa `file.type` (header controlado por el cliente). No se verifican magic bytes del archivo real. Sin limite de almacenamiento por gimnasio.
- **Solucion:** Validar contenido real del archivo. Agregar quota de storage.

### SEC-12 — Rol RECEPTIONIST sin modelo de asignacion a gimnasio
- **Archivos:** Route handlers de payments
- **Descripcion:** RECEPTIONIST puede acceder a pagos con `gymBelongsToUser`, pero el modelo no tiene concepto de a que gimnasio pertenece un receptionist. El check es contra el owner, no contra el receptionist.
- **Solucion:** Definir modelo de asignacion gym-receptionist o usar belongs check especifico.

### PERF-01 — Sin paginacion en endpoints de listado
- **Archivos:** Todos los GET de listado (`/api/students`, `/api/payments`, `/api/groups`, etc.)
- **Descripcion:** Todos los endpoints devuelven TODOS los registros sin limite ni paginacion.
- **Impacto:** Con 1000+ registros, respuestas lentas y alto uso de memoria.
- **Solucion:** Implementar paginacion con cursor o offset. Limite default de 50-100 items.

### PERF-02 — Sin debounce en busqueda
- **Archivos:** Todas las vistas con SearchToolbar
- **Descripcion:** El filtrado se recalcula en cada keystroke. Con datasets grandes causa lag visible, especialmente en mobile.
- **Solucion:** Agregar debounce de 300ms al input de busqueda.

### PERF-03 — Sin memoizacion en datos derivados
- **Archivos:** `GroupsView.tsx`, `PaymentsView.tsx`, `StudentsView.tsx`, etc.
- **Descripcion:** Variables como `totalStudents`, `displayed`, `collected`, `pending` se recalculan en cada render aunque sus dependencias no cambien.
- **Solucion:** Usar `useMemo` para computaciones derivadas costosas.

### PERF-04 — Consultas N+1 en metricas de grupos
- **Archivo:** `modules/metrics/groups/groups-metrics.service.ts` ~linea 75
- **Descripcion:** Carga todos los grupos con relaciones anidadas y todos los pagos en memoria. Para gimnasios grandes, esto es ineficiente.
- **Solucion:** Usar agregaciones SQL o queries mas selectivas.

### UX-03 — Mensajes de error inconsistentes
- **Archivos:** Multiples vistas
- **Descripcion:** Los mensajes de error varian en tono y especificidad: "No se pudieron cargar los gastos" vs "Error al crear el gasto" vs "Error de conexion". El usuario no puede distinguir el tipo de error.
- **Solucion:** Estandarizar mensajes de error por categoria (red, validacion, servidor).

### UX-04 — Touch targets < 44px en mobile
- **Archivos:** `DataTable.tsx`, botones variant="link"
- **Descripcion:** Botones de accion en tablas tienen altura de ~24px. WCAG AA requiere minimo 44px.
- **Solucion:** Agregar padding minimo a botones interactivos en tablas.

### DB-02 — Sin validacion de precision decimal en Zod
- **Archivo:** `modules/payments/payments.schema.ts`
- **Descripcion:** Montos usan `z.number().positive()` sin limitar decimales. El frontend puede enviar `1.999999` que la DB trunca silenciosamente.
- **Solucion:** Agregar `.multipleOf(0.01)` o transformacion para redondear a 2 decimales.

### DB-03 — Inconsistencia de idioma en enums
- **Archivo:** `prisma/schema.prisma`
- **Descripcion:** `GymStatus` fue migrado a ingles (`ACTIVE`, `INACTIVE`, `SUSPENDED`), pero `StudentStatus` (`ACTIVO`, `INACTIVO`, `PRUEBA`) y `PaymentMethod` (`EFECTIVO`, `TRANSFERENCIA`, `TARJETA`) siguen en espanol.
- **Solucion:** Completar la estandarizacion al ingles en los enums restantes.

### LOG-01 — Sin logging estructurado ni audit trail
- **Archivos:** Todos los route handlers
- **Descripcion:** No hay logging de operaciones sensibles (pagos, eliminaciones, cierres de caja). Solo un `console.error` en upload de archivos.
- **Impacto:** Imposible auditar quien hizo que. No hay trazabilidad financiera.
- **Solucion:** Implementar logging estructurado (Pino/Winston) con registro de operaciones criticas.

---

## BAJA (Mejora futura)

### API-01 — Sin versionado de API
- **Archivos:** `app/api/`
- **Descripcion:** Sin prefijo `/api/v1/`. Cambios breaking afectaran todos los clientes.
- **Solucion:** Planificar versionado antes de lanzar app mobile.

### API-02 — Falta GET /api/trainers/[id]
- **Archivo:** `app/api/trainers/[id]/route.ts`
- **Descripcion:** Solo implementa PATCH y DELETE. No hay forma de obtener un trainer individual.
- **Solucion:** Agregar handler GET.

### DB-04 — Sin indice en TrainerGroup FK
- **Archivo:** `prisma/schema.prisma`
- **Descripcion:** TrainerGroup y StudentGroup podrian beneficiarse de indices compuestos adicionales.
- **Solucion:** Agregar `@@index` en FK de tablas de juncion.

### DB-05 — Sin validacion de rol en Trainer.userId
- **Archivo:** `prisma/schema.prisma` ~linea 115
- **Descripcion:** Si `userId` esta seteado en un Trainer, no hay validacion de que el User tenga rol TRAINER. Un OWNER podria ser asignado como trainer.
- **Solucion:** Agregar validacion en el servicio de creacion de trainers.

### VAL-01 — Validacion de horarios inconsistente
- **Archivo:** `modules/schedules/schedules.schema.ts`
- **Descripcion:** No valida que `startTime < endTime` con `.refine()`, a diferencia de otros schemas que si lo hacen.
- **Solucion:** Agregar refinamiento de orden temporal.

### VAL-02 — Sin validacion de formato de telefono
- **Archivos:** `modules/students/students.schema.ts`
- **Descripcion:** El campo phone acepta cualquier string. No valida formato de telefono para funcionalidad WhatsApp.
- **Solucion:** Agregar regex o validacion de formato telefono argentino/internacional.

### VAL-03 — Sin validacion de query params con Zod
- **Archivos:** Multiples route handlers
- **Descripcion:** Query params como `gymId`, `period`, `studentId` se obtienen con `searchParams.get()` sin validacion Zod.
- **Solucion:** Crear schemas para query params.

### TEST-01 — Sin tests automatizados
- **Archivo:** Raiz del proyecto
- **Descripcion:** No hay framework de testing configurado. Sin tests unitarios, de integracion ni e2e. package.json no tiene script `test`.
- **Solucion:** Configurar Vitest + Testing Library. Priorizar tests en: auth, belongs, servicios financieros.

### UX-06 — Input de archivo no se resetea al reseleccionar
- **Archivo:** `StudentsView.tsx` ~linea 520
- **Descripcion:** Si el usuario selecciona un archivo, y luego intenta seleccionar el mismo archivo, el evento `onChange` no se dispara porque el value del input no cambio.
- **Solucion:** Resetear `e.target.value = ""` despues de capturar el archivo.

### SEC-13 — CSRF dependiente de SameSite cookies
- **Archivos:** Todos los endpoints mutantes
- **Descripcion:** No hay tokens CSRF explicitos. Se depende de la proteccion de NextAuth via cookies SameSite.
- **Solucion:** Verificar configuracion de SameSite y documentar la decision.

---

## Plan de Accion Recomendado

### Fase 1 — Seguridad critica (antes de produccion)
1. Rotar credenciales de Supabase y DB
2. Generar AUTH_SECRET seguro
3. Implementar rate limiting
4. Mover credenciales de seed a variables de entorno

### Fase 2 — Estabilidad (primera semana)
1. Configurar CI/CD pipeline
2. Agregar Vitest + primeros tests (auth, belongs, payments)
3. Implementar logging estructurado

### Fase 3 — Calidad (primeras dos semanas)
1. Implementar paginacion en API
2. Agregar debounce en busquedas
3. Memoizacion de datos derivados
4. Completar estandarizacion de enums al ingles (DB-03)
5. Validacion de precision decimal en Zod (DB-02)

### Fase 4 — Mejoras continuas
1. Estandarizacion de mensajes de error
2. Versionado de API
3. Modelo de asignacion gym-receptionist
4. Touch targets mobile (WCAG)
