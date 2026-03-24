import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import GroupsView from "./GroupsView"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

export default async function GroupsPage({ params }: { params: Promise<{ gymId: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const { gymId } = await params
  return (
    <ErrorBoundary>
      <GroupsView gymId={gymId} />
    </ErrorBoundary>
  )
}
