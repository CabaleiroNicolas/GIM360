import { db } from "@/lib/db"
import type { CreateGymInput, UpdateGymInput } from "./gyms.schema"

export async function getGymsByOwner(ownerId: string) {
  return db.gym.findMany({
    where: { owner: { userId: ownerId } },
    orderBy: { createdAt: "desc" },
  })
}

export async function getGymById(id: string, ownerId: string) {
  return db.gym.findFirst({
    where: { id, owner: { userId: ownerId } },
  })
}

export async function createGym(ownerId: string, data: CreateGymInput) {
  const owner = await db.owner.findUnique({ where: { userId: ownerId } })
  if (!owner) throw new Error("Owner not found")

  return db.gym.create({
    data: { ...data, ownerId: owner.id },
  })
}

export async function updateGym(id: string, ownerId: string, data: UpdateGymInput) {
  return db.gym.updateMany({
    where: { id, owner: { userId: ownerId } },
    data,
  })
}

export async function deleteGym(id: string, ownerId: string) {
  return db.gym.deleteMany({
    where: { id, owner: { userId: ownerId } },
  })
}