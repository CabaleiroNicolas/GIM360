export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#F0EFEB] ${className ?? ""}`} />
}

export function SkeletonMetrics() {
  return (
    <div className="space-y-5">
      {/* Hero card */}
      <div className="rounded-xl border border-[#E5E4E0] bg-white p-5 space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-48" />
      </div>
      {/* 2-col grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-[#E5E4E0] bg-white p-4 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
      {/* Costos section */}
      <div className="rounded-xl border border-[#E5E4E0] bg-[#FAFAF9] p-4 space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-[#E5E4E0] bg-white p-4 space-y-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-[#E5E4E0] bg-white overflow-hidden">
      {/* header row */}
      <div className="border-b border-[#F0EFEB] px-5 py-3.5 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 flex-1" />
        ))}
      </div>
      {/* data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`px-5 py-4 flex gap-4 ${i > 0 ? "border-t border-[#F7F6F3]" : ""}`}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={`h-3.5 ${j === 0 ? "flex-[2]" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  )
}
