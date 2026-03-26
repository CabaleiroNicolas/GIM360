import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { UserRole } from "@/app/generated/prisma/client"
import { createOwnerSchema } from "@/modules/admin/admin.schema"
import { getAllOwners, createOwnerWithUser } from "@/modules/admin/admin.service"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== UserRole.ADMIN)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await getAllOwners())
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== UserRole.ADMIN)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = createOwnerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const owner = await createOwnerWithUser(parsed.data)
    return NextResponse.json(owner, { status: 201 })
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "El email ya está en uso" }, { status: 409 })
    }
    throw err
  }
}
