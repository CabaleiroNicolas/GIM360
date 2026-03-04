import { z } from "zod"
import { MedicalClearance } from "@/app/generated/prisma/client"

export const createStudentSchema = z.object({
  gymId: z.string().min(1),
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  fechaNacimiento: z.string().datetime().optional(),
  dni: z.string().optional(),
  telefono: z.string().optional(),
  telefonoEmergencia: z.string().optional(),
  contactoEmergencia: z.string().optional(),
  aptoMedico: z.nativeEnum(MedicalClearance).optional(),
  vencimientoApto: z.string().datetime().optional(),
})

export const updateStudentSchema = createStudentSchema.omit({ gymId: true }).partial()

export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>