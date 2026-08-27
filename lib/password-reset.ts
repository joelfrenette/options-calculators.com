import crypto from "node:crypto"
import { Resend } from "resend"
import { resolveApiKey } from "@/lib/api-keys"
import { findMemberByEmail, setMemberPassword } from "@/lib/members"

/**
 * Password reset by email, for MEMBERS only (closes the member half of
 * AUDIT_BACKLOG P4-2).
 *
 * The ADMIN credential is deliberately out of scope: it lives in the
 * environment (ADMIN_PASSWORD_HASH), and no email flow can — or should —
 * change an env var. A reset request for the admin email is a silent no-op
 * with the same outward response, so the endpoint is not an oracle for which
 * address is the admin. /login's recovery note covers the admin case.
 *
 * Token discipline: 32 random bytes, sent ONLY inside the emailed link; the
 * table stores its sha256. 30-minute expiry, single use, and issuing a new
 * token invalidates the member's earlier ones. A per-member cooldown keeps
 * the endpoint from being a mail cannon; the caller adds per-IP limits.
 */

const TOKEN_TTL_MS = 30 * 60 * 1000
const COOLDOWN_MS = 2 * 60 * 1000

function config(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  return url && key ? { url, key } : null
}

function headers(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex")

/**
 * Create a token for `email` and send the reset link. ALWAYS resolves without
 * revealing whether the email belongs to anyone — the caller returns the same
 * response either way. `origin` is the site the link points back to.
 */
export async function requestPasswordReset(email: string, origin: string): Promise<void> {
  const cfg = config()
  if (!cfg) return

  const member = await findMemberByEmail(email)
  if (!member || !member.active) return // unknown, inactive, or the admin: silent

  try {
    // Cooldown: a token minted in the last two minutes means we already sent.
    const recent = await fetch(
      `${cfg.url}/rest/v1/password_resets?select=created_at&member_id=eq.${member.id}&order=created_at.desc&limit=1`,
      { headers: headers(cfg.key), signal: AbortSignal.timeout(5000), cache: "no-store" },
    )
    if (recent.ok) {
      const rows = await recent.json()
      if (Array.isArray(rows) && rows.length && Date.now() - new Date(rows[0].created_at).getTime() < COOLDOWN_MS) {
        return
      }
    }

    const token = crypto.randomBytes(32).toString("base64url")

    // New token invalidates the old ones — expire them rather than delete, so
    // the cooldown above still sees the mint time.
    await fetch(`${cfg.url}/rest/v1/password_resets?member_id=eq.${member.id}&used_at=is.null`, {
      method: "PATCH",
      headers: headers(cfg.key),
      body: JSON.stringify({ expires_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    })

    const inserted = await fetch(`${cfg.url}/rest/v1/password_resets`, {
      method: "POST",
      headers: { ...headers(cfg.key), Prefer: "return=minimal" },
      body: JSON.stringify({
        member_id: member.id,
        token_hash: sha256(token),
        expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!inserted.ok) return

    const resendKey = resolveApiKey("RESEND_API_KEY")
    if (!resendKey) {
      console.warn("[reset] RESEND_API_KEY is not configured; reset email not sent")
      return
    }
    const link = `${origin}/reset?token=${token}`
    await new Resend(resendKey).emails.send({
      from: "Options Calculator <noreply@options-calculators.com>",
      to: member.email,
      subject: "Reset your password",
      text:
        `Someone asked to reset the password for ${member.email} on options-calculators.com.\n\n` +
        `If that was you, open this link within 30 minutes:\n\n${link}\n\n` +
        `If it was not you, ignore this email — nothing changes without the link.`,
    })
  } catch (e) {
    console.error("[reset] request failed:", e instanceof Error ? e.message : String(e))
  }
}

/**
 * Consume `token` and set the member's password. Returns a user-safe error
 * string, or null on success. Never names the member.
 */
export async function confirmPasswordReset(token: string, password: string): Promise<string | null> {
  const cfg = config()
  if (!cfg) return "Reset is not available right now"
  if (password.length < 10) return "Password must be at least 10 characters"

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/password_resets?select=id,member_id,expires_at,used_at&token_hash=eq.${sha256(token)}&limit=1`,
      { headers: headers(cfg.key), signal: AbortSignal.timeout(5000), cache: "no-store" },
    )
    if (!res.ok) return "Reset is not available right now"
    const rows = await res.json()
    const row = Array.isArray(rows) && rows.length ? rows[0] : null
    if (!row || row.used_at || Date.now() > new Date(row.expires_at).getTime()) {
      return "That link is invalid or has expired — request a new one"
    }

    const updated = await setMemberPassword(row.member_id, password)
    if (!updated) return "Reset is not available right now"

    await fetch(`${cfg.url}/rest/v1/password_resets?id=eq.${row.id}`, {
      method: "PATCH",
      headers: headers(cfg.key),
      body: JSON.stringify({ used_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    })
    return null
  } catch {
    return "Reset is not available right now"
  }
}
