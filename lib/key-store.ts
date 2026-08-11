/**
 * Admin-managed API keys — AUDIT_BACKLOG P4-4.
 *
 * Lets the owner paste or rotate a provider key from the admin instead of
 * editing a Vercel environment variable and redeploying. Keys are stored as
 * AES-256-GCM ciphertext in the Supabase `api_key_overrides` table and
 * decrypted here, then pushed into the synchronous snapshot that
 * `resolveApiKey` reads.
 *
 * NODE RUNTIME ONLY. node:crypto is not available on the edge, which is exactly
 * why all crypto lives here and not in lib/api-keys.ts — that file has to stay
 * import-free and edge-safe (scripts/check-remediation.ts loads it under bare
 * node with no alias resolution).
 *
 * WRITE-ONLY BY DESIGN. There is no exported function that returns a stored key
 * to a caller outside `resolveApiKey`, and the admin API returns presence,
 * last-4, source and timestamp — never a value. A key that can be read back
 * through the UI leaks the moment an admin session does.
 *
 * EVENTUAL CONSISTENCY, STATED PLAINLY. `resolveApiKey` is synchronous, so it
 * reads a cached snapshot. `instrumentation.ts` warms that cache when a server
 * instance boots, and a stale read kicks off a background refresh. A key pasted
 * in the admin is therefore live everywhere within roughly the cache TTL rather
 * than instantly. That is still far better than the alternative it replaces,
 * which was "redeploy the whole app", but the admin UI says so rather than
 * implying the change is immediate.
 */

import { API_KEY_ALIASES, setKeyOverrideSnapshot, getKeyOverrideSnapshot } from "@/lib/api-keys"
import { getMeteringSupabaseConfig } from "@/lib/metered-fetch"

const CACHE_TTL_MS = 60_000
const VERSION = "v1"
/** AES-GCM authentication tag length, bytes. */
const TAG_BYTES = 16

// Web Crypto (crypto.subtle), NOT node:crypto — deliberately. instrumentation.ts
// imports this module, and Next compiles instrumentation for the EDGE runtime as
// well as Node. A node:crypto import there fails the build outright
// ("UnhandledSchemeError: Reading from node:crypto is not handled"), and a
// runtime guard does not help because webpack resolves the import at build time.
// crypto.subtle implements AES-256-GCM identically in both runtimes.

function toHex(bytes: Uint8Array): string {
  let out = ""
  for (const b of bytes) out += b.toString(16).padStart(2, "0")
  return out
}

/** Returns null on any non-hex input, so a corrupt row degrades instead of throwing. */
function fromHex(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.substr(i * 2, 2), 16)
  return out
}

/** The configured secret, or null when this deployment cannot store keys. */
function secretValue(): string | null {
  const secret = process.env.ENCRYPTION_KEY
  // Read from the environment and nowhere else. Encrypting real credentials
  // with any value committed to the repo would be worse than not offering the
  // feature at all.
  //
  // This used to read "No fallback to the hardcoded default in
  // lib/api-keys.ts" — that default has since been deleted (P6-88), because
  // routing around a hazard leaves it in place for the next reader.
  if (!secret || secret.length < 16) return null
  return secret
}

/**
 * 32-byte AES-256 key derived from ENCRYPTION_KEY by SHA-256.
 *
 * Hashing rather than using the env value directly means any length of
 * ENCRYPTION_KEY works — AES-256 needs exactly 32 bytes, and a shorter or
 * longer env var would otherwise throw at encrypt time.
 */
async function derivedKey(): Promise<CryptoKey | null> {
  const secret = secretValue()
  if (!secret) return null
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret))
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
}

/** True when this deployment is able to store admin-managed keys at all. */
export function isKeyStoreAvailable(): { ok: boolean; reason: string | null } {
  if (!secretValue()) {
    return { ok: false, reason: "ENCRYPTION_KEY is not set (or is shorter than 16 characters)." }
  }
  if (!getMeteringSupabaseConfig()) {
    return { ok: false, reason: "Supabase is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)." }
  }
  return { ok: true, reason: null }
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await derivedKey()
  if (!key) throw new Error("ENCRYPTION_KEY is not configured")
  const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit nonce, the GCM standard
  const combined = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)),
  )
  // Web Crypto appends the auth tag to the ciphertext; node:crypto exposes it
  // separately. Split it back out so the stored format stays the documented
  // v1:<iv>:<tag>:<cipher> rather than silently changing shape.
  const tag = combined.slice(combined.length - TAG_BYTES)
  const body = combined.slice(0, combined.length - TAG_BYTES)
  return `${VERSION}:${toHex(iv)}:${toHex(tag)}:${toHex(body)}`
}

/**
 * Returns null rather than throwing on anything malformed. A corrupt or
 * unreadable row must degrade to "this key is unavailable", never take down
 * every other key's resolution with it.
 */
