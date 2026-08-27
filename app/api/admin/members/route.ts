import { NextResponse } from "next/server"
import { verifyAuth } from "@/lib/auth"
import { addMember, listMembers, removeMember, setMemberActive } from "@/lib/members"

/**
 * Invited-members administration (owner decision 2026-08-14: the site is a
 * private club — the owner plus a few friends, each a row in the Supabase
 * `members` table).
 *
 * Admin-only in the STRICT sense: lib/auth.ts's verifyAuth answers true only
 * for an admin session, so a signed-in member cannot list, add or remove
 * members. Password hashes never leave the server; the temp password is
 * hashed here (same scrypt format as ADMIN_PASSWORD_HASH) and discarded.
 */

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await verifyAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  const members = await listMembers()
  if (members === null) {
    return NextResponse.json({ error: "Member storage unreachable" }, { status: 503 })
  }
  return NextResponse.json({ members })
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown }
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 })
  }
  const result = await addMember(email, password)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request) {
  const auth = await verifyAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }
  const { id, active } = (body ?? {}) as { id?: unknown; active?: unknown }
  if (typeof id !== "number" || typeof active !== "boolean") {
    return NextResponse.json({ error: "id (number) and active (boolean) are required" }, { status: 400 })
  }
  const ok = await setMemberActive(id, active)
  if (!ok) {
    return NextResponse.json({ error: "Member storage unreachable" }, { status: 503 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const auth = await verifyAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 })
  }
  const { id } = (body ?? {}) as { id?: unknown }
  if (typeof id !== "number") {
    return NextResponse.json({ error: "id (number) is required" }, { status: 400 })
  }
  const ok = await removeMember(id)
  if (!ok) {
    return NextResponse.json({ error: "Member storage unreachable" }, { status: 503 })
  }
  return NextResponse.json({ ok: true })
}
