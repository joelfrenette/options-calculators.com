/**
 * Shared CRON_SECRET check.
 *
 * The same constant-time comparison was copy-pasted into every cron route.
 * One copy means one place to get the comparison right, and one place to
 * change when the secret rotates.
 */

export type CronAuth = { ok: true } | { ok: false; status: 401 | 503; error: string }

export function checkCronAuth(request: Request): CronAuth {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // 503, not 401: the route is not rejecting the caller, it is unconfigured.
    return { ok: false, status: 503, error: "CRON_SECRET not configured" }
  }
  const header = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  if (header.length !== expected.length) return { ok: false, status: 401, error: "Unauthorized" }
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0 ? { ok: true } : { ok: false, status: 401, error: "Unauthorized" }
}
