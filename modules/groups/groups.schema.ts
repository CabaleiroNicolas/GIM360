import { z } from "zod"

export const createGroupSchema = z.object({
  gymId: z.string().min(1),
  nombre: z.string().min(1),
  precioMensual: z.number().positive(),
  cupoMaximo: z.number().int().positive().optional(),
})

export const updateGroupSchema = createGroupSchema.omit({ gymId: true }).partial()

export type CreateGroupInput = z.infer<typeof createGroupSchema>
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>
