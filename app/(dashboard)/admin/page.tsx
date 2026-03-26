"use client"

import { useState, useEffect, useCallback } from "react"
import { signOut } from "next-auth/react"
import { FormModal } from "@/components/ui/FormModal"
import { FormField } from "@/components/ui/FormField"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"

// ─── Types ────────────────────────────────────────────────────────────────────

type GymStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED"

type Owner = {
  id: string
  name: string
  user: { email: string }
  _count: { gyms: number }
}

type AdminGym = {
  id: string
  name: string
  status: GymStatus
  address: string | null
  owner: { name: string; user: { email: string } }
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<GymStatus, { label: string; dot: string; text: string; badge: string }> = {
  ACTIVE:    { label: "Activo",     dot: "bg-emerald-500", text: "text-emerald-700", badge: "bg-emerald-50 text-emerald-700" },
  SUSPENDED: { label: "Suspendido", dot: "bg-red-500",     text: "text-red-700",     badge: "bg-red-50 text-red-700" },
  INACTIVE:  { label: "Inactivo",   dot: "bg-[#C8C7C3]",   text: "text-[#A5A49D]",  badge: "bg-[#F0EFEB] text-[#A5A49D]" },
}

const STATUS_OPTIONS: GymStatus[] = ["ACTIVE", "INACTIVE", "SUSPENDED"]

// ─── Empty form states ────────────────────────────────────────────────────────

const EMPTY_OWNER_FORM = { name: "", email: "", password: "" }
const EMPTY_GYM_FORM = { name: "", address: "", phone: "", ownerId: "" }

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  // Data state
  const [owners, setOwners] = useState<Owner[]>([])
  const [gyms, setGyms] = useState<AdminGym[]>([])
  const [loadingOwners, setLoadingOwners] = useState(true)
  const [loadingGyms, setLoadingGyms] = useState(true)
  const [ownersError, setOwnersError] = useState<string | null>(null)
  const [gymsError, setGymsError] = useState<string | null>(null)

  // Owner modal
  const [ownerModalOpen, setOwnerModalOpen] = useState(false)
  const [ownerForm, setOwnerForm] = useState(EMPTY_OWNER_FORM)
  const [ownerSubmitting, setOwnerSubmitting] = useState(false)
  const [ownerModalError, setOwnerModalError] = useState<string | null>(null)

  // Gym modal
  const [gymModalOpen, setGymModalOpen] = useState(false)
  const [gymForm, setGymForm] = useState(EMPTY_GYM_FORM)
  const [gymSubmitting, setGymSubmitting] = useState(false)
  const [gymModalError, setGymModalError] = useState<string | null>(null)

  // Status change tracking: gymId → loading
  const [statusChanging, setStatusChanging] = useState<Record<string, boolean>>({})

  // ─── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchOwners = useCallback(async () => {
    setLoadingOwners(true)
    setOwnersError(null)
    try {
      const res = await fetch("/api/admin/owners")
      if (!res.ok) throw new Error("Error al cargar owners")
      const data = await res.json()
      setOwners(Array.isArray(data) ? data : [])
    } catch {
      setOwnersError("No se pudieron cargar los owners.")
    } finally {
      setLoadingOwners(false)
    }
  }, [])

  const fetchGyms = useCallback(async () => {
    setLoadingGyms(true)
    setGymsError(null)
    try {
      const res = await fetch("/api/admin/gyms")
      if (!res.ok) throw new Error("Error al cargar gimnasios")
      const data = await res.json()
      setGyms(Array.isArray(data) ? data : [])
    } catch {
      setGymsError("No se pudieron cargar los gimnasios.")
    } finally {
      setLoadingGyms(false)
    }
  }, [])

  useEffect(() => {
    fetchOwners()
    fetchGyms()
  }, [fetchOwners, fetchGyms])

  // ─── Owner form handlers ────────────────────────────────────────────────────

  function openOwnerModal() {
    setOwnerForm(EMPTY_OWNER_FORM)
    setOwnerModalError(null)
    setOwnerModalOpen(true)
  }

  function closeOwnerModal() {
    setOwnerModalOpen(false)
  }

  async function handleOwnerSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ownerForm.name.trim() || !ownerForm.email.trim() || !ownerForm.password.trim()) {
      setOwnerModalError("Todos los campos son requeridos.")
      return
    }
    setOwnerSubmitting(true)
    setOwnerModalError(null)
    try {
      const res = await fetch("/api/admin/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ownerForm.name.trim(),
          email: ownerForm.email.trim(),
          password: ownerForm.password,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? "Error al crear owner")
      }
      setOwnerModalOpen(false)
      setOwnerForm(EMPTY_OWNER_FORM)
      // Reload owners so the new one appears in the gym form select
      await fetchOwners()
    } catch (err) {
      setOwnerModalError(err instanceof Error ? err.message : "Error al crear owner")
    } finally {
      setOwnerSubmitting(false)
    }
  }

  // ─── Gym form handlers ──────────────────────────────────────────────────────

  function openGymModal() {
    setGymForm({ ...EMPTY_GYM_FORM, ownerId: owners[0]?.id ?? "" })
    setGymModalError(null)
    setGymModalOpen(true)
  }

  function closeGymModal() {
    setGymModalOpen(false)
  }

  async function handleGymSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!gymForm.name.trim() || !gymForm.ownerId) {
      setGymModalError("Nombre y owner son requeridos.")
      return
    }
    setGymSubmitting(true)
    setGymModalError(null)
    try {
      const body: Record<string, string> = {
        name: gymForm.name.trim(),
        ownerId: gymForm.ownerId,
      }
      if (gymForm.address.trim()) body.address = gymForm.address.trim()
      if (gymForm.phone.trim()) body.phone = gymForm.phone.trim()

      const res = await fetch("/api/admin/gyms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}))
        throw new Error(resBody?.error ?? "Error al crear gimnasio")
      }
      setGymModalOpen(false)
      setGymForm(EMPTY_GYM_FORM)
      await fetchGyms()
    } catch (err) {
      setGymModalError(err instanceof Error ? err.message : "Error al crear gimnasio")
    } finally {
      setGymSubmitting(false)
    }
  }

  // ─── Status change handler ──────────────────────────────────────────────────

  async function handleStatusChange(gymId: string, newStatus: GymStatus) {
    setStatusChanging((prev) => ({ ...prev, [gymId]: true }))
    try {
      const res = await fetch(`/api/admin/gyms/${gymId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Error al actualizar estado")
      // Update inline without reloading all
      setGyms((prev) =>
        prev.map((g) => (g.id === gymId ? { ...g, status: newStatus } : g))
      )
    } catch {
      // Silent fail — state stays as-is; could add a toast here
    } finally {
      setStatusChanging((prev) => {
        const next = { ...prev }
        delete next[gymId]
        return next
      })
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      {/* Header */}
      <header className="border-b border-[#E5E4E0] bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#111110]">
            GYM360
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">
              Panel Admin
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="cursor-pointer text-xs font-medium text-[#68685F] hover:text-[#111110] transition-colors min-h-[44px] px-2 flex items-center"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 space-y-10">

        {/* ── Owners section ─────────────────────────────────────────────── */}
        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <h2 className="text-xl font-semibold text-[#111110]">Owners</h2>
              <p className="mt-0.5 text-sm text-[#68685F]">Propietarios de gimnasios registrados.</p>
            </div>
            <Button onClick={openOwnerModal} className="min-h-[44px] sm:min-h-0">
              Nuevo owner
            </Button>
          </div>

          {ownersError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {ownersError}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-[#E5E4E0] bg-white">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-[#F0EFEB]">
                  <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">
                    Nombre
                  </th>
                  <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">
                    Email
                  </th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">
                    Gimnasios
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingOwners ? (
                  <tr>
                    <td colSpan={3} className="py-16 text-center text-sm text-[#A5A49D]">
                      Cargando…
                    </td>
                  </tr>
                ) : owners.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-14 text-center text-sm text-[#68685F]">
                      Sin owners registrados.
                    </td>
                  </tr>
                ) : (
                  owners.map((owner, i) => (
                    <tr
                      key={owner.id}
                      className={`hover:bg-[#FAFAF9] transition-colors ${i > 0 ? "border-t border-[#F0EFEB]" : ""}`}
                    >
                      <td className="px-4 py-3.5 font-medium text-[#111110]">
                        {owner.name}
                      </td>
                      <td className="px-4 py-3.5 text-[#68685F]">
                        {owner.user.email}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-[#111110]">
                        {owner._count.gyms}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Gyms section ───────────────────────────────────────────────── */}
        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <h2 className="text-xl font-semibold text-[#111110]">Gimnasios</h2>
              <p className="mt-0.5 text-sm text-[#68685F]">Todos los gimnasios en la plataforma.</p>
            </div>
            <Button onClick={openGymModal} className="min-h-[44px] sm:min-h-0">
              Nuevo gimnasio
            </Button>
          </div>

          {gymsError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {gymsError}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-[#E5E4E0] bg-white">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-[#F0EFEB]">
                  <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">
                    Gimnasio
                  </th>
                  <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">
                    Owner
                  </th>
                  <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">
                    Estado
                  </th>
                  <th className="px-4 py-3.5 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">
                    Cambiar estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingGyms ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-sm text-[#A5A49D]">
                      Cargando…
                    </td>
                  </tr>
                ) : gyms.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-14 text-center text-sm text-[#68685F]">
                      Sin gimnasios registrados.
                    </td>
                  </tr>
                ) : (
                  gyms.map((gym, i) => {
                    const cfg = STATUS_CONFIG[gym.status]
                    const isChanging = !!statusChanging[gym.id]
                    return (
                      <tr
                        key={gym.id}
                        className={`hover:bg-[#FAFAF9] transition-colors ${i > 0 ? "border-t border-[#F0EFEB]" : ""}`}
                      >
                        {/* Name + address */}
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-[#111110]">{gym.name}</p>
                          {gym.address && (
                            <p className="mt-0.5 text-xs text-[#A5A49D]">{gym.address}</p>
                          )}
                        </td>

                        {/* Owner */}
                        <td className="px-4 py-3.5 text-[#68685F]">
                          <p>{gym.owner.name}</p>
                          <p className="text-xs text-[#A5A49D]">{gym.owner.user.email}</p>
                        </td>

                        {/* Status pill */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                            <span className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</span>
                          </div>
                        </td>

                        {/* Status select */}
                        <td className="px-4 py-3.5 text-right">
                          <Select
                            value={gym.status}
                            disabled={isChanging}
                            onChange={(e) =>
                              handleStatusChange(gym.id, e.target.value as GymStatus)
                            }
                            className="text-xs py-1.5 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_CONFIG[s].label}
                              </option>
                            ))}
                          </Select>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* ── Owner modal ────────────────────────────────────────────────────── */}
      <FormModal
        open={ownerModalOpen}
        title="Nuevo owner"
        error={ownerModalError}
        onSubmit={handleOwnerSubmit}
        submitting={ownerSubmitting}
        onCancel={closeOwnerModal}
        gridCols="sm:grid-cols-1"
        submitLabel="Crear owner"
      >
        <FormField label="Nombre" required>
          <Input
            type="text"
            placeholder="Ej: Juan Pérez"
            value={ownerForm.name}
            onChange={(e) => setOwnerForm((f) => ({ ...f, name: e.target.value }))}
            required
            className="w-full"
          />
        </FormField>

        <FormField label="Email" required>
          <Input
            type="email"
            placeholder="Ej: juan@email.com"
            value={ownerForm.email}
            onChange={(e) => setOwnerForm((f) => ({ ...f, email: e.target.value }))}
            required
            className="w-full"
          />
        </FormField>

        <FormField label="Contraseña" required>
          <Input
            type="password"
            placeholder="Mínimo 8 caracteres"
            value={ownerForm.password}
            onChange={(e) => setOwnerForm((f) => ({ ...f, password: e.target.value }))}
            required
            minLength={8}
            className="w-full"
          />
        </FormField>
      </FormModal>

      {/* ── Gym modal ──────────────────────────────────────────────────────── */}
      <FormModal
        open={gymModalOpen}
        title="Nuevo gimnasio"
        error={gymModalError}
        onSubmit={handleGymSubmit}
        submitting={gymSubmitting}
        onCancel={closeGymModal}
        gridCols="sm:grid-cols-1"
        submitLabel="Crear gimnasio"
      >
        <FormField label="Nombre" required>
          <Input
            type="text"
            placeholder="Ej: Club Atlético Tigre"
            value={gymForm.name}
            onChange={(e) => setGymForm((f) => ({ ...f, name: e.target.value }))}
            required
            className="w-full"
          />
        </FormField>

        <FormField label="Owner" required>
          <Select
            value={gymForm.ownerId}
            onChange={(e) => setGymForm((f) => ({ ...f, ownerId: e.target.value }))}
            required
            className="w-full"
          >
            <option value="" disabled>
              Seleccionar owner…
            </option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.user.email})
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Dirección">
          <Input
            type="text"
            placeholder="Ej: Av. Corrientes 1234"
            value={gymForm.address}
            onChange={(e) => setGymForm((f) => ({ ...f, address: e.target.value }))}
            className="w-full"
          />
        </FormField>

        <FormField label="Teléfono">
          <Input
            type="tel"
            placeholder="Ej: +54 11 1234-5678"
            value={gymForm.phone}
            onChange={(e) => setGymForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full"
          />
        </FormField>
      </FormModal>
    </div>
  )
}
