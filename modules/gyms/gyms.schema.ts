import { z } from "zod"

export const createGymSchema = z.object({
  nombre: z.string().min(1),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
})

export const updateGymSchema = createGymSchema.partial()

export type CreateGymInput = z.infer<typeof createGymSchema>
export type UpdateGymInput = z.infer<typeof updateGymSchema>