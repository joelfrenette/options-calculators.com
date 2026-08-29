import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * The whole-site gate (owner decision 2026-08-14: the site is a private club).
 *
 * Anonymous visitors get exactly one page — the front-door calculator, served
 * AT `/` via rewrite — plus /login and the auth endpoints. Every other page
 * redirects to `/`, and every other /api route answers 401. The API half is
 * the point: the app's routes spend paid API credits, and before this gate
 * most of them answered anyone who asked.
 *
 * Sessions are the same HMAC-signed cookie lib/auth.ts mints. This runs on
 * the edge runtime, where node:crypto is unavailable, so the signature is
 * verified with Web Crypto. Verification here decides ROUTING only; admin
 * routes still run their own verifyAuth (role-aware) on the node side.
 *
 * Deliberately public, in full:
 *   /            → the door (rewrite to /door when signed out)
 *   /door        → redirected to / so the calculator has one URL
 *   /login       → the plain sign-in page (bookmarkable; skips the theater)
 *   /api/auth/*  → login/logout themselves (login is rate-limited per IP)
 *   /api/cron/*  → pass through; each cron route enforces CRON_SECRET itself
 *   /robots.txt, /sitemap.xml, _next static, favicon — assets
 */

const encoder = new TextEncoder()

// CSRF defense for the SameSite=None session cookie (see lib/auth.ts). With
// "none", the browser attaches the session to cross-site requests too, so we
// reject any state-changing request whose Origin is a third party. A genuine
// request — whether the site is used directly or embedded in the Agent OS
// iframe — carries the site's OWN Origin (the iframe document is
// options-calculators.com), so it passes; an attacker's page carries theirs
// and is blocked. GETs are exempt (no state change; CORS already stops the
// attacker reading the response). Missing Origin = a non-browser client
// (curl, cron tooling), not a CSRF vector, so it passes.
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])
const ALLOWED_ORIGINS = new Set(
  [
    "https://www.options-calculators.com",
    "https://options-calculators.com",
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
  ].filter((o): o is string => Boolean(o)),
)

function isDisallowedCrossOriginWrite(request: NextRequest): boolean {
  if (!MUTATING_METHODS.has(request.method)) return false
  const origin = request.headers.get("origin")
  if (!origin) return false // non-browser client; browsers always send Origin on writes
  if (ALLOWED_ORIGINS.has(origin)) return false
  // Preview deploys (…-git-*.vercel.app) aren't in the static list; allow a
  // request whose Origin matches the URL it's hitting (same-origin either way).
  if (origin === request.nextUrl.origin) return false
  return true
}

function base64urlToBytes(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("admin-session")?.value
  if (!token) return false
  const dot = token.indexOf(".")
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const signature = hexToBytes(token.slice(dot + 1))
  if (!signature) return false

  const secret = process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY
  if (!secret) return false

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    )
    // crypto.subtle.verify is the platform's constant-time comparison.
    const ok = await crypto.subtle.verify("HMAC", key, signature, encoder.encode(payload))
    if (!ok) return false
  } catch {
    return false
  }

  const raw = base64urlToBytes(payload)
  if (!raw) return false
  try {
    const { exp } = JSON.parse(new TextDecoder().decode(raw))
    return typeof exp === "number" && Date.now() < exp
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // CSRF gate (runs before auth routing so it also covers /api/auth/* logins).
  // Cron routes are server-to-server with no browser Origin and gate on
  // CRON_SECRET themselves, so they skip this.
  if (!pathname.startsWith("/api/cron/") && isDisallowedCrossOriginWrite(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 })
  }

  // Routes that must work without a session.
  if (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/cron/") // each cron route enforces CRON_SECRET itself
  ) {
    return NextResponse.next()
  }

  const authed = await hasValidSession(request)

  if (pathname === "/login") {
    return authed ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next()
  }

  // Password reset must work signed out; a signed-in visitor has no use for it.
  if (pathname === "/reset") {
    return authed ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next()
  }

  // The door has one public URL: "/". A direct hit on /door goes there too.
  if (pathname === "/door") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (authed) {
    return NextResponse.next()
  }

  // --- Signed out from here down ---

  if (pathname === "/") {
    return NextResponse.rewrite(new URL("/door", request.url))
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }

  return NextResponse.redirect(new URL("/", request.url))
}

export const config = {
  // Everything except Next's static assets and the classic file requests.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt)$).*)"],
}
