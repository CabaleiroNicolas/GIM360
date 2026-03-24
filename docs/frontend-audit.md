# Auditoría de Estructura Frontend — GYM360

> Fecha: 2026-03-24
> Alcance: `app/(dashboard)/`, `components/ui/`, `hooks/`
> Objetivo: Identificar mejoras estructurales para cuando el proyecto escale.
> Estado actual: La arquitectura es sólida y funcional. Ningún item aquí es urgente; son deudas técnicas a resolver de forma incremental.

---

## Resumen ejecutivo

| Prioridad | Cantidad de issues |
|---|---|
| Alta (impacta mantenibilidad hoy) | 3 |
| Media (impacta cuando escale) | 4 |
| Baja (nice-to-have) | 2 |

---

## A. Issues de Alta Prioridad

### A1. Tipos duplicados entre Views

**Archivos afectados:**
- `StudentsView.tsx`, `TrainersView.tsx`, `GroupsView.tsx`, `GroupDetailView.tsx`, `PaymentsView.tsx`

**Problema:**
Los mismos tipos se redefinen en cada View de forma independiente. Ejemplos concretos:

| Tipo | Aparece en |
|---|---|
| `DayOfWeek` | StudentsView, TrainersView, GroupsView, GroupDetailView |
| `TrainerScheduleEntry` | TrainersView, GroupDetailView |
| `AssignedTrainer` | GroupsView, GroupDetailView |
| `GroupSchedule` | StudentsView, GroupsView, TrainersView |
| `PaymentStatus` / `PaymentMethod` | StudentsView, PaymentsView |

Si el backend cambia la forma de un endpoint (ej. agrega un campo a `Group`), hay que actualizar el tipo en 3 o 4 archivos distintos, con riesgo de inconsistencias silenciosas.

**Mejora propuesta:**
Crear `types/domain.ts` con los tipos de respuesta de la API organizados por dominio:

```
types/
  domain.ts      ← tipos de respuesta de API (Student, Group, Trainer, Payment…)
  forms.ts       ← tipos de estado de formularios (NewStudentForm, EditTrainerForm…)
```

Los tipos de `domain.ts` deberían en el futuro inferirse directamente desde los schemas Zod del backend con `z.infer<typeof schema>`, eliminando la posibilidad de divergencia.

---

### A2. Constantes de días de la semana duplicadas

**Archivos afectados:**
- `StudentsView.tsx` (línea 76–83): define `DAY_SHORT` y `DAY_ORDER`
- `TrainersView.tsx` (línea 50–57): define `DAYS` array y `DAY_SHORT` record
- `GroupDetailView.tsx` (línea 42–52): define `DAYS` array con `label` + `short`, y `DAY_SHORT`
- `GroupsView.tsx`: usa `timeToMinutes` localmente

**Problema:**
La misma lógica de "días de semana en español" está escrita 3 veces. Los valores son idénticos pero el shape difiere sutilmente entre archivos (`{ value, short }` vs `{ value, label, short }`), lo que hace difícil unificarlos a mano.

**Mejora propuesta:**
Crear `lib/days.ts` con una única fuente de verdad:

```ts
// lib/days.ts
export const DAYS = [
  { value: "MONDAY",    label: "Lunes",      short: "Lun" },
  { value: "TUESDAY",   label: "Martes",     short: "Mar" },
  // ...
] as const

export type DayOfWeek = typeof DAYS[number]["value"]

export const DAY_SHORT: Record<DayOfWeek, string> =
  Object.fromEntries(DAYS.map(d => [d.value, d.short]))

export const DAY_ORDER: Record<DayOfWeek, number> =
  Object.fromEntries(DAYS.map((d, i) => [d.value, i]))
```

---

### A3. Funciones de formato duplicadas

**Archivos afectados:**
- `StudentsView.tsx`: `fmtDate()`, `fmtCurrency()`
- `TrainersView.tsx`: `formatCurrency()`, `formatSeniority()`, `parseMinutes()`
- `MetricsView.tsx`: `fmt()` (moneda ARS), `pct()`
- `GroupsView.tsx`: `timeToMinutes()`
- `PaymentsView.tsx`: `periodLabel()`, `toYearMonth()`, `dueDate()`

