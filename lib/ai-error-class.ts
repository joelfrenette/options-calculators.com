// Why an AI call failed — the column the ledger did not have.
//
// WHAT THIS EXISTS TO FIX. Until 2026-08-30 a failed LLM call recorded
// `ok: false` and nothing else: `recordAiCall` hardcoded `status: args.ok ? 200
// : 0`, so the real HTTP status from the SDK error was thrown away before it
// reached the row. The consequence was not theoretical. **xAI failed 401 times
// out of 401 between 2026-08-08 and 2026-08-30 — a 100% failure rate on the
// first provider of all six CCPI fallback chains, on the site's default landing
// page — and nothing in the ledger could say why.** The failures were durably
// recorded and completely unreadable, which is worse than not recording them:
// a row that says only "it failed" reads as noise, so nobody looks twice.
//
// It also caused a misdiagnosis. The gap was filed as "verify the xAI
// usage-shape fallback records tokens", because unpriced rows are what you see
// when you cannot see `ok`. There were no tokens to record: there had never
// been a successful call. Three weeks of a dead primary provider were
// investigated as a token-accounting question.
//
// WHAT A CLASS BUYS. The classes below are chosen to separate the causes that
// need DIFFERENT fixes, which is the only distinction worth storing:
//
//   model_not_found  the slug is retired or misspelled  → change the model id
//   auth             key rejected/expired/revoked       → rotate the key
//   rate_limit       quota or RPM exhausted             → back off or upgrade
//   bad_request      we sent something invalid          → fix the call
//   upstream         vendor 5xx                         → not ours; retry
//   timeout          we gave up waiting                 → raise budget or retry
//   transport        never got an HTTP response         → network/DNS/TLS
//   unknown          nothing above matched              → read `detail`
//
// `unknown` deliberately admits it has no rule rather than defaulting into a
// neighbouring class. A wrong class is worse than none: it sends the reader to
// rotate a key that was fine.
//
// This module is edge-runtime safe and imports nothing.

/** Cause classes. `unknown` means unclassified, never "fine". */
export type AiErrorClass =
  | "model_not_found"
  | "auth"
  | "rate_limit"
  | "bad_request"
  | "upstream"
  | "timeout"
  | "transport"
  | "unknown"

export interface ClassifiedAiError {
  /** Upstream HTTP status when the SDK surfaced one; null when it never got a response. */
  status: number | null
  errorClass: AiErrorClass
  /** Short human detail for the admin row. Truncated; never the full body. */
  detail: string
}

/** Keep rows small and avoid dragging a response body into the ledger. */
const DETAIL_MAX = 300

function truncate(s: string): string {
  const flat = s.replace(/\s+/g, " ").trim()
  return flat.length > DETAIL_MAX ? `${flat.slice(0, DETAIL_MAX - 1)}…` : flat
}

/**
 * Read a status off an unknown error without importing the SDK.
 *
 * The `ai` package's APICallError carries `statusCode`; other layers use
 * `status`. Duck-typing both keeps this module dependency-free and edge-safe,
 * and means a provider SDK swap does not silently stop classifying.
 */
function readStatus(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null
  const bag = err as Record<string, unknown>
  for (const key of ["statusCode", "status"]) {
    const v = bag[key]
    if (typeof v === "number" && Number.isFinite(v)) return v
  }
  // Nested one level: SDKs wrap the transport error as `cause`.
  const cause = bag.cause
  if (cause && cause !== err) return readStatus(cause)
  return null
}

function readMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  if (typeof err === "object" && err !== null) {
    const m = (err as Record<string, unknown>).message
    if (typeof m === "string") return m
  }
  return String(err)
}

/**
 * Classify a thrown AI-SDK error into a status + cause class + short detail.
 *
 * Status wins over message text when present: a vendor's prose changes between
 * releases, its status codes do not. Message matching is the fallback for the
 * cases that never produce a response at all (timeout, DNS, TLS).
 */
export function classifyAiError(err: unknown): ClassifiedAiError {
  const status = readStatus(err)
  const detail = truncate(readMessage(err))

  if (status !== null) {
    if (status === 404) return { status, errorClass: "model_not_found", detail }
    if (status === 401 || status === 403) return { status, errorClass: "auth", detail }
    if (status === 429) return { status, errorClass: "rate_limit", detail }
    // 400/422 are how several vendors report an unknown model slug, so the
    // message is consulted before settling on "we sent something invalid".
    if (status === 400 || status === 422) {
      return {
        status,
        errorClass: /\bmodel\b/i.test(detail) && /(not found|does not exist|unknown|invalid|decommission|retire)/i.test(detail)
          ? "model_not_found"
          : "bad_request",
        detail,
      }
    }
    if (status >= 500) return { status, errorClass: "upstream", detail }
    if (status >= 400) return { status, errorClass: "bad_request", detail }
  }

  // No status: the call never got an HTTP response back.
  if (/\b(timeout|timed out|aborted|AbortError)\b/i.test(detail)) {
    return { status, errorClass: "timeout", detail }
  }
  if (/\b(ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|fetch failed|network|socket|TLS|certificate)\b/i.test(detail)) {
    return { status, errorClass: "transport", detail }
  }
  return { status, errorClass: "unknown", detail }
}
