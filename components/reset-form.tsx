"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"

/**
 * Two modes on one card, styled like the door's sign-in (stone palette):
 * no token → request a reset link by email; token → choose a new password.
 */
export function ResetForm() {
  const token = useSearchParams().get("token")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const request = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) setError(body?.error || `Request failed (HTTP ${res.status})`)
      else setMessage(body?.message || "If that address is a member, a reset link is on its way.")
    } catch {
      setError("Could not reach the reset service.")
    } finally {
      setBusy(false)
    }
  }

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError("The two passwords do not match")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) setError(body?.error || `Reset failed (HTTP ${res.status})`)
      else setDone(true)
    } catch {
      setError("Could not reach the reset service.")
    } finally {
      setBusy(false)
    }
  }

  const input =
    "h-11 border border-stone-200 rounded-[10px] px-3 text-sm text-stone-900 bg-stone-50 outline-none focus:border-stone-400"
  const button = "h-11 rounded-[10px] bg-stone-900 text-stone-50 text-sm font-semibold disabled:opacity-60"

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center">
      <div className="w-80 bg-white border border-stone-200 rounded-[14px] p-7 shadow-sm flex flex-col gap-3.5">
        {done ? (
          <>
            <div className="text-[15px] font-semibold text-stone-900">Password changed</div>
            <p className="text-sm text-stone-500">Sign in with the new one.</p>
            <a href="/login" className="text-sm font-semibold text-stone-900 underline underline-offset-2">
              Go to sign in
            </a>
          </>
        ) : token ? (
          <form onSubmit={confirmReset} className="flex flex-col gap-3.5">
            <div className="text-[15px] font-semibold text-stone-900">Choose a new password</div>
            <input
              type="password"
              required
              minLength={10}
              autoFocus
              placeholder="New password (min 10 chars)"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={input}
            />
            <input
              type="password"
              required
              minLength={10}
              placeholder="Repeat it"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={input}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="submit" disabled={busy} className={button}>
              {busy ? "Saving…" : "Set password"}
            </button>
          </form>
        ) : message ? (
          <>
            <div className="text-[15px] font-semibold text-stone-900">Check your email</div>
            <p className="text-sm text-stone-500">{message}</p>
          </>
        ) : (
          <form onSubmit={request} className="flex flex-col gap-3.5">
            <div className="text-[15px] font-semibold text-stone-900">Reset password</div>
            <p className="text-xs text-stone-500">
              Members get a reset link by email. The owner&apos;s credential is managed in the environment and has no
              email reset.
            </p>
            <input
              type="email"
              required
              autoFocus
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="submit" disabled={busy} className={button}>
              {busy ? "Sending…" : "Email me a reset link"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
