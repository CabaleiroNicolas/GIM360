import MetricsView from "./MetricsView"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

export default async function MetricsPage({
  params,
}: {
  params: Promise<{ gymId: string }>
}) {
  const { gymId } = await params
  return (
    <ErrorBoundary>
      <MetricsView gymId={gymId} />
    </ErrorBoundary>
  )
}
