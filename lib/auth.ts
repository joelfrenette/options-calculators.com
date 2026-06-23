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

export async function verifyCredentials(email: string, password: string) {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set")
  }
  return email === ADMIN_EMAIL && password === ADMIN_PASSWORD
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
