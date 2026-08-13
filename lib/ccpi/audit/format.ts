/**
 * The CCPI audit panel's shared vocabulary: null-safe formatters, the
 * provenance reader, and the two shapes every pillar builder returns.
 *
 * Split out of `components/ccpi-audit-admin.tsx` (P6-13), which was 1,636 lines
 * with roughly 900 of them pure data-shaping trapped inside a `"use client"`
 * component. Nothing here changed in the move.
 *
 * WHY THIS FILE HAS NO IMPORTS. Same reason as `lib/ccpi/scoring.ts`: arithmetic
 * reachable only through a React render and a fetch is arithmetic no check
 * script can load, and a script that imports through `@/` cannot run under
 * plain node either. Everything here is pure and import-free, so it is loadable
 * directly — which `./structure.ts` and `./pillars/*` are not, and say so.
 *
 * AUDIT A-8, which is why the formatters exist at all. This panel used to make
 * 26 unguarded `.toFixed()` calls on indicators the CCPI route may legitimately
 * emit as null. The first null threw a TypeError inside `buildAuditStructure`,
 * the catch swallowed it, `auditData` stayed null, and the tab showed
 * "Loading CCPI Audit…" forever with no error. Every value goes through these
 * and renders "—" when the datum does not exist.
 */

/** Provenance tier vocabulary emitted by lib/ccpi/scoring.ts. */
export type Tier = "live" | "ai-estimate" | "baseline" | "unknown"

export const EM_DASH = "—"

/** Null-safe fixed-decimal formatter. Returns "—" for anything non-finite. */
export function fx(v: unknown, digits: number, opts: { prefix?: string; suffix?: string; signed?: boolean } = {}): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return EM_DASH
  const sign = opts.signed && v > 0 ? "+" : ""
  return `${opts.prefix ?? ""}${sign}${v.toFixed(digits)}${opts.suffix ?? ""}`
}

/** Null-safe passthrough for values rendered verbatim. */
export function raw(v: unknown, suffix = ""): string {
  if (v === null || v === undefined || v === "") return EM_DASH
  if (typeof v === "number" && !Number.isFinite(v)) return EM_DASH
  return `${v}${suffix}`
}

/** Boolean-with-proximity rendering: "YES (n% proximity)" / "NO" / "—". */
export function breach(below: unknown, proximity: unknown, yesLabel = "YES"): string {
  if (typeof below !== "boolean") return EM_DASH
  if (!below) return "NO"
  const p = fx(proximity, 0, { suffix: "% proximity" })
  return p === EM_DASH ? `${yesLabel} (proximity ${EM_DASH})` : `${yesLabel} (${p})`
}

/** Pillar score band label; null-aware so a missing pillar never reads "🟢 NORMAL". */
export function band(score: unknown, high: string, mid: string, low: string): string {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return `Pillar score ${EM_DASH}. ⚪ INSUFFICIENT DATA — under 40 of this pillar's 100 weight was backed by live or AI data, so it reports no score and is dropped from the composite.`
  }
  return `Pillar score ${score}/100. ${score > 70 ? high : score > 50 ? mid : low}`
}

export interface IndicatorDetail {
  name: string
  formula: string
  executiveSummary: string
  currentValue: string
  ranges: {
    safe: string
    warning: string
    danger: string
  }
  dataSources: {
    primary: string
    fallbackChain: string[]
    currentSource: string
    status: Tier
    updateFrequency?: string
    methodology?: string
  }
  canaryThresholds: {
    medium: string
    high: string
  }
}

export interface PillarAudit {
  name: string
  weight: number
  score: number | null
  scoredMax: number | null
  liveMax: number | null
  aiMax: number | null
  excluded: string[]
  formula: string
  calculation: string
  executiveSummary: string
  validation: string
  indicators: IndicatorDetail[]
}

/** Read an indicator's real provenance tier out of `ccpi.provenance`. */
const tierOf = (prov: any, pillarKey: string, indicatorKey: string): Tier => {
  const t = prov?.[pillarKey]?.tiers?.[indicatorKey]
  return t === "live" || t === "ai-estimate" || t === "baseline" ? t : "unknown"
}

/**
 * Provenance for one indicator, read from `ccpi.provenance` at source.
 * The old version merged this in from /api/data-source-status, a route that
 * was a hardcoded object literal (A-5) — so the tab that was otherwise correct
 * was being fed invented "live" statuses.
 */
export const src = (
  prov: any,
  pillarKey: string,
  indicatorKey: string,
  primary: string,
  fallbackChain: string[],
): IndicatorDetail["dataSources"] => {
  const status = tierOf(prov, pillarKey, indicatorKey)
  return {
    primary,
    fallbackChain,
    // Never invent a provider name. Only a "live" tier means the primary
    // actually served it; anything else renders the tier's own label and "—".
    currentSource: status === "live" ? primary : EM_DASH,
    status,
  }
}
