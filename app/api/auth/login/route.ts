import { NextResponse } from "next/server"
import { verifyCredentials, createSession } from "@/lib/auth"
import { verifyMemberCredentials, recordMemberLogin } from "@/lib/members"
import {
  checkLoginRateLimit,
  clearLoginFailures,
  getClientIp,
  pruneLoginAttempts,
  recordLoginAttempt,
} from "@/lib/login-rate-limit"

/**
 * Admin login (AUDIT_BACKLOG P4-3 hardening).
 *
 * Previously this accepted unlimited attempts and compared the password with a
 * plain `===`. Both are fixed: attempts are rate limited per IP via the
 * Supabase `login_attempts` table, and lib/auth.ts now compares in constant
 * time against a scrypt hash where one is configured.
 *
 * The rate limiter FAILS OPEN when Supabase is unreachable — see
 * lib/login-rate-limit.ts for why that is the right trade for this admin
 * specifically.
 */

// Rate limiting must see every request, never a cached response.
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const ip = getClientIp(request)

  try {
    const limit = await checkLoginRateLimit(ip)
    if (limit.blocked) {
      // Deliberately checked BEFORE reading the body or touching the password,
      // so a blocked caller cannot use this endpoint to do any work at all.
      return NextResponse.json(
        {
          error: `Too many failed sign-in attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`,
        },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      )
    }
    if (limit.degradedReason) {
      console.warn(`[auth] ${limit.degradedReason}`)
    }

    const { email, password } = await request.json()

    if (typeof email !== "string" || typeof password !== "string") {
      recordLoginAttempt(ip, false)
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Admin first (env credentials), then the invited-members table. Both
    // verifiers run their comparison in constant time; the member check also
    // does the same scrypt work for an unknown email as for a real one, so
    // the two paths do not disagree about how long "wrong" takes.
    const isAdmin = await verifyCredentials(email, password)
    const isMember = isAdmin ? false : await verifyMemberCredentials(email, password)

    if (!isAdmin && !isMember) {
      recordLoginAttempt(ip, false)
      // Same message and status for a wrong email as for a wrong password —
      // the endpoint must not confirm which address is valid.
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    await createSession(isAdmin ? "admin" : "member", email.trim().toLowerCase())
    if (isMember) recordMemberLogin(email)
    recordLoginAttempt(ip, true)
    clearLoginFailures(ip)
    pruneLoginAttempts()

    return NextResponse.json({ success: true })
  } catch (error) {
    // A misconfiguration (no ADMIN_EMAIL / no password set at all) throws out of
    // verifyCredentials. Log the real reason server-side; tell the client
    // nothing beyond "it failed".
    console.error("[auth] Login failed:", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
