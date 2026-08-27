import crypto from "node:crypto"

/**
 * Invited members of the private site (the owner plus a few friends).
 *
 * Storage is the Supabase `members` table, reached over raw REST with the
 * service-role key — the same idiom as lib/metered-fetch.ts and
 * lib/fred-store.ts, so no client library is added for four rows. RLS is
 * enabled with no policies: only the service key can read or write.
 *
 * Passwords are stored as `scrypt:<saltHex>:<hashHex>` — the exact format
 * lib/auth.ts uses for ADMIN_PASSWORD_HASH (P4-3), so one verifier shape
 * serves both. Verification always performs a scrypt comparison even when the
 * email matches no row, so "unknown email" and "wrong password" cost the same
 * time and the endpoint is not an oracle for who is invited.
 */

export interface Member {
  id: number
  email: string
  active: boolean
  created_at: string
  last_login_at: string | null
}

function config(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  return url && key ? { url, key } : null
}

function headers(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  }
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, 32)
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`
}

function verifyScrypt(password: string, stored: string): boolean {
  const parts = stored.replace(/\s+/g, "").split(":")
  if (parts.length !== 3 || parts[0] !== "scrypt") return false
  try {
    const salt = Buffer.from(parts[1], "hex")
    const expected = Buffer.from(parts[2], "hex")
    if (salt.length === 0 || expected.length === 0) return false
    const actual = crypto.scryptSync(password, salt, expected.length)
    return crypto.timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

// A real hash of a random throwaway password, computed once per process. It is
// what gets verified when the email matches no member, so the work done — and
// the response time — is the same as for a real row.
const DUMMY_HASH = hashPassword(crypto.randomBytes(24).toString("hex"))

/**
 * True when `email`/`password` belong to an ACTIVE member. Never throws:
 * storage being unreachable reads as "wrong credentials" (the admin env login
 * in lib/auth.ts is unaffected by that failure, so the owner is never locked
 * out by a Supabase outage).
 */
export async function verifyMemberCredentials(email: string, password: string): Promise<boolean> {
  const cfg = config()
  if (!cfg) {
    verifyScrypt(password, DUMMY_HASH)
    return false
  }
  let row: { password_hash: string; active: boolean } | null = null
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/members?select=password_hash,active&email=eq.${encodeURIComponent(email.trim().toLowerCase())}&limit=1`,
      { headers: headers(cfg.key), signal: AbortSignal.timeout(5000), cache: "no-store" },
    )
    if (res.ok) {
      const rows = await res.json()
      row = Array.isArray(rows) && rows.length ? rows[0] : null
    }
  } catch {
    row = null
  }
  const ok = verifyScrypt(password, row?.password_hash ?? DUMMY_HASH)
  return ok && row !== null && row.active === true
}

/** Best-effort login-time stamp; failure changes nothing about the session. */
export async function recordMemberLogin(email: string): Promise<void> {
  const cfg = config()
  if (!cfg) return
  try {
    await fetch(`${cfg.url}/rest/v1/members?email=eq.${encodeURIComponent(email.trim().toLowerCase())}`, {
      method: "PATCH",
      headers: headers(cfg.key),
      body: JSON.stringify({ last_login_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    /* stamp only */
  }
}

export async function listMembers(): Promise<Member[] | null> {
  const cfg = config()
  if (!cfg) return null
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/members?select=id,email,active,created_at,last_login_at&order=created_at.asc`,
      { headers: headers(cfg.key), signal: AbortSignal.timeout(8000), cache: "no-store" },
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function addMember(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = config()
  if (!cfg) return { ok: false, error: "Member storage is not configured (SUPABASE_URL / key missing)" }
  const clean = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, error: "That does not look like an email address" }
  if (password.length < 10) return { ok: false, error: "Password must be at least 10 characters" }
  try {
    const res = await fetch(`${cfg.url}/rest/v1/members`, {
      method: "POST",
      headers: { ...headers(cfg.key), Prefer: "return=minimal" },
      body: JSON.stringify({ email: clean, password_hash: hashPassword(password) }),
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 409) return { ok: false, error: "That email is already a member" }
    if (!res.ok) return { ok: false, error: `Storage answered HTTP ${res.status}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Storage unreachable" }
  }
}

export async function setMemberActive(id: number, active: boolean): Promise<boolean> {
  const cfg = config()
  if (!cfg) return false
  try {
    const res = await fetch(`${cfg.url}/rest/v1/members?id=eq.${id}`, {
      method: "PATCH",
      headers: headers(cfg.key),
      body: JSON.stringify({ active }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function removeMember(id: number): Promise<boolean> {
  const cfg = config()
  if (!cfg) return false
  try {
    const res = await fetch(`${cfg.url}/rest/v1/members?id=eq.${id}`, {
      method: "DELETE",
      headers: headers(cfg.key),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}
