---
name: new-route
description: Create Route Handler files for a GYM360 domain. Creates route.ts (list+create) and [id]/route.ts (get+update+delete).
argument-hint: <domain>
allowed-tools: Read, Write, Bash, Glob
---

# Create Route Handlers for: $ARGUMENTS

## Step 1 — Read context
- `modules/$ARGUMENTS/$ARGUMENTS.service.ts` — function names to import
- `modules/$ARGUMENTS/$ARGUMENTS.schema.ts` — schema names to import
- `modules/belongs/belongs.service.ts` — which belongs functions are available
- `lib/with-auth.ts` — auth wrappers available: `withAuth` (list/create) and `withAuthParams` (by id)

## Step 2 — Determine which belongs check to use

Identify the parent entity that guards access to this domain:
- Entity has `gymId` directly → `gymBelongsToOwner(gymId, session.user.id)`
- Entity has `groupId` → `groupBelongsToGym(groupId, gymId)` (first verify gym, then group)
- For non-OWNER roles, resolve the entity associated to the user first (e.g. `getTrainerByUserId`), then verify belongs

Also determine which roles can access each operation — pass them to `withAuth`/`withAuthParams`.

## Step 3 — Create `app/api/$ARGUMENTS/route.ts`

Use `withAuth(roles, handler)` — handles auth check and role enforcement automatically.
The handler receives `(req, session)` already authenticated.

```ts
import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { create${Domain}Schema } from "@/modules/$ARGUMENTS/$ARGUMENTS.schema"
import { get${Domain}sByGym, create${Domain} } from "@/modules/$ARGUMENTS/$ARGUMENTS.service"

export const GET = withAuth([UserRole.OWNER], async (req, session) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await get${Domain}sByGym(gymId))
})

export const POST = withAuth([UserRole.OWNER], async (req, session) => {
  const body = await req.json()
  const parsed = create${Domain}Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (!await gymBelongsToOwner(parsed.data.gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await create${Domain}(parsed.data), { status: 201 })
})
```

## Step 4 — Create `app/api/$ARGUMENTS/[id]/route.ts`

Use `withAuthParams<{ id: string }>(roles, handler)` — params are already awaited and passed as third argument.

```ts
import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { update${Domain}Schema } from "@/modules/$ARGUMENTS/$ARGUMENTS.schema"
import { get${Domain}ById, update${Domain}, delete${Domain} } from "@/modules/$ARGUMENTS/$ARGUMENTS.service"

type Params = { id: string }

export const GET = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const data = await get${Domain}ById(id)
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!await gymBelongsToOwner(data.gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(data)
})

export const PATCH = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const existing = await get${Domain}ById(id)
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!await gymBelongsToOwner(existing.gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = update${Domain}Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  return NextResponse.json(await update${Domain}(id, parsed.data))
})

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const existing = await get${Domain}ById(id)
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!await gymBelongsToOwner(existing.gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await delete${Domain}(id)
  return new NextResponse(null, { status: 204 })
})
```

## Step 5 — Verify
Run `npx tsc --noEmit`. Fix any type errors.

Done. Report endpoints created: `GET/POST /api/$ARGUMENTS` and `GET/PATCH/DELETE /api/$ARGUMENTS/:id`.
