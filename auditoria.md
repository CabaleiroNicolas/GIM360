# Auditoria de Codigo — GYM360

**Fecha:** 23 de marzo de 2026
**Alcance:** Codigo completo del repositorio (backend, frontend, infraestructura, seguridad, base de datos)

---

## Resumen Ejecutivo

| Severidad | Cantidad | Estado requerido |
|-----------|----------|------------------|
| CRITICA   | 6        | Corregir antes de produccion |
| ALTA      | 11       | Corregir antes de produccion |
| MEDIA     | 14       | Planificar correccion |
| BAJA      | 10       | Mejora futura |

**Total: 41 hallazgos**

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

### SEC-03 — Bypass de autorizacion en PATCH /api/payments/[id]
- **Archivo:** `app/api/payments/[id]/route.ts` ~linea 11
- **Descripcion:** El endpoint PATCH permite roles OWNER y RECEPTIONIST pero NO verifica `gymBelongsToOwner`. Solo verifica `paymentBelongsToGym`. Un RECEPTIONIST de un gimnasio puede modificar pagos de CUALQUIER gimnasio conociendo el gymId.
- **Impacto:** Rotura de aislamiento multi-tenant. Modificacion de pagos entre gimnasios.
- **Solucion:** Agregar `gymBelongsToOwner(gymId, session.user.id)` antes del belongs check.

### SEC-04 — Bypass de autorizacion en DELETE /api/payments/[id]
- **Archivo:** `app/api/payments/[id]/route.ts` ~linea 45
- **Descripcion:** Mismo problema que SEC-03 pero para eliminacion. Un OWNER puede eliminar pagos de cualquier gimnasio.
- **Impacto:** Eliminacion de datos financieros de otros gimnasios.
- **Solucion:** Agregar `gymBelongsToOwner` check.

### SEC-05 — Bypass de autorizacion en GET /api/cash-closings/[id]
- **Archivo:** `app/api/cash-closings/[id]/route.ts` ~linea 9
- **Descripcion:** Solo verifica `cashClosingBelongsToGym`, no `gymBelongsToOwner`. Permite acceso a datos financieros de cierres de caja de otros gimnasios.
- **Impacto:** Lectura no autorizada de informacion financiera sensible.
- **Solucion:** Agregar `gymBelongsToOwner` check.

### DB-01 — Cascadas de eliminacion faltantes en schema
- **Archivo:** `prisma/schema.prisma`
- **Descripcion:** Multiples relaciones FK no tienen `onDelete: Cascade`:
  - `Trainer.gym`, `Student.gym`, `Group.gym` — eliminar un gimnasio deja entidades huerfanas
  - `Schedule.group` — eliminar un grupo deja horarios huerfanos
  - `TrainerGroup.trainer/group`, `StudentGroup.student/group` — tablas de juncion sin cascada
- **Impacto:** La eliminacion de gimnasios/grupos/alumnos fallara con errores de constraint FK en produccion.
- **Solucion:** Agregar `onDelete: Cascade` en todas las relaciones que correspondan, o `onDelete: Restrict` donde la eliminacion debe fallar explicitamente.

---

## ALTA (Corregir antes de produccion)

### SEC-06 — Sin headers de seguridad HTTP
- **Archivo:** `next.config.ts`
- **Descripcion:** No hay headers de seguridad configurados: sin CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy.
- **Impacto:** Vulnerable a XSS, clickjacking, MIME sniffing.
- **Solucion:** Agregar headers en `next.config.ts` o middleware.

### SEC-07 — Sin rate limiting en API
- **Archivos:** Todos los route handlers en `app/api/`
- **Descripcion:** Ningun endpoint tiene rate limiting. Login, pagos, y consultas pueden ser atacados sin limite.
- **Impacto:** Ataques de fuerza bruta, DoS, extraccion masiva de datos.
- **Solucion:** Implementar rate limiting con Upstash Redis o middleware similar.

### SEC-08 — Sin configuracion CORS
- **Archivo:** `next.config.ts`
- **Descripcion:** No hay politica CORS. Cualquier sitio web puede hacer requests a la API usando las cookies de sesion.
- **Impacto:** Cross-site request forgery facilitado.
- **Solucion:** Configurar CORS restringido al dominio de la app.

