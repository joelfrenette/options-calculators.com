// Technical gate evaluation shared by the scan flow and the results tables.
// Extracted from components/wheel-scanner.tsx (Phase 4) — logic verbatim; the
// component's slider/toggle state is passed in as a settings object.

import type { QualifyingStock } from "./types"
import { relaxedDownYearVerdict } from "@/lib/trend-filters"

export interface TechnicalFilterSettings {
  maxRSI: number
  maxStochastic: number
  minATR: number
  maxATR: number
  requireBollingerBands: boolean
  requireAbove200SMA: boolean
  requireAbove50SMA: boolean
  requireGoldenCross: boolean
  requireMACDBullish: boolean
  requireRedDay: boolean
  minYield: number
  minVolumeTechnicals: number
  // --- CSP entry filters. All four default ON (use-wheel-scanner.ts). ------
  /** Reject a stock whose measured session move is at or above `maxDayMove`. */
  excludeBigUpDay: boolean
  /** The percentage that counts as "just ripped". Owner's number: 10. */
  maxDayMove: number
  /** Reject a stock whose trailing-year return is negative. */
  excludeDownYear: boolean
  /** Reject a stock that trailed the benchmark over the trailing year. */
  excludeBenchmarkLaggard: boolean
  /** Reject a stock below a FALLING 150-session average (Weinstein Stage 4). */
  excludeStage4: boolean
}

/**
 * The four CSP entry gates. Exported for the check script; the scan calls
 * `failedEntryExclusions` below, which is the form that names what failed.
 *
 * EVERY GATE FAILS SAFE ON NULL, matching the convention the rest of this file
 * established: a stock whose session move or trailing year cannot be measured
 * must not pass a filter that exists to measure it. A newly-listed ticker has
 * no year to look back on, and the honest reading of that is "cannot qualify",
 * not "qualifies".
 *
 * HOW THE TWO YEAR-LONG GATES RELATE, and this paragraph is the corrected
 * version — the first draft asserted the redundancy backwards and the check
 * script's subsumption assertion caught it before it shipped.
 *
 * When the benchmark's own year is POSITIVE, the laggard gate is strictly
 * STRONGER than the down-year gate, not weaker: `return < benchmark` rejects
 * everything `return < 0` rejects, plus every stock that rose by less than the
 * market. A stock up 7.5% against a benchmark up 8% passes "down on the year"
 * and fails "trailed SPY".
 *
 * When the benchmark's year is NEGATIVE they genuinely disagree, and that is
 * the case both exist for: a stock down 5% while the market fell 20% has
 * outperformed by 15 points, yet is still down on the year. Which of those two
 * readings should exclude it is the owner's call, so both gates are exposed and
 * both default on.
 *
 * `scripts/check-trend-filters.ts` asserts both halves with worked numbers, so
 * this paragraph cannot quietly become false the way its first draft was.
 */
export const cspEntryGates = (stock: QualifyingStock, f: TechnicalFilterSettings) => ({
  bigUpDayCheck: !f.excludeBigUpDay || (stock.dayMovePercent !== null && stock.dayMovePercent < f.maxDayMove),
  downYearCheck: !f.excludeDownYear || (stock.return12m !== null && stock.return12m >= 0),
  benchmarkCheck:
    !f.excludeBenchmarkLaggard || (stock.relativeReturn12m !== null && stock.relativeReturn12m >= 0),
  stage4Check: !f.excludeStage4 || stock.stage4Decline === false,
})

/**
 * EXCLUSIONS ARE NOT CRITERIA, and the difference decides where the row goes.
 *
 * The gates above are a hard filter: a stock that fails one is removed from the
 * scan entirely. They are deliberately NOT folded into the criteria objects
 * below, and that is the whole design, not tidiness:
 *
 *   - Step 4's relaxed table exists to show near misses — rows that pass SOME
 *     criteria. Fold an exclusion in and a stock that just gapped 12% still
 *     appears there, as a near miss, which is exactly the row the owner asked
 *     not to see. "Not shown" has to mean not shown in either table.
 *   - The relaxed table prints a passed/total count. Adding four pass/fail
 *     exclusions to that denominator would make "11 of 15" describe two
 *     different kinds of test as though they were one.
 *
 * @returns the names of the exclusions this stock failed — empty means keep.
 */
export const failedEntryExclusions = (stock: QualifyingStock, f: TechnicalFilterSettings): string[] =>
  Object.entries(cspEntryGates(stock, f))
    .filter(([, passed]) => !passed)
    .map(([name]) => name)

/** Human wording for each gate, used in the on-screen exclusion notice. */
export const ENTRY_EXCLUSION_LABELS: Record<string, string> = {
  bigUpDayCheck: "big up day",
  downYearCheck: "down on the year",
  benchmarkCheck: "trailed SPY",
  stage4Check: "Stage 4 decline",
}

export interface EntryExclusion {
  ticker: string
  reasons: string[]
}

/**
 * Split a candidate list into what survives the entry exclusions and what does
 * not, keeping the REASONS with each rejection.
 *
 * The reasons are the point. A scanner that silently returns fewer rows is
 * indistinguishable from one that found fewer candidates, and this project has
 * already paid for that confusion once (P6-24, where an empty form produced a
 * confident verdict). The caller shows the list, so "nothing qualified today"
 * arrives with its arithmetic attached.
 */
export const partitionByEntryExclusions = (
  stocks: QualifyingStock[],
  f: TechnicalFilterSettings,
): { kept: QualifyingStock[]; excluded: EntryExclusion[] } => {
  const kept: QualifyingStock[] = []
  const excluded: EntryExclusion[] = []
  for (const stock of stocks) {
    const reasons = failedEntryExclusions(stock, f)
    if (reasons.length === 0) kept.push(stock)
    else excluded.push({ ticker: stock.ticker, reasons: reasons.map((r) => ENTRY_EXCLUSION_LABELS[r] ?? r) })
  }
  return { kept, excluded }
}

