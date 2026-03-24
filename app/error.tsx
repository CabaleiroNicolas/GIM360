"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F6F3] px-4">
      <div className="text-center">
        <p className="text-8xl font-bold font-mono text-[#111110]">500</p>
        <h1 className="mt-4 text-2xl font-semibold text-[#111110]">
          Algo salio mal
        </h1>
        <p className="mt-2 text-sm text-[#68685F]">
          Ocurrio un error inesperado. Intenta de nuevo.
        </p>
        <button
          onClick={reset}
          className="mt-6 inline-block rounded-lg bg-[#111110] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2a2a28]"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  )
}
