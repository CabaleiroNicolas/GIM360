import { z } from "zod"
import { DayOfWeek } from "@/app/generated/prisma/client"

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

export const createScheduleSchema = z.object({
  groupId: z.string().min(1),
  diasSemana: z.array(z.nativeEnum(DayOfWeek)).min(1),
  horaInicio: z.string().regex(timeRegex, "Formato HH:MM requerido"),
  horaFin: z.string().regex(timeRegex, "Formato HH:MM requerido"),
  fechaInicio: z.string().datetime(),
  fechaFin: z.string().datetime().optional(),
})

export const updateScheduleSchema = createScheduleSchema.omit({ groupId: true }).partial()

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>
