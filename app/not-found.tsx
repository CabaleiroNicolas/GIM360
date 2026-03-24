import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F6F3] px-4">
      <div className="text-center">
        <p className="text-8xl font-bold font-mono text-[#111110]">404</p>
        <h1 className="mt-4 text-2xl font-semibold text-[#111110]">
          Pagina no encontrada
        </h1>
        <p className="mt-2 text-sm text-[#68685F]">
          La pagina que buscas no existe o fue movida.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-[#111110] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2a2a28]"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
