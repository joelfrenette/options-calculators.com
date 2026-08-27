"use client"

/**
 * Invited-members panel for the admin Keys tab (owner decision 2026-08-14:
 * the site is a private club). Lists the rows of the Supabase `members`
 * table, adds one (email + temp password the owner shares out of band),
 * disables/enables, removes. Talks only to /api/admin/members, which is
 * admin-session gated; no hash ever reaches this component.
 */

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users } from "lucide-react"

interface MemberRow {
  id: number
  email: string
  active: boolean
  created_at: string
  last_login_at: string | null
}

export function MembersManager() {
  const [members, setMembers] = useState<MemberRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/admin/members")
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setMembers(null)
        setError(body?.error || `HTTP ${res.status}`)
        return
      }
      setMembers(body.members)
    } catch {
      setMembers(null)
      setError("Could not reach /api/admin/members")
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error || `HTTP ${res.status}`)
      } else {
        setEmail("")
        setPassword("")
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  const patch = async (id: number, active: boolean) => {
    setError(null)
    const res = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    })
    if (!res.ok) setError(`Update failed (HTTP ${res.status})`)
    await load()
  }

  const remove = async (id: number, memberEmail: string) => {
    if (!window.confirm(`Remove ${memberEmail}? Their sign-in stops working immediately.`)) return
    setError(null)
    const res = await fetch("/api/admin/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) setError(`Remove failed (HTTP ${res.status})`)
    await load()
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-400" />
          Members
        </CardTitle>
        <CardDescription className="text-slate-400">
          Who can sign in besides you. Share the temporary password out of band; the site stores only its hash.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-400">{error}</p>}

        {members === null && !error && <p className="text-sm text-slate-400">Loading…</p>}

        {members !== null && members.length === 0 && (
          <p className="text-sm text-slate-400">No members yet — it is just you.</p>
        )}

        {members !== null && members.length > 0 && (
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900 px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className={`text-sm ${m.active ? "text-white" : "text-slate-500 line-through"}`}>{m.email}</span>
                  <span className="text-xs text-slate-500">
                    {m.last_login_at ? `Last sign-in ${new Date(m.last_login_at).toLocaleString()}` : "Never signed in"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-600 text-slate-200 hover:bg-slate-700 bg-transparent"
                    onClick={() => patch(m.id, !m.active)}
                  >
                    {m.active ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-800 text-red-400 hover:bg-red-950 bg-transparent"
                    onClick={() => remove(m.id, m.email)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={add} className="flex flex-wrap items-end gap-2 border-t border-slate-700 pt-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="member-email" className="text-xs text-slate-400">
              Email
            </label>
            <input
              id="member-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 w-56 rounded border border-slate-600 bg-slate-900 px-2 text-sm text-white outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="member-password" className="text-xs text-slate-400">
              Temp password (min 10 chars)
            </label>
            <input
              id="member-password"
              type="text"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 w-56 rounded border border-slate-600 bg-slate-900 px-2 text-sm text-white outline-none focus:border-emerald-500"
            />
          </div>
          <Button type="submit" disabled={busy} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
            {busy ? "Adding…" : "Add member"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
