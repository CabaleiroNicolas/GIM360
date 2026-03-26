import { z } from "zod"
import { GymStatus } from "@/app/generated/prisma/client"

export const createOwnerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
})

export const createAdminGymSchema = z.object({
  ownerId: z.string().min(1),
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
})

export const updateGymStatusSchema = z.object({
  status: z.nativeEnum(GymStatus),
})

export type CreateOwnerInput = z.infer<typeof createOwnerSchema>
export type CreateAdminGymInput = z.infer<typeof createAdminGymSchema>
export type UpdateGymStatusInput = z.infer<typeof updateGymStatusSchema>
