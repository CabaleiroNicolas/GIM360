import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, trainerCanAccessAttendance } from "@/modules/belongs/belongs.service"
import { submitAttendance, getAttendanceById } from "@/modules/attendance/attendance.service"
import { submitAttendanceSchema } from "@/modules/attendance/attendance.schema"
import { getTrainerByUserId } from "@/modules/trainers/trainers.service"
import { getOwnerByUserId } from "@/modules/gyms/gyms.service"

type Params = { id: string }

export const PATCH = withAuthParams<Params>(
  [UserRole.TRAINER, UserRole.OWNER, UserRole.RECEPTIONIST],
  async (req, session, { id }) => {
    let submitterName: string

    if (session.user.role === "TRAINER") {
      const trainer = await getTrainerByUserId(session.user.id)
      if (!trainer)
        return NextResponse.json({ error: "Trainer not found" }, { status: 404 })
      if (!(await trainerCanAccessAttendance(trainer.id, id)))
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      submitterName = trainer.name
    } else {
      // OWNER / RECEPTIONIST
      const attendance = await getAttendanceById(id)
      if (!attendance)
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      if (!(await gymBelongsToOwner(attendance.gymId, session.user.id)))
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      const owner = await getOwnerByUserId(session.user.id)
      submitterName = owner?.name ?? session.user.id
    }

    const body = await req.json()
    const parsed = submitAttendanceSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const updated = await submitAttendance(id, parsed.data.students, session.user.id, submitterName)
    return NextResponse.json(updated)
  },
)
