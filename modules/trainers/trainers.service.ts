import { db } from "@/lib/db"
import type { CreateTrainerInput, UpdateTrainerInput } from "./trainers.schema"

export async function getTrainerByUserId(userId: string) {
  return db.trainer.findFirst({ where: { userId } })
}

export async function getTrainersByGym(gymId: string) {
  return db.trainer.findMany({
    where: { gymId },
    include: {
      groups: {
        include: {
          group: { select: { id: true, name: true } },
          schedules: { select: { weekDay: true, startTime: true, endTime: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  })
}

export async function getTrainerById(id: string) {
  return db.trainer.findFirst({
    where: { id },
    include: { groups: { include: { group: true } } },
  })
}

export async function createTrainer(data: CreateTrainerInput) {
  return db.trainer.create({
    data: {
      ...data,
      startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
    },
  })
}

export async function updateTrainer(id: string, data: UpdateTrainerInput) {
  return db.trainer.update({
    where: { id },
    data: {
      ...data,
      startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
    },
  })
}

// Soft delete: trainer has active Boolean
export async function deleteTrainer(id: string) {
  return db.trainer.update({ where: { id }, data: { active: false } })
}

export type ScheduleConflict = {
  weekDay: string
  newTime: string
  existingTime: string
  groupName: string
}

/**
 * Checks if the proposed schedules overlap with the trainer's existing schedules
 * in OTHER groups (excludes currentGroupId if provided, for edits).
 */
export async function getTrainerScheduleConflicts(
  trainerId: string,
  proposedSchedules: { weekDay: string; startTime: string; endTime: string }[],
  excludeGroupId?: string,
): Promise<ScheduleConflict[]> {
  const trainer = await db.trainer.findFirst({
    where: { id: trainerId },
    include: {
      groups: {
        where: excludeGroupId ? { groupId: { not: excludeGroupId } } : undefined,
        include: {
          group: { select: { name: true } },
          schedules: { select: { weekDay: true, startTime: true, endTime: true } },
        },
      },
    },
  })

  if (!trainer) return []

  const conflicts: ScheduleConflict[] = []

  for (const proposed of proposedSchedules) {
    for (const tg of trainer.groups) {
      for (const existing of tg.schedules) {
        if (existing.weekDay !== proposed.weekDay) continue
        // Overlap: newStart < existingEnd AND newEnd > existingStart
        if (proposed.startTime < existing.endTime && proposed.endTime > existing.startTime) {
          conflicts.push({
            weekDay: proposed.weekDay,
            newTime: `${proposed.startTime}-${proposed.endTime}`,
            existingTime: `${existing.startTime}-${existing.endTime}`,
            groupName: tg.group.name,
          })
        }
      }
    }
  }

  return conflicts
}
