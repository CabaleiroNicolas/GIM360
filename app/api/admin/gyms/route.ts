import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { UserRole } from "@/app/generated/prisma/client"
import { createAdminGymSchema } from "@/modules/admin/admin.schema"
import { getAllGyms, createGymForOwner } from "@/modules/admin/admin.service"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== UserRole.ADMIN)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await getAllGyms())
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== UserRole.ADMIN)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = createAdminGymSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  return NextResponse.json(await createGymForOwner(parsed.data), { status: 201 })
}