### SEC-09 — Bcrypt con cost factor bajo
- **Archivos:** `lib/auth.ts`, `scripts/seed.ts`, `scripts/seed-dev.ts`
- **Descripcion:** `bcrypt.hash(password, 10)` usa factor de costo 10. El estandar minimo para produccion es 12.
- **Impacto:** Hashing mas rapido facilita ataques de diccionario.
- **Solucion:** Subir a `bcrypt.hash(password, 12)`.

### SEC-10 — Credenciales hardcodeadas en scripts de seed
- **Archivos:** `scripts/seed.ts`, `scripts/seed-dev.ts`
- **Descripcion:** Email y password en texto plano (`admin@gym360.com / admin1234`). Si el seed se ejecuta en produccion, existen credenciales conocidas.
- **Impacto:** Acceso no autorizado con credenciales default.
- **Solucion:** Documentar como dev-only, usar variables de entorno, agregar guard de NODE_ENV.

### BUG-01 — Inconsistencia de timezone en pagos
- **Archivo:** `modules/payments/payments.service.ts` ~lineas 10, 75
- **Descripcion:** `parsePeriod()` crea fechas en UTC (`Date.UTC`), pero `expireOverduePayments()` crea fechas en timezone local (`new Date(year, month-1, ...)`). En servidores con timezone != UTC, las cuotas pueden vencer o no vencer incorrectamente.
- **Impacto:** Pagos vencen en el momento incorrecto dependiendo del timezone del servidor.
- **Solucion:** Usar UTC consistentemente en todas las operaciones de fecha.

### BUG-02 — Aritmetica de punto flotante en montos
- **Archivos:** `modules/cash-closings/cash-closings.service.ts` ~linea 24, `modules/metrics/gym/gym-metrics.service.ts` ~lineas 85-90
- **Descripcion:** Los montos Prisma `Decimal(10,2)` se convierten a `Number` con `Number(p.amount)` y se acumulan con `reduce()`. La aritmetica de punto flotante pierde precision.
- **Impacto:** Discrepancias en totales financieros (ej: 100 pagos de $0.10 = $9.999... en vez de $10.00).
- **Solucion:** Usar una libreria de precision decimal (decimal.js) o acumular en centavos (integers).

### BUG-03 — Fetch sin manejo de errores en todas las vistas
- **Archivos:** `PaymentsView.tsx`, `StudentsView.tsx`, `MetricsView.tsx`, `GroupsView.tsx`, `TrainersView.tsx`, `ExpensesView.tsx`, `dashboard/page.tsx`
- **Descripcion:** Multiples llamadas `fetch()` no tienen `.catch()` ni manejan respuestas de error. Si la API falla, el error se traga silenciosamente. El usuario ve un spinner infinito o datos vacios sin explicacion.
- **Impacto:** UX degradada, imposible diagnosticar problemas. Datos pueden quedar en estado inconsistente.
- **Solucion:** Agregar manejo de errores en todas las llamadas fetch con estado de error visible al usuario.

### BUG-04 — Race conditions en fetch con useEffect
- **Archivo:** `app/(dashboard)/[gymId]/groups/[groupId]/GroupDetailView.tsx` ~linea 64
- **Descripcion:** Si el componente se desmonta mientras un fetch esta pendiente, `setState` se ejecuta sobre un componente desmontado. Falta cleanup con AbortController.
- **Impacto:** Memory leaks, warnings de React en consola.
- **Solucion:** Usar AbortController en useEffect para cancelar fetchs pendientes al desmontar.

### BUG-05 — Mutaciones silenciosas en pagos
- **Archivo:** `app/(dashboard)/[gymId]/payments/PaymentsView.tsx` ~linea 156
- **Descripcion:** `handleMarkPaid` y `handleUnmarkPaid` llaman a la API pero si falla, `setUpdatingId(null)` se ejecuta igual sin mostrar error. El usuario cree que la accion fue exitosa.
- **Impacto:** El usuario marca un pago como pagado, la UI se actualiza pero la DB no. Inconsistencia de datos.
- **Solucion:** Agregar manejo de errores y toast/alerta cuando la mutacion falla.

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
- **Descripcion:** RECEPTIONIST puede acceder a pagos con `gymBelongsToOwner`, pero el modelo no tiene concepto de a que gimnasio pertenece un receptionist. El check es contra el owner, no contra el receptionist.
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

