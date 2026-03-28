import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToUser } from "@/modules/belongs/belongs.service"
import {
  ensureAttendanceUpToDate,
  getAttendanceByGymDate,
  getTrainerAttendanceForDate,
} from "@/modules/attendance/attendance.service"
import { generateAttendanceSchema } from "@/modules/attendance/attendance.schema"
import { getTrainerByUserId } from "@/modules/trainers/trainers.service"

export const GET = withAuth([UserRole.TRAINER, UserRole.OWNER], async (req, session) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  const date = req.nextUrl.searchParams.get("date")
  if (!gymId || !date)
    return NextResponse.json({ error: "gymId and date required" }, { status: 400 })

  if (!(await gymBelongsToUser(gymId, session.user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (session.user.role === "TRAINER") {
    const trainer = await getTrainerByUserId(session.user.id)
    if (!trainer || trainer.gymId !== gymId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(await getTrainerAttendanceForDate(trainer.id, gymId, date))
  }

  return NextResponse.json(await getAttendanceByGymDate(gymId, date))
})

export const POST = withAuth([UserRole.TRAINER, UserRole.OWNER], async (req, session) => {
  const body = await req.json()
  const parsed = generateAttendanceSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { gymId, date } = parsed.data

  if (!(await gymBelongsToUser(gymId, session.user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const records = await ensureAttendanceUpToDate(gymId, date)

  if (session.user.role === "TRAINER") {
    const trainer = await getTrainerByUserId(session.user.id)
    if (!trainer || trainer.gymId !== gymId)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    return NextResponse.json(
      await getTrainerAttendanceForDate(trainer.id, gymId, date),
      { status: 201 },
    )
  }

  return NextResponse.json(records, { status: 201 })
})
