---
name: create-endpoint
description: Create a complete backend feature for GYM360 following the Route Handler architecture. Creates schema, service, and API route files.
argument-hint: <domain> "<field: type, field: type, ...>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Create backend endpoint: $ARGUMENTS

You are creating a complete backend feature for the GYM360 project following its established architecture. Read CLAUDE.md carefully before starting.

## Input parsing

The argument format is: `<domain> "<fields>"`

Examples:
- `payments "monto: number, fecha: string, studentId: string"`
- `gyms` (no fields = infer from Prisma schema)

Parse:
- `domain` = first word (e.g., `payments`)
- `fields` = everything in quotes (optional)

If no fields are provided, read `prisma/schema.prisma` to infer the fields for the domain model.

## Step 1 — Read project context

Read these files before writing any code:
- `CLAUDE.md` — architecture decisions and patterns
- `prisma/schema.prisma` — find the model matching the domain to understand all fields
- `modules/students/students.schema.ts` — reference for schema pattern
- `modules/students/students.service.ts` — reference for service pattern

## Step 2 — Create `modules/<domain>/<domain>.schema.ts`

Rules:
- Import enums from `@/app/generated/prisma/client` if the model uses them
- `createSchema`: include all fields the CLIENT can send. Never include: `id`, `createdAt`, `updatedAt`, `fechaAlta`, `fechaBaja` — those are DB-managed
- `updateSchema`: `createSchema.omit({ gymId: true, ...other FKs }).partial()`
- Export `CreateXInput` and `UpdateXInput` types via `z.infer<>`

```ts
import { z } from "zod"

export const create${Domain}Schema = z.object({
  // fields here
})

export const update${Domain}Schema = create${Domain}Schema.omit({ gymId: true }).partial()

export type Create${Domain}Input = z.infer<typeof create${Domain}Schema>
export type Update${Domain}Input = z.infer<typeof update${Domain}Schema>
```

## Step 3 — Create `modules/<domain>/<domain>.service.ts`

Rules:
- Always filter by `ownerId` on every query (multi-tenant isolation)
- The ownership chain varies by entity:
  - Direct gym entities: `where: { gymId, gym: { owner: { userId: ownerId } } }`
  - Nested entities (e.g. schedules): `where: { group: { gym: { owner: { userId: ownerId } } } }`
- Use `findMany` / `findFirst` (not `findUnique`) when filtering by ownerId + id together
- Use `updateMany` / `deleteMany` (not `update`/`delete`) for the same reason
- Soft delete when the model has `estado: Boolean` — set `estado: false` instead of deleting
- Convert ISO string dates to `new Date()` for DateTime fields
- Standard functions: `getXsByGym`, `getXById`, `createX`, `updateX`, `deleteX`

## Step 4 — Create `app/api/<domain>/route.ts`

Handles `GET` (list) and `POST` (create).

Rules:
- Always call `auth()` first — return 401 if no session
- Parse query params with `req.nextUrl.searchParams` for GET filters (e.g. `gymId`)
- Validate POST body with `schema.safeParse()` — return 400 with `error.flatten()` on failure
- Return 201 on successful creation
- No business logic here — only: auth → validate → call service → respond

```ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { create${Domain}Schema } from "@/modules/${domain}/${domain}.schema"
import { getXsByGym, createX } from "@/modules/${domain}/${domain}.service"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  const data = await getXsByGym(gymId, session.user.id)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = create${Domain}Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = await createX(session.user.id, parsed.data)
  return NextResponse.json(data, { status: 201 })
}
```

## Step 5 — Create `app/api/<domain>/[id]/route.ts`

Handles `GET` (by id), `PATCH` (update), `DELETE`.

Rules:
- Same auth check on every method
- `params` is typed as `{ params: Promise<{ id: string }> }` in Next.js 16 — always `await params`
- Return 404 if service returns null
- Validate PATCH body with `updateSchema`
- Return 204 (no body) on DELETE

```ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { update${Domain}Schema } from "@/modules/${domain}/${domain}.schema"
import { getXById, updateX, deleteX } from "@/modules/${domain}/${domain}.service"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const data = await getXById(id, session.user.id)
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = update${Domain}Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  await updateX(id, session.user.id, parsed.data)
  return NextResponse.json({ success: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await deleteX(id, session.user.id)
  return new NextResponse(null, { status: 204 })
}
```

## Step 6 — Verify

Run `npx tsc --noEmit` and fix any type errors before finishing.

## Output summary

When done, report:
- Files created (with paths)
- Endpoints available: GET/POST `/api/<domain>`, GET/PATCH/DELETE `/api/<domain>/[id]`
- Any decisions made (e.g. soft delete used, ownership chain used)
- Any fields skipped and why