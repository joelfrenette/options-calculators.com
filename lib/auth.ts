import { cookies } from "next/headers"
import crypto from "node:crypto"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

const COOKIE_NAME = "admin-session"
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days, in seconds

// Secret used to sign session tokens. Prefer a dedicated SESSION_SECRET, but
// fall back to ENCRYPTION_KEY so existing deployments keep working.
function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY
  if (!secret) {
    throw new Error("SESSION_SECRET (or ENCRYPTION_KEY) environment variable must be set")
  }
  return secret
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("hex")
}

// Token format: "<base64url(payload)>.<hmac>" where payload = { exp: <ms> }.
function createToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_MAX_AGE * 1000 })).toString("base64url")
  return `${payload}.${sign(payload)}`
}

function verifyToken(token: string | undefined): boolean {
  if (!token) return false

  const [payload, signature] = token.split(".")
  if (!payload || !signature) return false

  // Constant-time signature comparison.
  let expected: string
  try {
    expected = sign(payload)
  } catch {
    return false
  }
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false
  }

  // Signature is valid — now check expiry.
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString())
    return typeof exp === "number" && Date.now() < exp
  } catch {
    return false
  }
}

// --- Credential verification (AUDIT_BACKLOG P4-3) --------------------------
//
// This used to be `email === ADMIN_EMAIL && password === ADMIN_PASSWORD`.
// Two problems: `===` on a secret short-circuits at the first differing byte,
// which leaks its length and content through timing; and the password lived in
// the environment as plaintext.
//
// Both sides are now compared in constant time, and a scrypt hash is preferred
// over the plaintext env var. The plaintext path still works so that setting
// ADMIN_PASSWORD_HASH is a migration rather than a lockout — the owner has
// already been locked out of this admin once and there is no working
// self-service reset (P4-2).

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH

/**
 * Constant-time string compare. Hashing both sides first gives timingSafeEqual
 * the equal-length buffers it requires, so inputs of different lengths do not
 * throw and do not reveal the length difference.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest()
  const hb = crypto.createHash("sha256").update(b, "utf8").digest()
  return crypto.timingSafeEqual(ha, hb)
}

/**
 * Verify a password against a stored `scrypt:<saltHex>:<hashHex>` string.
 * Returns false on any malformed value rather than throwing — a corrupt hash
 * must read as "wrong password", never as a 500 that reveals the format.
 */
function verifyScrypt(password: string, stored: string): boolean {
  const parts = stored.split(":")
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

let plaintextWarned = false

export async function verifyCredentials(email: string, password: string) {
  if (!ADMIN_EMAIL) {
    throw new Error("ADMIN_EMAIL environment variable must be set")
  }
  if (!ADMIN_PASSWORD_HASH && !ADMIN_PASSWORD) {
    throw new Error("Set ADMIN_PASSWORD_HASH (preferred) or ADMIN_PASSWORD")
  }

  // Email is not a secret, but comparing it in constant time too keeps the
  // response time identical for "wrong email" and "wrong password" — otherwise
  // the endpoint is an oracle for which admin address is valid.
  const emailOk = safeEqual(email.trim().toLowerCase(), ADMIN_EMAIL.trim().toLowerCase())

  let passwordOk: boolean
  if (ADMIN_PASSWORD_HASH) {
    passwordOk = verifyScrypt(password, ADMIN_PASSWORD_HASH)
  } else {
    if (!plaintextWarned) {
      plaintextWarned = true
      console.warn(
        "[auth] Using the plaintext ADMIN_PASSWORD env var. Generate a hash with " +
          "`node scripts/hash-admin-password.ts` and set ADMIN_PASSWORD_HASH instead.",
      )
    }
    passwordOk = safeEqual(password, ADMIN_PASSWORD as string)
  }

  // Deliberately not short-circuiting: both comparisons always run, so the
  // work done is the same whichever half is wrong.
  return emailOk && passwordOk
}

/** True when the stronger hashed-credential path is in use. For the admin UI. */
export function isPasswordHashed(): boolean {
  return !!ADMIN_PASSWORD_HASH
}

export async function createSession() {
  const token = createToken()
  ;(await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
  })
  return token
}

export async function getSession() {
  return (await cookies()).get(COOKIE_NAME)?.value
}

export async function deleteSession() {
  ;(await cookies()).delete(COOKIE_NAME)
}

export async function isAuthenticated() {
  return verifyToken(await getSession())
}

export async function verifyAuth(_request?: Request) {
  const session = await getSession()

  if (!verifyToken(session)) {
    return {
      authenticated: false as const,
      error: "Invalid or missing session",
    }
  }

  return {
    authenticated: true as const,
    session,
  }
}
