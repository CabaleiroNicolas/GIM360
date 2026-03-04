import { db } from "@/lib/db"
import type { CreateStudentInput, UpdateStudentInput } from "./students.schema"

export async function getStudentsByGym(gymId: string, ownerId: string) {
  return db.student.findMany({
    where: { gymId, gym: { owner: { userId: ownerId } } },
    orderBy: { apellido: "asc" },
  })
}

export async function getStudentById(id: string, ownerId: string) {
  return db.student.findFirst({
    where: { id, gym: { owner: { userId: ownerId } } },
    include: { groups: { include: { group: true } } },
  })
}

export async function createStudent(ownerId: string, data: CreateStudentInput) {
  return db.student.create({
    data: {
      ...data,
      fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : undefined,
      vencimientoApto: data.vencimientoApto ? new Date(data.vencimientoApto) : undefined,
    },
  })
}

export async function updateStudent(id: string, ownerId: string, data: UpdateStudentInput) {
  return db.student.updateMany({
    where: { id, gym: { owner: { userId: ownerId } } },
    data: {
      ...data,
      fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : undefined,
      vencimientoApto: data.vencimientoApto ? new Date(data.vencimientoApto) : undefined,
    },
  })
}

export async function deleteStudent(id: string, ownerId: string) {
  return db.student.deleteMany({
    where: { id, gym: { owner: { userId: ownerId } } },
  })
}
