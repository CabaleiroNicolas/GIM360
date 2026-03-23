import { Label } from "./Label"

interface StatCardProps {
  label: string
  value: string | number
  valueColor?: string
  subtitle?: string
}

export function StatCard({ label, value, valueColor = "text-[#111110]", subtitle }: StatCardProps) {
  return (
    <div className="rounded-xl border border-[#E5E4E0] bg-white px-4 py-4 sm:px-5">
      <Label>{label}</Label>
      <p className={`mt-2 text-2xl font-bold font-mono sm:text-3xl ${valueColor}`}>
        {value}
      </p>
      {subtitle && <p className="mt-1 text-xs text-[#A5A49D] font-mono">{subtitle}</p>}
    </div>
  )
}
