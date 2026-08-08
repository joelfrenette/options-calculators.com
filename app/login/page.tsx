"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AlertCircle, Lock } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  // "Recovery instructions" panel, not a reset form — see AUDIT_BACKLOG P4-2.
  const [resetMode, setResetMode] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        // A rate-limit lockout (429) and a server misconfiguration (500) are
        // not "wrong password" — showing that for either sends the admin off
        // retyping a correct password while the real cause goes unmentioned.
        if (response.status === 429 || response.status === 500) {
          const body = await response.json().catch(() => ({}))
          setError(
            body?.error ||
              (response.status === 429
                ? "Too many failed sign-in attempts. Try again shortly."
                : "Sign-in is misconfigured on the server. Check the deployment logs."),
          )
          return
        }
        throw new Error("Invalid credentials")
      }

      router.push("/admin")
    } catch (err) {
      setError("Invalid email or password")
    } finally {
      setLoading(false)
    }
  }

  // There is deliberately no handlePasswordReset. The admin credential is the
  // ADMIN_PASSWORD_HASH / ADMIN_PASSWORD environment variable, and no web
  // request can change an environment variable — so a reset flow is impossible
  // by construction, not merely unbuilt. The previous version faked one: a
  // Math.random() token stored nowhere, a link to a page that 404s, and a green
  // "Password reset email sent! Check your inbox." The owner followed it while
  // locked out. AUDIT_BACKLOG P4-2.

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md bg-white shadow-2xl">
        <CardHeader className="space-y-1 bg-white">
          <div className="flex items-center justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center">
              <Lock className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center text-slate-900">Admin Login</CardTitle>
          <CardDescription className="text-center text-slate-600">
            {resetMode ? "Recovering admin access" : "Enter your credentials to access the admin dashboard"}
          </CardDescription>
        </CardHeader>
        <CardContent className="bg-white">
          {!resetMode ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-900">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white text-slate-900 border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-900">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white text-slate-900 border-slate-300"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>

              <button
                type="button"
                onClick={() => setResetMode(true)}
                className="w-full text-sm text-blue-600 hover:underline font-medium"
              >
                Forgot password?
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-slate-700 bg-amber-50 border border-amber-200 p-3 rounded space-y-2">
                <p className="font-semibold text-amber-900">There is no self-service reset for this account.</p>
                <p>
                  The admin password is an environment variable, so it cannot be changed from this page. Recovering it
                  means updating it in Vercel and redeploying:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-700">
                  <li>
                    Generate a hash: <code className="text-xs">node scripts/hash-admin-password.ts</code>
                  </li>
                  <li>
                    Vercel → project → Settings → Environment Variables → set{" "}
                    <code className="text-xs">ADMIN_PASSWORD_HASH</code>
                  </li>
                  <li>Redeploy — environment variables only take effect on a new build.</li>
                  <li>Sign in here with the new password.</li>
                </ol>
              </div>

              <button
                type="button"
                onClick={() => {
                  setResetMode(false)
                  setError("")
                }}
                className="w-full text-sm text-blue-600 hover:underline font-medium"
              >
                Back to login
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