**Problema:**
Múltiples implementaciones de "formatear moneda ARS" con distinto nombre, distinto redondeo y distinta salida (`$1.234` vs `$ 1.234` vs `ARS 1.234`). Idem con el parseo de tiempos (`parseMinutes` / `timeToMinutes`).

**Mejora propuesta:**
Ampliar `lib/utils.ts` (o crear `lib/format.ts`) con helpers compartidos:

```ts
// lib/format.ts
export const fmtARS = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-AR") : "—"

export const fmtPeriod = (period: string) => { /* ... */ }

export const timeToMinutes = (hhmm: string): number => { /* ... */ }
```

---

## B. Issues de Prioridad Media

### B1. Views con múltiples responsabilidades

**Archivos afectados:** `StudentsView.tsx` (>400 líneas), `GroupDetailView.tsx` (~350 líneas)

**Problema:**
`StudentsView` maneja de forma monolítica:
1. Lista de alumnos con filtro/búsqueda/sort
2. Modal de creación con upload de archivos
3. Modal de edición
4. Panel de detalle lateral (datos del alumno)
5. Historial de pagos dentro del panel
6. Gestión de archivos (ficha / apto médico) dentro del panel
7. Lógica de activar/desactivar alumno

Todo esto convive en un mismo componente con ~15 variables de estado simultáneas.

**Mejora propuesta:**
Descomponer en sub-componentes co-localizados dentro de la misma carpeta de la ruta:

```
app/(dashboard)/[gymId]/students/
  page.tsx
  StudentsView.tsx          ← lista + filtros + stats
  StudentCreateModal.tsx    ← formulario de creación con file upload
  StudentEditModal.tsx      ← formulario de edición
  StudentDetailPanel.tsx    ← panel lateral
    StudentPaymentHistory.tsx
    StudentFilesSection.tsx
```

Esto no implica cambiar la lógica, solo moverla. Cada sub-componente recibe props concretas o comparte estado via props del padre.

---

### B2. Fetches manuales mezclados con `useFetch`

**Archivos afectados:** `StudentsView.tsx`, `GroupDetailView.tsx`

**Problema:**
Las Views usan `useFetch` para la carga inicial, pero hacen `fetch()` directamente para operaciones on-demand (abrir detalle, cargar archivos, cargar pagos). Esto genera dos patrones de fetch en el mismo componente con manejo de loading/error inconsistente.

Ejemplo en `StudentsView.tsx`:
```ts
// useFetch para la lista
const { data: students, loading, error, refetch } = useFetch(...)

// fetch manual para el detalle
async function openDetail(s: Student) {
  setDetailLoading(true)
  const res = await fetch(`/api/students/${s.id}?gymId=${gymId}`)
  // ...
}
```

`GroupDetailView` directamente no usa `useFetch` en absoluto y maneja todo con `useState` + `useEffect` + `fetch`.

**Mejora propuesta:**
Extender `useFetch` para soportar fetches lazy (on-demand):

```ts
// hooks/useLazyFetch.ts
export function useLazyFetch<T>() {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async (url: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError("Error al cargar.")
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, fetch: fetch_ }
}
```

---

### B3. Patrón de estado de formulario repetido sin abstracción

**Archivos afectados:** todas las Views

**Problema:**
El bloque de estado para un formulario modal se repite idéntico en cada View:

```ts
const [showForm, setShowForm] = useState(false)
const [form, setForm] = useState(EMPTY_FORM)
const [submitting, setSubmitting] = useState(false)
const [formError, setFormError] = useState<string | null>(null)
```

Y para cada View que tiene además un modal de edición, el mismo bloque se duplica con prefijo `edit`:
```ts
const [showEditModal, setShowEditModal] = useState(false)
const [editForm, setEditForm] = useState(EMPTY_EDIT)
const [editSubmitting, setEditSubmitting] = useState(false)
const [editError, setEditError] = useState<string | null>(null)
```

**Mejora propuesta:**
Un hook `useFormModal`:

```ts
// hooks/useFormModal.ts
export function useFormModal<T>(emptyValues: T) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<T>(emptyValues)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openModal = () => { setForm(emptyValues); setError(null); setOpen(true) }
  const closeModal = () => setOpen(false)

  return { open, form, setForm, submitting, setSubmitting, error, setError, openModal, closeModal }
}
```

