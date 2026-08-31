import { NextResponse } from "next/server"
import { verifyAuth, isAdmin } from "@/lib/auth"
import { API_KEY_ALIASES, getConfiguredKeys, getKeySource, hasRawKey, isServiceDisabled } from "@/lib/api-keys"
import {
  clearOverride,
  ensureKeyOverridesFresh,
  isKeyStoreAvailable,
  listOverrideMeta,
  setOverride,
} from "@/lib/key-store"

/**
 * Admin API keys — AUDIT_BACKLOG P4-4.
 *
 *   GET             per-key status: configured, source (admin/env/none), last-4,
 *                   when it was set. NEVER a key value.
 *   POST {set}      store or rotate an admin-managed key.
 *   POST {clear}    remove the override, falling back to the env var.
 *
 * NO READ PATH FOR VALUES, ANYWHERE. Not masked, not "reveal on click", not for
 * the owner. The panel exists to tell you WHICH key is set, not what it is —
 * last-4 is enough to confirm a rotation and useless to anyone who steals a
 * session. A key you can read back through the UI leaks the moment that session
 * does.
 *
 * The plaintext is never logged, never echoed, and never appears in a response
 * body on any path including errors.
 */

// Key state must always be read live, never from a route cache.
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authResult = await verifyAuth(request)
  if (!authResult.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Pick up anything set from another instance before reporting status.
    await ensureKeyOverridesFresh().catch(() => {})

    const availability = isKeyStoreAvailable()
    const meta = availability.ok ? await listOverrideMeta() : []
    const metaByName = new Map(meta.map((m) => [m.name, m]))

    const keys = Object.keys(API_KEY_ALIASES).map((name) => {
      const m = metaByName.get(name)
      return {
        name,
        aliases: API_KEY_ALIASES[name],
        source: getKeySource(name),
        present: hasRawKey(name),
        disabled: isServiceDisabled(name),
        last4: m?.last4 ?? null,
        updatedAt: m?.updatedAt ?? null,
        updatedBy: m?.updatedBy ?? null,
        // True when a stored row could not be decrypted — almost always means
        // ENCRYPTION_KEY changed since it was written. Surfaced rather than
        // silently treated as "no key set".
        unreadable: m ? !m.readable : false,
      }
    })

    return NextResponse.json({
      // Preserved for existing consumers of this endpoint.
      keys: getConfiguredKeys(),
      detail: keys,
      store: {
        available: availability.ok,
        reason: availability.reason,
        note: "Admin-set keys override the matching Vercel environment variable and take effect within about 60 seconds. Values are encrypted at rest and are never returned by this API.",
      },
    })
  } catch (error) {
    console.error("Error checking API keys:", error)
    return NextResponse.json({ error: "Failed to check API keys" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { action?: string; name?: string; value?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim().toUpperCase() : ""
  if (!name || !(name in API_KEY_ALIASES)) {
    return NextResponse.json(
      { error: `Unknown key name. Expected one of the canonical names in lib/api-keys.ts.` },
      { status: 400 },
    )
  }

  if (body.action === "clear") {
    const result = await clearOverride(name)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, name, action: "cleared", source: getKeySource(name) })
  }

  if (body.action === "set") {
    if (typeof body.value !== "string" || !body.value.trim()) {
      return NextResponse.json({ error: "Key value is required." }, { status: 400 })
    }
    const result = await setOverride(name, body.value, "admin")
    if (!result.ok) {
      // Real status codes, and the error text never contains the value.
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({
      ok: true,
      name,
      action: "set",
      source: getKeySource(name),
      last4: body.value.trim().slice(-4),
    })
  }

  return NextResponse.json({ error: 'Unknown action. Expected "set" or "clear".' }, { status: 400 })
}
