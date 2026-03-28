import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, trainerBelongsToGym } from "@/modules/belongs/belongs.service"
import { assignUserToTrainer, revokeUserFromTrainer, getTrainerById } from "@/modules/trainers/trainers.service"
import { assignTrainerUserSchema } from "@/modules/trainers/trainers.schema"

type Params = { id: string }

export const POST = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await trainerBelongsToGym(id, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const trainer = await getTrainerById(id)
  if (trainer?.userId)
    return NextResponse.json({ error: "El entrenador ya tiene acceso asignado." }, { status: 409 })

  const body = await req.json()
  const parsed = assignTrainerUserSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const result = await assignUserToTrainer(id, parsed.data.email, parsed.data.password)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN")
      return NextResponse.json({ error: "El email ya está registrado en GYM360." }, { status: 409 })
    throw err
  }
})

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await trainerBelongsToGym(id, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    await revokeUserFromTrainer(id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Error && err.message === "NO_USER")
      return NextResponse.json({ error: "El entrenador no tiene acceso asignado." }, { status: 404 })
    throw err
  }
})
