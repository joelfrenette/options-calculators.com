import { cookies } from "next/headers"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

export async function verifyCredentials(email: string, password: string) {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set")
  }
  return email === ADMIN_EMAIL && password === ADMIN_PASSWORD
}

export async function createSession() {
  const sessionToken = Math.random().toString(36).substring(2) + Date.now().toString(36)
  ;(await cookies()).set("admin-session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
  return sessionToken
}

export async function getSession() {
  return (await cookies()).get("admin-session")?.value
}

export async function deleteSession() {
  ;(await cookies()).delete("admin-session")
}

export async function isAuthenticated() {
  const session = await getSession()
  return !!session
}

export async function verifyAuth(request: Request) {
  const session = await getSession()

  if (!session) {
    return {
      authenticated: false,
      error: "No session found",
    }
  }

  return {
    authenticated: true,
    session,
  }
}
