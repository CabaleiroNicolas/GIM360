export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E5E4E0] border-t-[#111110]" />
        <p className="text-sm text-[#68685F]">Cargando...</p>
      </div>
    </div>
  )
}
