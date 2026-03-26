import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { GymStatus, UserRole } from "@/app/generated/prisma/client"
import type { CreateOwnerInput, CreateAdminGymInput } from "./admin.schema"

export async function getAllOwners() {
  return db.owner.findMany({
    include: {
      user: { select: { email: true } },
      _count: { select: { gyms: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getAllGyms() {
  return db.gym.findMany({
    include: {
      owner: {
        select: {
          name: true,
          user: { select: { email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function createOwnerWithUser(data: CreateOwnerInput) {
  const hashedPassword = await bcrypt.hash(data.password, 12)

  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        hashedPassword,
        role: UserRole.OWNER,
      },
    })

    const owner = await tx.owner.create({
      data: {
        userId: user.id,
        name: data.name,
      },
      include: {
        user: { select: { id: true, email: true, role: true } },
      },
    })

    return owner
  })
}

export async function createGymForOwner(data: CreateAdminGymInput) {
  return db.gym.create({
    data: {
      ownerId: data.ownerId,
      name: data.name,
      address: data.address,
      phone: data.phone,
    },
  })
}

export async function updateGymStatus(gymId: string, status: GymStatus) {
  return db.gym.update({
    where: { id: gymId },
    data: { status },
  })
}
