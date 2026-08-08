import { NextResponse } from "next/server"
import { isAuthenticated } from "@/lib/auth"
import { getProviderChain } from "@/lib/ai-providers"
import { hasRawKey, isServiceDisabled } from "@/lib/api-keys"

/**
 * The live AI fallback chain (AUDIT_BACKLOG A-7, A-9).
 *
 * Generated entirely from `providerConfigs` in lib/ai-providers.ts via
 * `getProviderChain()` — the same array the generate/stream loops iterate — so
 * order, display name and model id cannot drift from the code. The old handwritten
 * list had the order backwards (it claimed OpenAI #1; OpenAI is #4, behind three
 * free-tier providers) and shipped hardcoded "average latency" strings rendered
 * as if measured.
 *
 * There is no latency field here on purpose: this route makes ZERO upstream
 * calls (a probe would spend tokens). Real per-call latency belongs to the
 * metering ledger (lib/metered-fetch.ts → Costs tab), not to a constant.
 *
 * Admin-gated (A-9): the payload discloses which AI keys are configured.
 */

export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const chain = getProviderChain().map((p) => {
    const disabled = isServiceDisabled(p.keyName)
    return {
      ...p,
      /** Raw env var present, ignoring the kill switch. */
      rawPresent: hasRawKey(p.keyName),
      /** Kill-switched via DISABLED_APIS — the chain skips it even with a key set. */
      disabled,
      /** The loop `continue`s past any provider whose key does not resolve. */
      willBeTried: p.hasKey,
      /** No measurement is taken here; see lib/metered-fetch.ts for real latency. */
      latencyMs: null as number | null,
    }
  })

  const tried = chain.filter((p) => p.willBeTried)

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    source: "lib/ai-providers.ts → providerConfigs (generated; the panel cannot drift from the chain)",
    summary: {
      total: chain.length,
      configured: tried.length,
      unconfigured: chain.filter((p) => !p.hasKey && !p.disabled).length,
      disabled: chain.filter((p) => p.disabled).length,
      free: chain.filter((p) => p.tier === "free").length,
      paid: chain.filter((p) => p.tier === "paid").length,
      /** The provider that will actually serve the next request, or null. */
      firstAttempted: tried[0]?.displayName ?? null,
      /** True when the next request lands on a pay-per-use provider. */
      firstAttemptedIsPaid: tried[0] ? tried[0].tier === "paid" : false,
    },
    /** Stated, not inferred: no upstream call was made to produce this. */
    measurement: "key presence only — no AI provider was called, so no latency or liveness was measured",
    providers: chain,
  })
}
