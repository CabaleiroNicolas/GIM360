import { db } from "@/lib/db"
import type { DayOfWeek } from "@/app/generated/prisma/client"
import type { AttendanceDetail, AttendanceStudentEntry } from "./attendance.schema"

const JS_DAY_TO_ENUM: Record<number, DayOfWeek> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function floorToUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * Genera registros de asistencia vacíos (detail: null) para todos los días
 * donde los grupos del gym tenían horario, desde el último registro existente
 * hasta `upToDate` inclusive.
 *
 * - Primera apertura: va desde el startDate del horario más antiguo (máx. 1 año atrás).
 * - Aperturas posteriores: solo genera desde el día siguiente al último registro.
 * - Idempotente via skipDuplicates como red de seguridad.
 */
export async function ensureAttendanceUpToDate(gymId: string, upToDate: string) {
  const upToDateObj = parseDate(upToDate)

  const groups = await db.group.findMany({
    where: { gymId },
    select: {
      id: true,
      schedules: {
        select: { weekDays: true, startDate: true, endDate: true },
      },
    },
  })

  const scheduledGroups = groups.filter((g) => g.schedules.length > 0)
  if (scheduledGroups.length === 0) return getAttendanceByGymDate(gymId, upToDate)

  // Determinar la fecha desde donde generar
  const lastRecord = await db.attendance.findFirst({
    where: { gymId, date: { lte: upToDateObj } },
    orderBy: { date: "desc" },
    select: { date: true },
  })

  const oneYearAgo = new Date(upToDateObj)
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1)

  let fromDate: Date
  if (lastRecord) {
    // Solo generar lo que falta: desde el día siguiente al último registro (máx. 1 año atrás)
    const next = floorToUTCDay(lastRecord.date)
    next.setUTCDate(next.getUTCDate() + 1)
    fromDate = next < oneYearAgo ? oneYearAgo : next
  } else {
    // Primera vez: ir desde el startDate más antiguo (máx. 1 año atrás)
    fromDate = upToDateObj
    for (const group of scheduledGroups) {
      for (const schedule of group.schedules) {
        const sd = floorToUTCDay(schedule.startDate)
        const effectiveStart = sd < oneYearAgo ? oneYearAgo : sd
        if (effectiveStart < fromDate) fromDate = effectiveStart
      }
    }
  }

  // Si ya estamos al día, no hay nada que generar
  if (fromDate > upToDateObj) return getAttendanceByGymDate(gymId, upToDate)

  // Iterar cada día e identificar qué grupos tienen horario activo
  const toInsert: { gymId: string; groupId: string; date: Date }[] = []
  const cursor = new Date(fromDate)

  while (cursor <= upToDateObj) {
    const dayOfWeek = JS_DAY_TO_ENUM[cursor.getUTCDay()]
    const cursorDay = new Date(cursor)

    for (const group of scheduledGroups) {
      const hasSchedule = group.schedules.some(
        (s) =>
          s.weekDays.includes(dayOfWeek) &&
          floorToUTCDay(s.startDate) <= cursorDay &&
          (s.endDate === null || floorToUTCDay(s.endDate) >= cursorDay),
      )
      if (hasSchedule) {
        toInsert.push({ gymId, groupId: group.id, date: cursorDay })
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  if (toInsert.length > 0) {
    await db.attendance.createMany({ data: toInsert, skipDuplicates: true })
  }

  return getAttendanceByGymDate(gymId, upToDate)
}

/** Todos los registros de asistencia de un gym en una fecha, con info del grupo. */
export async function getAttendanceByGymDate(gymId: string, date: string) {
  const dateObj = parseDate(date)
  return db.attendance.findMany({
    where: { gymId, date: dateObj },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          schedules: {
            select: { weekDays: true, startTime: true, endTime: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })
}

/**
 * Registros de asistencia de un trainer para una fecha,
 * filtrados a sus grupos asignados y ordenados por horario.
 */
export async function getTrainerAttendanceForDate(
  trainerId: string,
  gymId: string,
  date: string,
) {
  const dateObj = parseDate(date)
  const dayOfWeek = JS_DAY_TO_ENUM[dateObj.getUTCDay()]

  const trainerGroups = await db.trainerGroup.findMany({
    where: { trainerId },
    select: { groupId: true },
  })
  const groupIds = trainerGroups.map((tg) => tg.groupId)

  if (groupIds.length === 0) return []

  const records = await db.attendance.findMany({
    where: { gymId, date: dateObj, groupId: { in: groupIds } },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          schedules: {
            select: { weekDays: true, startTime: true, endTime: true },
          },
        },
      },
    },
  })

  return records.sort((a, b) => {
    const aTime =
      a.group.schedules
        .filter((s) => s.weekDays.includes(dayOfWeek))
        .map((s) => s.startTime)
        .sort()[0] ?? "99:99"
    const bTime =
      b.group.schedules
        .filter((s) => s.weekDays.includes(dayOfWeek))
        .map((s) => s.startTime)
        .sort()[0] ?? "99:99"
    return aTime.localeCompare(bTime)
  })
}

/** Alumnos inscriptos en un grupo (ACTIVE o TRIAL), ordenados por apellido. */
export async function getGroupStudentsForAttendance(groupId: string) {
  return db.studentGroup.findMany({
    where: {
      groupId,
      student: { status: { in: ["ACTIVE", "TRIAL"] } },
    },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, status: true },
      },
    },
    orderBy: { student: { lastName: "asc" } },
  })
}

/**
 * Envía asistencia con lógica de merge multi-entrenador.
 * - Si no hay detail previo: todas las entradas se atribuyen al submitter.
 * - Si hay detail previo: solo se actualiza markedBy de alumnos cuyo `present` cambió.
 */
export async function submitAttendance(
  attendanceId: string,
  students: { studentId: string; studentName: string; present: boolean }[],
  submitterUserId: string,
  submitterName: string,
) {
  const attendance = await db.attendance.findFirst({ where: { id: attendanceId } })
  if (!attendance) throw new Error("ATTENDANCE_NOT_FOUND")

  const existingDetail = attendance.detail as AttendanceDetail | null
  let mergedStudents: AttendanceStudentEntry[]

  if (!existingDetail) {
    mergedStudents = students.map((s) => ({
      ...s,
      markedByUserId: submitterUserId,
      markedByName: submitterName,
    }))
  } else {
    const existingMap = new Map(
      existingDetail.students.map((s) => [s.studentId, s]),
    )

    mergedStudents = students.map((s) => {
      const existing = existingMap.get(s.studentId)
      if (existing && existing.present === s.present) {
        // Estado no cambió → conservar markedBy original
        return { ...s, markedByUserId: existing.markedByUserId, markedByName: existing.markedByName }
      }
      // Estado cambió o alumno nuevo → atribuir al submitter actual
      return { ...s, markedByUserId: submitterUserId, markedByName: submitterName }
    })
  }

  const detail: AttendanceDetail = { students: mergedStudents }

  return db.attendance.update({
    where: { id: attendanceId },
    data: { detail, takenByUserId: submitterUserId, takenByName: submitterName },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          schedules: {
            select: { weekDays: true, startTime: true, endTime: true },
          },
        },
      },
    },
  })
}

export async function getAttendanceById(id: string) {
  return db.attendance.findFirst({
    where: { id },
    include: { group: { select: { id: true, name: true } } },
  })
}
