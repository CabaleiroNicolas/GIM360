"use client"
import { Component, type ReactNode } from "react"

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-10 text-center">
          <p className="text-sm font-medium text-red-700">Algo salió mal en esta sección.</p>
          <p className="mt-1 text-xs text-red-500">{this.state.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}
