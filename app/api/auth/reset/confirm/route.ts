import { NextResponse } from "next/server"
import { confirmPasswordReset } from "@/lib/password-reset"
import { checkLoginRateLimit, getClientIp } from "@/lib/login-rate-limit"

/**
 * Trade a valid reset token for a new member password. Token discipline lives
 * in lib/password-reset.ts (sha256-stored, 30-min expiry, single use). The
 * error strings never name a member.
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

  let token: unknown, password: unknown
  try {
    ;({ token, password } = await request.json())
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }
  if (typeof token !== "string" || typeof password !== "string" || !token) {
    return NextResponse.json({ error: "token and password are required" }, { status: 400 })
  }

  const error = await confirmPasswordReset(token, password)
  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
