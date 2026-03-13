import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/app/generated/prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    // En serverless cada instancia abre su propio pool.
    // max: 2 evita agotar conexiones cuando Vercel escala horizontalmente.
    max: process.env.NODE_ENV === "production" ? 2 : 10,
  })
  return new PrismaClient({ adapter })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

// En desarrollo el singleton evita crear un cliente por cada hot-reload.
// En producción (serverless) cada instancia crea el suyo — comportamiento correcto.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
