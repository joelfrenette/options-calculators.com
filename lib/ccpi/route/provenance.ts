/**
 * Provenance for /api/ccpi: which tier backed each indicator, and the guard that
 * turns anything below "live or AI" into a null.
 *
 * Split out of `app/api/ccpi/route.ts` (P6-13), which was 990 lines. Nothing
 * changed in the move.
 *
 * `measured` is the load-bearing one. P6-34 removed ai-estimate from pillar
 * SCORING, and this is where that decision is enforced rather than described:
 * a value whose tier is not good enough comes back null and the pillar
 * renormalises without it, instead of being quietly counted.
 */
import type {
  MacroTiers,
  MomentumTiers,
  PillarResult,
  RiskAppetiteTiers,
  Tier,
  ValuationTiers,
} from "@/lib/ccpi/scoring"

export interface TierMaps {
  momentum: MomentumTiers
  riskAppetite: RiskAppetiteTiers
  valuation: ValuationTiers
  macro: MacroTiers
}

export function buildProvenance(
  results: { momentum: PillarResult; riskAppetite: PillarResult; valuation: PillarResult; macro: PillarResult },
  tiers: TierMaps,
) {
  const pack = (r: PillarResult, t: Record<string, Tier>) => ({
    scoredMax: r.scoredMax,
    liveMax: r.liveMax,
    aiMax: r.aiMax,
    excluded: r.excluded,
    tiers: t,
  })
  return {
    momentum: pack(results.momentum, tiers.momentum),
    riskAppetite: pack(results.riskAppetite, tiers.riskAppetite),
    valuation: pack(results.valuation, tiers.valuation),
    macro: pack(results.macro, tiers.macro),
  }
}

/**
 * Passes a value through only when it was MEASURED.
 *
 * A baseline-tier value is the assembly layer's own fallback constant, and
 * since P6-34 an ai-estimate is an LLM's guess at a published figure — neither
 * is a market observation. Reading either as fact is the P6-20 defect, so both
 * come back null and the caller has to decide what to do about missing data.
 *
 * Originally this dropped `baseline` only. That left an inconsistency the
 * moment P6-34 landed: the pillars stopped scoring AI estimates while the crash
 * amplifiers and the headline canaries went on evaluating them, so a warning
 * could still fire off a number the index itself refused to count. Found while
 * fixing P6-33, one file over.
 */
export function measured<T>(value: T, tier: Tier): T | null {
  return tier === "baseline" || tier === "ai-estimate" ? null : value
}

/**
 * AI-fallback source string → provenance tier.
 *
 * "unavailable" replaced "baseline" when fetchWithAIFallback stopped inventing
 * a constant (P6-34); both tier as `baseline`, which is excluded from scoring
 * and suppressed from the canaries. The difference is that "unavailable" now
 * carries a null value, so there is nothing left to accidentally read.
 */
export function aiTier(source: "grok" | "groq" | "anthropic" | "openai" | "unavailable"): Tier {
  return source === "unavailable" ? "baseline" : "ai-estimate"
}

/** The weaker of two tiers, for derived indicators (live > ai-estimate > baseline). */
export function weakerTier(a: Tier, b: Tier): Tier {
  const rank: Record<Tier, number> = { baseline: 0, "ai-estimate": 1, live: 2 }
  return rank[a] <= rank[b] ? a : b
}

export interface DataSourceStatus {
  live: boolean
  source: string
  lastUpdated: string
}

/**
 * Per-request record of which upstream answered and which did not.
 *
 * Moved here from the route with the fetchers that populate it (P6-13): the
 * tracker and the provenance tiers are the same claim at two levels of detail.
 */
export interface APIStatusTracker {
  technical: DataSourceStatus
  vixTerm: DataSourceStatus
  fred: DataSourceStatus
  alphaVantage: DataSourceStatus
  apify: DataSourceStatus
  fearGreed: DataSourceStatus
  buffett: DataSourceStatus
  putCall: DataSourceStatus
  aaii: DataSourceStatus
  shortInterest: DataSourceStatus
}
