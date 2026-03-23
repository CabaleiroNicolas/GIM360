import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym, trainerBelongsToGym } from "@/modules/belongs/belongs.service"
import { assignTrainer, getGroupById } from "@/modules/groups/groups.service"
import { assignTrainerSchema } from "@/modules/groups/groups.schema"
import { getTrainerScheduleConflicts } from "@/modules/trainers/trainers.service"

type Params = { id: string }

const DAY_ES: Record<string, string> = {
  MONDAY: "LUNES", TUESDAY: "MARTES", WEDNESDAY: "MIÉRCOLES",
  THURSDAY: "JUEVES", FRIDAY: "VIERNES", SATURDAY: "SÁBADO", SUNDAY: "DOMINGO",
}

export const POST = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id: groupId }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await groupBelongsToGym(groupId, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const forceOverlap = body.forceOverlap === true
  const parsed = assignTrainerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (!await trainerBelongsToGym(parsed.data.trainerId, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Validate trainer schedule entries against group schedules
  const group = await getGroupById(groupId)
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 })

  const groupWeekDays = new Set(group.schedules.flatMap((s) => s.weekDays))

  for (const entry of parsed.data.schedules) {
    if (!groupWeekDays.has(entry.weekDay)) {
      return NextResponse.json(
        { error: `El día ${DAY_ES[entry.weekDay] ?? entry.weekDay} no pertenece al horario del grupo` },
        { status: 400 }
      )
    }

    const groupSchedule = group.schedules.find((s) => s.weekDays.includes(entry.weekDay))
    if (groupSchedule && (entry.startTime < groupSchedule.startTime || entry.endTime > groupSchedule.endTime)) {
      return NextResponse.json(
        { error: `El horario ${entry.startTime}-${entry.endTime} excede el horario del grupo para el ${DAY_ES[entry.weekDay] ?? entry.weekDay}` },
        { status: 400 }
      )
    }
  }

  // Check for schedule overlaps with other groups (warn, not block)
  if (!forceOverlap) {
    const conflicts = await getTrainerScheduleConflicts(parsed.data.trainerId, parsed.data.schedules)
    if (conflicts.length > 0) {
      return NextResponse.json({
        error: "El profesor tiene horarios superpuestos con otros grupos",
        conflicts: conflicts.map((c) => ({
          weekDay: DAY_ES[c.weekDay] ?? c.weekDay,
          newTime: c.newTime,
          existingTime: c.existingTime,
          groupName: c.groupName,
        })),
      }, { status: 409 })
    }
  }

  return NextResponse.json(await assignTrainer(groupId, parsed.data), { status: 201 })
})
