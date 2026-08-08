import { NextResponse } from "next/server"
import { Resend } from "resend"
import { getApiKey } from "@/lib/api-keys"
import {
  getSpendReport,
  readBudgetState,
  tripBudgetGuard,
  resetBudgetGuardCache,
  getGuardedKeys,
} from "@/lib/budget-guard"

/**
 * Budget guard cron — AUDIT_BACKLOG E-5.
 *
 * Runs on the schedule in vercel.json. Computes metered spend from the Supabase
 * ledger, and if a hard stop is breached, flips the durable kill flag that
 * `resolveApiKey` honors and emails Joel.
 *
 * This is LAYER 2. Layer 1 is the provider-side hard cap set in each vendor
 * console (OpenAI, Anthropic, OpenRouter prepaid credits, Vercel spend
 * management) — the only control that still works if this app is broken,
 * mis-deployed, or the ledger is down. Nothing here replaces those.
 *
 * SAFE TO RE-RUN. Tripping is idempotent: an already-tripped guard keeps its
 * original timestamp and does not re-send the email.
 */

// Spend must be read live, never from a build-time or route cache.
export const dynamic = "force-dynamic"

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without a configured
 * secret the route refuses to run rather than defaulting to open: an unauthed
 * endpoint that can cut off every paid API is a denial-of-service handle.
 */
function isAuthorizedCron(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return { ok: false, status: 503, error: "CRON_SECRET is not configured; refusing to run unauthenticated." }
  }
  const header = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  if (header.length !== expected.length) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }
  // Constant-time compare — same posture as lib/auth.ts session verification.
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i)
  if (diff !== 0) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }
  return { ok: true }
}

function money(usd: number | null): string {
  return usd === null ? "unknown" : `$${usd.toFixed(2)}`
}

async function notify(subject: string, lines: string[]): Promise<{ sent: boolean; reason: string | null }> {
  const key = getApiKey("RESEND_API_KEY")
  const to = process.env.ADMIN_EMAIL
  if (!key) return { sent: false, reason: "RESEND_API_KEY is not configured." }
  if (!to) return { sent: false, reason: "ADMIN_EMAIL is not configured." }
  try {
    await new Resend(key).emails.send({
      from: "Options Calculator <noreply@options-calculators.com>",
      to,
      subject,
      text: lines.join("\n"),
    })
    return { sent: true, reason: null }
  } catch (err) {
    // A failed email must not stop the shutoff — the cutoff is the control,
    // the email is the notification. Report it instead of throwing.
    return { sent: false, reason: err instanceof Error ? err.message : String(err) }
  }
}

export async function GET(request: Request) {
  const auth = isAuthorizedCron(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // The cron is the one caller that must never read a stale snapshot.
  resetBudgetGuardCache()

  const spend = await getSpendReport()
  const state = await readBudgetState()

  // Unknown spend is not a breach. Report it loudly and change nothing —
  // cutting the app off because metering is down would be the worse failure.
  if (spend.unavailableReason !== null) {
    return NextResponse.json(
      {
        ok: false,
        action: "none",
        reason: "spend-unknown",
        detail: spend.unavailableReason,
        spend,
        state,
      },
      { status: 200 },
    )
  }

  if (state?.tripped) {
    return NextResponse.json({
      ok: true,
      action: "none",
      reason: "already-tripped",
      trippedAt: state.trippedAt,
      trippedReason: state.reason,
      spend,
    })
  }

  if (!spend.breached || spend.breachReason === null) {
    return NextResponse.json({
      ok: true,
      action: "none",
      reason: "under-budget",
      dailyUsd: spend.daily.usd,
      monthlyUsd: spend.monthly.usd,
      spend,
    })
  }

  const window = spend.breachReason === "daily" ? spend.daily : spend.monthly
  const threshold = spend.breachReason === "daily" ? spend.dailyHardStop : spend.monthlyHardStop
  const tripped = await tripBudgetGuard({
    reason: spend.breachReason,
    spendUsd: window.usd,
    thresholdUsd: threshold,
  })

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.options-calculators.com"
  const mail = await notify(`[Options Calculators] Budget guard tripped — ${spend.breachReason} cap reached`, [
    `The ${spend.breachReason} spend cap has been reached, and pay-per-use API keys have been cut off.`,
    ``,
    `${spend.breachReason === "daily" ? `Today (UTC ${spend.day})` : `Month to date (UTC ${spend.month})`}: ${money(window.usd)}`,
    `Hard stop: ${money(threshold)}`,
    ``,
    `Today: ${money(spend.daily.usd)} of ${money(spend.dailyHardStop)}`,
    `Month to date: ${money(spend.monthly.usd)} of ${money(spend.monthlyHardStop)}`,
    window.unpricedCalls > 0
      ? `NOTE: ${window.unpricedCalls} call(s) used a model with no price on file and are NOT included above — real spend is higher.`
      : ``,
    ``,
    `Cut off: ${getGuardedKeys().join(", ")}`,
    `Still running: free-tier and flat-rate providers, so the site keeps working on its free AI path.`,
    ``,
    tripped
      ? `Re-enable from the admin Health tab: ${base}/admin`
      : `WARNING: writing the kill flag to Supabase FAILED. Spend is NOT cut off. Disable the keys manually.`,
    ``,
    `Spend is an estimate from vendor list prices (lib/api-costs.ts), not a bill.`,
  ])

  return NextResponse.json({
    ok: tripped,
    action: tripped ? "tripped" : "trip-failed",
    reason: spend.breachReason,
    spendUsd: window.usd,
    thresholdUsd: threshold,
    guardedKeys: getGuardedKeys(),
    emailSent: mail.sent,
    emailError: mail.reason,
    spend,
  })
}
