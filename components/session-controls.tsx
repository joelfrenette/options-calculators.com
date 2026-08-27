"use client"

/**
 * The header's session cluster: an Admin link that only an admin session
 * sees, and Sign out for everyone. Role comes from /api/auth/session — the
 * httpOnly cookie is unreadable here, which is correct. Display only: /admin
 * and every admin API stay gated server-side, so the worst a wrong answer
 * could do is draw a button that bounces.
 */

import { useEffect, useState } from "react"
import { Shield, LogOut } from "lucide-react"

export function SessionControls() {
  const [role, setRole] = useState<"admin" | "member" | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && (body?.role === "admin" || body?.role === "member")) setRole(body.role)
      })
      .catch(() => {
        /* signed-out or unreachable — render nothing */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const signOut = async () => {
    setBusy(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      window.location.assign("/")
    }
  }

  if (role === null) return null

  return (
    <div className="flex items-center gap-2">
      {role === "admin" && (
        <a
          href="/admin"
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Shield className="h-4 w-4" />
          Admin
        </a>
      )}
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" />
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  )
}
