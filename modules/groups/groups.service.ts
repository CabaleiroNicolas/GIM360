import { db } from "@/lib/db"
import type { CreateGroupInput, UpdateGroupInput } from "./groups.schema"

export async function getGroupsByGym(gymId: string, ownerId: string) {
  return db.group.findMany({
    where: { gymId, gym: { owner: { userId: ownerId } } },
    include: {
      trainers: { include: { trainer: true } },
      schedules: true,
      _count: { select: { students: true } },
    },
    orderBy: { nombre: "asc" },
  })
}

export async function getGroupById(id: string, ownerId: string) {
  return db.group.findFirst({
    where: { id, gym: { owner: { userId: ownerId } } },
    include: {
      trainers: { include: { trainer: true } },
      students: { include: { student: true } },
      schedules: true,
    },
  })
}

export async function createGroup(data: CreateGroupInput) {
  return db.group.create({ data })
}

export async function updateGroup(id: string, ownerId: string, data: UpdateGroupInput) {
  return db.group.updateMany({
    where: { id, gym: { owner: { userId: ownerId } } },
    data,
  })
}

export async function deleteGroup(id: string, ownerId: string) {
  return db.group.deleteMany({
    where: { id, gym: { owner: { userId: ownerId } } },
  })
}
