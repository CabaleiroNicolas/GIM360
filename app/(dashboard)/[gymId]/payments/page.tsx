import PaymentsView from "./PaymentsView"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ gymId: string }>
}) {
  const { gymId } = await params
  return (
    <ErrorBoundary>
      <PaymentsView gymId={gymId} />
    </ErrorBoundary>
  )
}
