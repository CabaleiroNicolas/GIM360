import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, trainerCanAccessAttendance } from "@/modules/belongs/belongs.service"
import { getAttendanceById, getGroupStudentsForAttendance } from "@/modules/attendance/attendance.service"
import { getTrainerByUserId } from "@/modules/trainers/trainers.service"

type Params = { id: string }

export const GET = withAuthParams<Params>(
  [UserRole.TRAINER, UserRole.OWNER, UserRole.RECEPTIONIST],
  async (_req, session, { id }) => {
    const attendance = await getAttendanceById(id)
    if (!attendance)
      return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (session.user.role === "TRAINER") {
      const trainer = await getTrainerByUserId(session.user.id)
      if (!trainer)
        return NextResponse.json({ error: "Trainer not found" }, { status: 404 })
      if (!(await trainerCanAccessAttendance(trainer.id, id)))
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    } else {
      // OWNER / RECEPTIONIST
      if (!(await gymBelongsToOwner(attendance.gymId, session.user.id)))
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const students = await getGroupStudentsForAttendance(attendance.groupId)
    return NextResponse.json(students)
  },
)
