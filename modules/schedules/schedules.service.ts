import { db } from "@/lib/db"
import type { CreateScheduleInput, UpdateScheduleInput } from "./schedules.schema"

export async function getSchedulesByGroup(groupId: string, ownerId: string) {
  return db.schedule.findMany({
    where: { groupId, group: { gym: { owner: { userId: ownerId } } } },
  })
}

export async function createSchedule(data: CreateScheduleInput) {
  return db.schedule.create({
    data: {
      ...data,
      fechaInicio: new Date(data.fechaInicio),
      fechaFin: data.fechaFin ? new Date(data.fechaFin) : undefined,
    },
  })
}

export async function updateSchedule(id: string, ownerId: string, data: UpdateScheduleInput) {
  return db.schedule.updateMany({
    where: { id, group: { gym: { owner: { userId: ownerId } } } },
    data: {
      ...data,
      fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : undefined,
      fechaFin: data.fechaFin ? new Date(data.fechaFin) : undefined,
    },
  })
}

export async function deleteSchedule(id: string, ownerId: string) {
  return db.schedule.deleteMany({
    where: { id, group: { gym: { owner: { userId: ownerId } } } },
  })
}
