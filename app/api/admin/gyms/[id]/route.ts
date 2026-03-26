import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { UserRole } from "@/app/generated/prisma/client"
import { updateGymStatusSchema } from "@/modules/admin/admin.schema"
import { updateGymStatus } from "@/modules/admin/admin.service"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== UserRole.ADMIN)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const body = await req.json()
  const parsed = updateGymStatusSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  return NextResponse.json(await updateGymStatus(id, parsed.data.status))
}
