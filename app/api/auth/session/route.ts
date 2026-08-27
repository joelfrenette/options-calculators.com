import { NextResponse } from "next/server"
import { getSessionInfo } from "@/lib/auth"

/**
 * Who am I, for the UI: {role, email} of the current session. Exists so the
 * dashboard can show the Admin button to the owner alone and a Sign out
 * control to everyone — an httpOnly cookie is unreadable client-side, which
 * is correct and why this endpoint answers instead.
 *
 * Display data only: every admin page and /api/admin route stays gated
 * server-side (verifyAuth), so a spoofed answer here could mislabel a button
 * and nothing else. Lives under /api/auth/ (middleware-public) and therefore
 * checks the session itself: signed out → 401.
 */

export const dynamic = "force-dynamic"

export async function GET() {
  const info = await getSessionInfo()
  if (!info) {
    return NextResponse.json({ error: "No session" }, { status: 401 })
  }
  return NextResponse.json(info)
}
