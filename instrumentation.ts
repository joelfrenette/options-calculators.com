/**
 * Server-instance startup hook — AUDIT_BACKLOG P4-4.
 *
 * WHY THIS FILE EXISTS. `resolveApiKey` is synchronous, so admin-managed keys
 * are read from a cached snapshot. That snapshot is empty on a cold serverless
 * instance, and Vercel cold-starts constantly — without a warm-up, a key pasted
 * in the admin would resolve correctly on a warm lambda and read as
 * "not configured" on a fresh one. Intermittent, environment-dependent, and
 * exactly the kind of bug that costs a day to track down.
 *
 * `register()` runs once per server instance before it serves traffic, which
 * makes it the right place to load the overrides.
 *
 * Failure here is non-fatal on purpose: a Supabase blip at boot must not stop
 * the instance from starting. Resolution simply falls back to environment
 * variables until the next refresh, which is the behaviour the app had before
 * this feature existed.
 */

export async function register() {
  // Edge and browser bundles get their own runtime value; node:crypto and the
  // key store are Node-only, so this must not run there.
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  try {
    const { ensureKeyOverridesFresh, isKeyStoreAvailable } = await import("@/lib/key-store")
    if (!isKeyStoreAvailable().ok) return
    await ensureKeyOverridesFresh()
  } catch (err) {
    console.warn(
      "[instrumentation] Could not preload admin key overrides; falling back to environment variables:",
      err instanceof Error ? err.message : String(err),
    )
  }
}