/**
 * The RELAXED pass's hard gates — a GRADED, more permissive form of the strict
 * gates above (owner 2026-08-29). Returns the reasons this stock is kept out of
 * the relaxed pass; empty means it is priced and shown.
 *
 * The difference from the strict gate is the down-year clause, and only that:
 *
 *   - big up day  — still hard (a spike inflates the strike and the IV).
 *   - Stage 4     — still hard (below a FALLING 150-session average is the
 *                   structural downtrend, the real knife, at any magnitude).
 *   - down year   — GRADED, not binary. A DEEP decline (worse than
 *                   RELAXED_DEEP_DECLINE_PCT) stays out. A MILD decline
 *                   (between deep and flat) is admitted ONLY for a large,
 *                   reliable name (market cap ≥ RELAXED_MILD_DOWN_MIN_CAP) —
 *                   the pullback in a stock the owner would own at the strike.
 *   - trailed SPY — not a gate here at all; it is the soft Beat-SPY column.
 *
 * Unmeasurable trailing year still fails safe (excluded) — a name whose year
 * cannot be read cannot be judged mild.
 */
export const relaxedHardGateReasons = (stock: QualifyingStock, f: TechnicalFilterSettings): string[] => {
  const reasons: string[] = []

  if (f.excludeBigUpDay && !(stock.dayMovePercent !== null && stock.dayMovePercent < f.maxDayMove)) {
    reasons.push("big up day")
  }
  if (f.excludeStage4 && stock.stage4Decline !== false) {
    reasons.push("Stage 4 decline")
  }
  if (f.excludeDownYear) {
    const verdict = relaxedDownYearVerdict(stock.return12m, stock.marketCap)
    if (verdict === "unmeasurable") reasons.push("trend unavailable")
    else if (verdict === "deep") reasons.push(`deep decline (${stock.return12m!.toFixed(0)}%)`)
    else if (verdict === "mild-small") reasons.push("down year, under $20B")
    // "not-down" and "mild-large" are admitted — no reason added.
  }

  return reasons
}

/**
 * Split candidates for the RELAXED pass using the graded gates above. Mirrors
 * partitionByEntryExclusions but permits large, mildly-down names.
 */
export const partitionByRelaxedEntryExclusions = (
  stocks: QualifyingStock[],
  f: TechnicalFilterSettings,
): { kept: QualifyingStock[]; excluded: EntryExclusion[] } => {
  const kept: QualifyingStock[] = []
  const excluded: EntryExclusion[] = []
  for (const stock of stocks) {
    const reasons = relaxedHardGateReasons(stock, f)
    if (reasons.length === 0) kept.push(stock)
    else excluded.push({ ticker: stock.ticker, reasons })
  }
  return { kept, excluded }
}

export const checkTechnicalCriteria = (stock: QualifyingStock, f: TechnicalFilterSettings) => {
  // Null indicator = insufficient history = the gate FAILS-SAFE (a stock with
  // an unknown RSI/SMA cannot pass a filter that requires knowing it).
  const criteria = {
    rsiCheck: stock.rsi !== null && stock.rsi <= f.maxRSI,
    stochasticCheck: stock.stochastic !== null && stock.stochastic <= f.maxStochastic,
    sma200Check: !f.requireAbove200SMA || (stock.sma200 !== null && stock.currentPrice >= stock.sma200),
    sma50Check: !f.requireAbove50SMA || (stock.sma50 !== null && stock.currentPrice >= stock.sma50),
    goldenCrossCheck: !f.requireGoldenCross || stock.uptrend,
    macdCheck: !f.requireMACDBullish || stock.macdSignal === "Bullish",
    atrCheck: stock.atrPercent >= f.minATR && stock.atrPercent <= f.maxATR,
    bollingerCheck:
      !f.requireBollingerBands || stock.bollingerPosition === "Below" || stock.bollingerPosition === "Lower Half",
    redDayCheck: !f.requireRedDay || stock.redDay,
    // FIX: Add yield check to criteria
    yieldCheck: stock.yield >= f.minYield,
    // FIX: Add volume check to criteria
    volumeCheck: stock.avgVolume >= f.minVolumeTechnicals,
  }
  return criteria
}

// Helper function to evaluate all technical criteria for relaxed results table
export const evaluateCriteria = (stock: QualifyingStock, f: TechnicalFilterSettings) => {
  // Same fail-safe null handling as checkTechnicalCriteria above.
  return {
    rsiCheck: stock.rsi !== null && stock.rsi <= f.maxRSI,
    sma200Check: !f.requireAbove200SMA || (stock.sma200 !== null && stock.currentPrice >= stock.sma200),
    sma50Check: !f.requireAbove50SMA || (stock.sma50 !== null && stock.currentPrice >= stock.sma50),
    goldenCrossCheck: !f.requireGoldenCross || stock.uptrend,
    macdCheck: !f.requireMACDBullish || stock.macdSignal === "Bullish",
    stochasticCheck: stock.stochastic !== null && stock.stochastic <= f.maxStochastic,
    atrCheck: stock.atrPercent >= f.minATR && stock.atrPercent <= f.maxATR,
    bollingerCheck:
      !f.requireBollingerBands || stock.bollingerPosition === "Below" || stock.bollingerPosition === "Lower Half",
    redDayCheck: !f.requireRedDay || stock.redDay,
    yieldCheck: stock.yield >= f.minYield,
    volumeCheck: stock.avgVolume >= f.minVolumeTechnicals,
  }
}