---

### B4. Sin capa de API client

**Archivos afectados:** todas las Views

**Problema:**
Cada View hace `fetch('/api/...')` directamente con headers y serialización manual. No hay un lugar centralizado para:
- Agregar headers globales (ej. tokens Bearer para mobile en el futuro)
- Manejar errores HTTP de forma uniforme
- Tipar las respuestas de cada endpoint

**Mejora propuesta:**
Crear `lib/api/` con funciones tipadas por dominio:

```ts
// lib/api/students.ts
export async function fetchStudents(gymId: string): Promise<Student[]> {
  const res = await fetch(`/api/students?gymId=${gymId}`)
  if (!res.ok) throw new ApiError(res.status, "No se pudieron cargar los alumnos.")
  return res.json()
}

export async function createStudent(data: CreateStudentInput): Promise<Student> {
  const res = await fetch("/api/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return res.json()
}
```

Esto permite que si en el futuro se agrega un header de auth para la app mobile, se cambie en un solo lugar.

---

## C. Issues de Baja Prioridad

### C1. `useFetch` sin manejo del status code del servidor

**Archivo:** `hooks/useFetch.ts`

**Problema:**
Cuando el servidor responde con un error (4xx/5xx), `useFetch` solo setea el `errorMsg` genérico que recibe como argumento. No hay acceso al status code ni al body del error para mostrar mensajes específicos (ej. `409 Conflict` cuando se intenta crear un duplicado).

**Mejora propuesta:**
Retornar el status del error como parte del estado:

```ts
const [errorStatus, setErrorStatus] = useState<number | null>(null)

// En el catch:
if (!res.ok) {
  setErrorStatus(res.status)
  setError(errorMsg)
}
```

---

### C2. Componentes inline en `MetricsView`

**Archivo:** `app/(dashboard)/[gymId]/metrics/MetricsView.tsx`

**Problema:**
`MetricCard` y `MiniBar` están definidos como componentes dentro del mismo archivo de la View. No es un problema hoy porque solo se usan ahí, pero si se agregan más secciones de métricas (ej. métricas por trainer, por alumno) y se necesitan las mismas cards, habrá que extraerlos.

**Mejora propuesta:**
Cuando aparezca un segundo consumidor, mover a `components/ui/MetricCard.tsx`.

---

## Mapa de cambios propuestos

```
lib/
  format.ts          ← NUEVO: fmtARS, fmtDate, fmtPeriod, timeToMinutes
  days.ts            ← NUEVO: DAYS, DAY_SHORT, DAY_ORDER, tipo DayOfWeek
  api/               ← NUEVO (cuando haya mobile o la API crezca)
    students.ts
    trainers.ts
    groups.ts
    payments.ts

types/
  domain.ts          ← NUEVO: Student, Group, Trainer, Payment, etc.
  forms.ts           ← NUEVO: tipos de estado de formularios (opcional)

hooks/
  useFetch.ts        ← existente, agregar errorStatus
  useLazyFetch.ts    ← NUEVO: fetch on-demand
  useFormModal.ts    ← NUEVO: encapsula estado open/form/submitting/error

app/(dashboard)/[gymId]/students/
  page.tsx
  StudentsView.tsx
  StudentCreateModal.tsx    ← EXTRAER de StudentsView
  StudentEditModal.tsx      ← EXTRAER de StudentsView
  StudentDetailPanel.tsx    ← EXTRAER de StudentsView
```

---

## Orden de implementación sugerido

Los cambios son independientes entre sí y se pueden encarar en cualquier orden. Sin embargo, el mayor ROI está en este orden:

1. **`lib/format.ts` + `lib/days.ts`** — bajo esfuerzo, elimina duplicación en 4+ archivos de inmediato.
2. **`types/domain.ts`** — centraliza tipos, facilita todos los pasos siguientes.
3. **Descomposición de `StudentsView`** — mayor impacto en mantenibilidad.
4. **`useFormModal` + `useLazyFetch`** — reduce boilerplate en Views nuevas desde ese punto.
5. **`lib/api/`** — preparación para mobile; encarar cuando el requisito sea concreto.
