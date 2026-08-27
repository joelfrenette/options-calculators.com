import { NextResponse } from "next/server"
import { requestPasswordReset } from "@/lib/password-reset"
import { checkLoginRateLimit, getClientIp } from "@/lib/login-rate-limit"

/**
 * Ask for a password-reset email (members only; the admin credential is an
 * env var and has no email path — see lib/password-reset.ts).
 *
 * The response is IDENTICAL whether the email belongs to a member, the
 * admin, or nobody: this endpoint must not be an oracle for who is invited.
 * Abuse control is layered — the login rate limiter's per-IP block applies
 * (without recording attempts, so asking for a reset never locks a real
 * user's sign-in), and lib/password-reset.ts adds a per-member cooldown.
 */

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const limit = await checkLoginRateLimit(ip)
  if (limit.blocked) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    )
  }

  let email: unknown
  try {
    ;({ email } = await request.json())
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "An email address is required" }, { status: 400 })
  }

  const origin = new URL(request.url).origin
  await requestPasswordReset(email, origin)

  // Same answer for every address, deliberately.
  return NextResponse.json({ ok: true, message: "If that address is a member, a reset link is on its way." })
}
