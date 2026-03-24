import { z } from "zod"
import { StudentStatus } from "@/app/generated/prisma/client"

/** Acepta formatos argentinos/internacionales: +54 9 11 1234-5678, 1112345678, etc.
 *  Requiere mínimo 8 dígitos después de quitar caracteres de formato. */
const phoneSchema = z
  .string()
  .regex(/^[+]?[\d\s\-(). ]{6,25}$/, "Formato inválido. Ej: 11 1234-5678 o +54 9 11 1234-5678")
  .refine((v) => v.replace(/\D/g, "").length >= 8, "El teléfono debe tener al menos 8 dígitos")

export const createStudentSchema = z.object({
  gymId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dueDay: z.number().int().min(1).max(31).optional(),
  birthDate: z.string().datetime().optional(),
  nationalId: z.string().optional(),
  phone1: phoneSchema,
  phone2: phoneSchema.optional(),
  emergencyPhone: phoneSchema.optional(),
  emergencyContact: z.string().optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  trialEndsAt: z.string().datetime().optional(),
})

export const updateStudentSchema = createStudentSchema.omit({ gymId: true }).partial()

export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