### UX-01 — Sin skeleton loaders
- **Archivos:** Todas las vistas
- **Descripcion:** Las vistas muestran "Cargando..." generico. Sin skeleton screens que den feedback visual de la estructura de la pagina.
- **Solucion:** Implementar skeleton loaders para tablas y cards.

### UX-02 — Sin error boundaries por seccion
- **Archivos:** Todas las vistas bajo `app/(dashboard)/`
- **Descripcion:** Si un componente crashea, se cae toda la vista. Solo existe error.tsx global.
- **Solucion:** Agregar error boundaries por seccion critica o por vista.

### UX-03 — Mensajes de error inconsistentes
- **Archivos:** Multiples vistas
- **Descripcion:** Los mensajes de error varian en tono y especificidad: "No se pudieron cargar los gastos" vs "Error al crear el gasto" vs "Error de conexion". El usuario no puede distinguir el tipo de error.
- **Solucion:** Estandarizar mensajes de error por categoria (red, validacion, servidor).

### UX-04 — Touch targets < 44px en mobile
- **Archivos:** `DataTable.tsx`, botones variant="link"
- **Descripcion:** Botones de accion en tablas tienen altura de ~24px. WCAG AA requiere minimo 44px.
- **Solucion:** Agregar padding minimo a botones interactivos en tablas.

### UX-05 — Tablas sin indicador de scroll horizontal en mobile
- **Archivo:** `components/ui/DataTable.tsx`
- **Descripcion:** Las tablas tienen `overflow-x-auto` pero ningun indicador visual de que hay mas contenido. En mobile, los usuarios pueden no descubrir columnas ocultas.
- **Solucion:** Agregar sombra/gradiente en el borde derecho cuando hay scroll disponible.

### DB-02 — Sin validacion de precision decimal en Zod
- **Archivo:** `modules/payments/payments.schema.ts`
- **Descripcion:** Montos usan `z.number().positive()` sin limitar decimales. El frontend puede enviar `1.999999` que la DB trunca silenciosamente.
- **Solucion:** Agregar `.multipleOf(0.01)` o transformacion para redondear a 2 decimales.

### DB-03 — Inconsistencia de idioma en enums
- **Archivo:** `prisma/schema.prisma`
- **Descripcion:** Algunos enums usan ingles (`PENDING`, `PAID`, `EXPIRED`, `MONDAY`-`SUNDAY`) y otros espanol (`ACTIVO`, `INACTIVO`, `PRUEBA`, `EFECTIVO`, `TRANSFERENCIA`). Confuso para desarrolladores.
- **Solucion:** Estandarizar en un solo idioma (preferiblemente ingles para enums).

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
3. Corregir bypasses de autorizacion (SEC-03, SEC-04, SEC-05)
4. Agregar cascadas en schema Prisma
5. Agregar headers de seguridad
6. Configurar CORS
7. Implementar rate limiting

### Fase 2 — Estabilidad (primera semana)
1. Corregir timezone inconsistency en pagos
2. Corregir aritmetica de punto flotante en montos
3. Agregar manejo de errores en todos los fetch del frontend
4. Agregar AbortController en useEffects con fetch
5. Agregar feedback visual cuando mutaciones fallan

### Fase 3 — Calidad (primeras dos semanas)
1. Implementar paginacion en API
2. Agregar debounce en busquedas
3. Configurar CI/CD pipeline
4. Agregar Vitest + primeros tests (auth, belongs, payments)
5. Implementar logging estructurado

### Fase 4 — Mejoras continuas
1. Skeleton loaders
2. Error boundaries por seccion
3. Memoizacion de datos derivados
4. Versionado de API
5. Estandarizacion de enums y mensajes de error