async function decrypt(stored: string): Promise<string | null> {
  const key = await derivedKey()
  if (!key) return null
  const parts = stored.split(":")
  if (parts.length !== 4 || parts[0] !== VERSION) return null
  const iv = fromHex(parts[1])
  const tag = fromHex(parts[2])
  const body = fromHex(parts[3])
  if (!iv || !tag || !body) return null
  try {
    // Reassemble the ciphertext||tag layout Web Crypto expects.
    const combined = new Uint8Array(body.length + tag.length)
    combined.set(body, 0)
    combined.set(tag, body.length)
    // GCM authenticates: a wrong ENCRYPTION_KEY or a tampered row throws here
    // rather than returning garbage.
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined)
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

// ------------------------------------------------------------------- read

interface OverrideRow {
  name: string
  value_encrypted: string
  last4: string | null
  updated_at: string
  updated_by: string | null
}

export interface OverrideMeta {
  name: string
  last4: string | null
  updatedAt: string
  updatedBy: string | null
  /** False when the row exists but could not be decrypted with this key. */
  readable: boolean
}

async function fetchOverrideRows(): Promise<OverrideRow[] | null> {
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return null
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/api_key_overrides?select=name,value_encrypted,last4,updated_at,updated_by`,
      {
        headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      },
    )
    if (!res.ok) return null
    const rows = await res.json()
    return Array.isArray(rows) ? (rows as OverrideRow[]) : null
  } catch {
    return null
  }
}

let inFlight: Promise<void> | null = null

async function refresh(): Promise<void> {
  const rows = await fetchOverrideRows()
  // A failed read leaves the previous snapshot in place. Dropping it would make
  // every admin-set key vanish during a brief Supabase blip.
  if (rows === null) return

  const values: Record<string, string> = {}
  for (const row of rows) {
    const plaintext = await decrypt(row.value_encrypted)
    if (plaintext) values[row.name.toUpperCase()] = plaintext
  }
  setKeyOverrideSnapshot({ values, fetchedAt: Date.now() })
}

/** Refresh the override snapshot if missing or stale. Concurrent callers share one request. */
export async function ensureKeyOverridesFresh(): Promise<void> {
  const snap = getKeyOverrideSnapshot()
  const fresh = snap !== null && Date.now() - snap.fetchedAt < CACHE_TTL_MS
  if (fresh) return
  inFlight ??= refresh().finally(() => {
    inFlight = null
  })
  await inFlight
}

/** Force the next read to hit Supabase. Called after any write. */
async function reloadKeyOverrides(): Promise<void> {
  inFlight = null
  await refresh()
}

/**
 * Metadata for the admin panel. Deliberately returns no key values — only
 * enough to identify what is set and when.
 */
export async function listOverrideMeta(): Promise<OverrideMeta[]> {
  const rows = await fetchOverrideRows()
  if (rows === null) return []
  return Promise.all(
    rows.map(async (row) => ({
      name: row.name.toUpperCase(),
      last4: row.last4,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      readable: (await decrypt(row.value_encrypted)) !== null,
    })),
  )
}

// ------------------------------------------------------------------ write

export type KeyWriteResult = { ok: true } | { ok: false; status: number; error: string }

/** Store (or replace) an admin-managed key. The plaintext is never logged. */
export async function setOverride(name: string, plaintext: string, actor: string): Promise<KeyWriteResult> {
  const canonical = name.toUpperCase()
  if (!(canonical in API_KEY_ALIASES)) {
    return { ok: false, status: 400, error: `Unknown key name: ${canonical}` }
  }
  const value = plaintext.trim()
  if (!value) {
    return { ok: false, status: 400, error: "Key value is empty." }
  }

  const availability = isKeyStoreAvailable()
  if (!availability.ok) {
    return { ok: false, status: 503, error: availability.reason as string }
  }
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return { ok: false, status: 503, error: "Supabase is not configured." }

  let value_encrypted: string
  try {
    value_encrypted = await encrypt(value)
  } catch (err) {
    return { ok: false, status: 500, error: `Could not encrypt the key: ${err instanceof Error ? err.message : "unknown error"}` }
  }

  try {
    const res = await fetch(`${cfg.url}/rest/v1/api_key_overrides?on_conflict=name`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        // Upsert: setting a key that already exists replaces it (a rotation).
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        name: canonical,
        value_encrypted,
        last4: value.slice(-4),
        updated_at: new Date().toISOString(),
        updated_by: actor,
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      return { ok: false, status: 502, error: `Supabase write failed: HTTP ${res.status}` }
    }
  } catch (err) {
    return { ok: false, status: 502, error: `Supabase write failed: ${err instanceof Error ? err.message : String(err)}` }
  }

  await reloadKeyOverrides()
  return { ok: true }
}

/** Remove an admin-managed key, falling resolution back to the env var. */
export async function clearOverride(name: string): Promise<KeyWriteResult> {
  const canonical = name.toUpperCase()
  const cfg = getMeteringSupabaseConfig()
  if (!cfg) return { ok: false, status: 503, error: "Supabase is not configured." }
  try {
    const res = await fetch(`${cfg.url}/rest/v1/api_key_overrides?name=eq.${encodeURIComponent(canonical)}`, {
      method: "DELETE",
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, Prefer: "return=minimal" },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      return { ok: false, status: 502, error: `Supabase delete failed: HTTP ${res.status}` }
    }
  } catch (err) {
    return { ok: false, status: 502, error: `Supabase delete failed: ${err instanceof Error ? err.message : String(err)}` }
  }
  await reloadKeyOverrides()
  return { ok: true }
}
