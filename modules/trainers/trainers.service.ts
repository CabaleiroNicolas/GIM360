import { db } from "@/lib/db"
import type { CreateTrainerInput, UpdateTrainerInput } from "./trainers.schema"

export async function getTrainersByGym(gymId: string, ownerId: string) {
  return db.trainer.findMany({
    where: { gymId, gym: { owner: { userId: ownerId } } },
    orderBy: { nombre: "asc" },
  })
}

export async function getTrainerById(id: string, ownerId: string) {
  return db.trainer.findFirst({
    where: { id, gym: { owner: { userId: ownerId } } },
    include: { groups: { include: { group: true } } },
  })
}

export async function createTrainer(data: CreateTrainerInput) {
  return db.trainer.create({ data })
}

export async function updateTrainer(id: string, ownerId: string, data: UpdateTrainerInput) {
  return db.trainer.updateMany({
    where: { id, gym: { owner: { userId: ownerId } } },
    data,
  })
}

export async function deleteTrainer(id: string, ownerId: string) {
  return db.trainer.updateMany({
    where: { id, gym: { owner: { userId: ownerId } } },
    data: { estado: false },
  })
}
