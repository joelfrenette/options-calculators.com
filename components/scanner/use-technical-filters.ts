"use client"

// Step 4's filter state, extracted from components/scanner/use-wheel-scanner.ts
// (P6-13 module-size work — zero behavior change). Every slider, toggle and
// entry exclusion the Step 4 card binds to lives here, together with the
// settings object the shared gate functions read. The hook that owns the scan
// pipeline composes this one; nothing here fetches, caches or scans.
//
// The comments moved verbatim with the state they annotate. Several of them
// record decisions that are not recoverable from the code — why a gate defaults
// ON while the toggles above it default OFF, and which two thresholds have no UI
// control at all — and a module-size split is exactly the moment those get lost.

import { useState } from "react"
import {
  checkTechnicalCriteria as checkCriteriaWithSettings,
  type TechnicalFilterSettings,
} from "./technical-criteria"
import type { QualifyingStock } from "./types"
import {
  MAX_DAY_MOVE,
  RELAXED_DEEP_DECLINE,
  RELAXED_MILD_DOWN_CAP_TIERS,
  RELAXED_MILD_DOWN_CAP_DEFAULT_INDEX,
} from "@/lib/trend-filters"

export function useTechnicalFilters() {
  // Step 3: Technical Analysis Filters
  const [maxRSI, setMaxRSI] = useState([65]) // Default Max RSI 65 (owner 2026-08-29, was 60) — admits slightly-stronger names without chasing overbought (>70)
  const [maxStochastic, setMaxStochastic] = useState([70]) // Default Max Stochastic 70 — uptrending stocks sit high on the stochastic most of the time
  const [minATR, setMinATR] = useState([2]) // Default Min ATR 2% - min volatility
  const [maxATR, setMaxATR] = useState([15]) // Default Max ATR 15% - max volatility

  // Bollinger default OFF: "price at/below the 20-day mean" directly contradicts the
  // above-50-SMA uptrend gate for most volatile names — together they left strict
  // Step 4 empty. Re-enable for precise pullback-entry timing.
  const [requireBollingerBands, setRequireBollingerBands] = useState(false) // Bollinger Bands Setup
  // FIX: Renamed state variables from require200SMA to requireAbove200SMA and require50SMA to requireAbove50SMA
  const [requireAbove200SMA, setRequireAbove200SMA] = useState(true) // Above 200-day SMA — KEPT ON: the long-term-uptrend guardrail
  // Above-50-SMA + Golden-Cross default OFF (owner 2026-08-29, both were ON).
  // They are the pullback contradiction: the richest-premium, lowest-risk CSP
  // is a fundamentally strong company (fundamentals pass, still above its
  // 200-day) that has DIPPED below its 50-day — and requiring price ≥ 50-SMA
  // (and 50 > 200) rejects exactly that entry. The 200-day gate above still
  // keeps the long-term trend intact, so this loosens timing, not quality.
  const [requireAbove50SMA, setRequireAbove50SMA] = useState(false) // Above 50-day SMA
  const [requireGoldenCross, setRequireGoldenCross] = useState(false) // Golden Cross (50 > 200)
  // MACD-bullish + red-day defaults are OFF: demanding a bullish crossover AND a
  // down day AND oversold AND above all SMAs simultaneously left strict Step 4
  // empty on nearly every run. Users can re-enable either for stricter entries.
  const [requireMACDBullish, setRequireMACDBullish] = useState(false) // MACD Bullish Signal
  const [requireRedDay, setRequireRedDay] = useState(false) // Red Day Preferred

  // CSP entry filters (lib/trend-filters.ts). ALL FOUR DEFAULT ON, at the
  // owner's instruction: these are not stricter-entry preferences like the
  // toggles above, they are the two things he does not want to sell a put
  // into — a stock that just ripped, and a stock that has fallen for a year.
  //
  // Defaulting a gate ON is a deliberate break from the pattern above, where
  // MACD/red-day/Bollinger default OFF because stacking them empties strict
  // Step 4. These can empty it too, on a weak tape, and that is the intended
  // answer rather than a bug: "nothing qualifies today" is a result.
  const [excludeBigUpDay, setExcludeBigUpDay] = useState(true) // no puts into a spike
  // Annotated `number[]`: `MAX_DAY_MOVE` is `as const`, so an unannotated
  // useState infers the literal type `10[]` and the setter stops accepting any
  // other number.
  const [maxDayMove, setMaxDayMove] = useState<number[]>([MAX_DAY_MOVE.DEFAULT])
  const [excludeDownYear, setExcludeDownYear] = useState(true) // trailing year negative (GRADED in the relaxed pass)
  // Laggard-vs-SPY default OFF (owner 2026-08-29, was ON). It over-excludes on
  // a down-breadth day (nearly everything trails SPY) and is REDUNDANT with the
  // relaxed pass, which already surfaces relative strength as the soft Beat-SPY
  // ✓/✗ column rather than a removal. Kept as a toggle for anyone who wants it.
  const [excludeBenchmarkLaggard, setExcludeBenchmarkLaggard] = useState(false) // trailed SPY
  const [excludeStage4, setExcludeStage4] = useState(true) // below a FALLING 150-day MA — KEPT ON: the falling-knife guardrail

  // RELAXED-pass down-year grading (owner 2026-08-29), tunable live. These
  // touch ONLY Step 5 — the strict Step 4 down-year gate rejects any negative
  // year regardless. `deepDecline` is a percent (e.g. −25); the cap floor is a
  // ladder INDEX into RELAXED_MILD_DOWN_CAP_TIERS so the slider offers real
  // sizes rather than an arbitrary dollar figure.
  const [relaxedDeepDeclinePct, setRelaxedDeepDeclinePct] = useState<number[]>([RELAXED_DEEP_DECLINE.DEFAULT])
  const [relaxedMildDownCapIndex, setRelaxedMildDownCapIndex] = useState<number[]>([
    RELAXED_MILD_DOWN_CAP_DEFAULT_INDEX,
  ])

  // S-8. **These two are HIDDEN GATES: they filter Step 3 results and no UI
  // control exposes them.** `technical-criteria.ts` tests `yieldCheck` on
  // `minYield` and `volumeCheck` on `minVolumeTechnicals`, so a stock can be
  // dropped from the scan by a threshold the user never set and cannot see.
  // Recorded here, and stated in the Step 3 explainer, until sliders exist.
  //
  // The comment that used to sit on the second line read "This variable is
  // declared but not used in the provided code snippet" — flatly false, and the
  // Wave-2 split introduced it. **A comment asserting that a live filter is
  // dead is worse than no comment**: it invites the next reader to delete a
  // gate that is changing results.
  const [minYield, setMinYield] = useState([1]) // percent — filters at yieldCheck
  const [minVolumeTechnicals, setMinVolumeTechnicals] = useState([2]) // millions — filters at volumeCheck

  // Slider/toggle values packaged for the shared technical gate functions
  // (components/scanner/technical-criteria.ts) — same reads as before extraction.
  const technicalFilterSettings: TechnicalFilterSettings = {
    maxRSI: maxRSI[0],
    maxStochastic: maxStochastic[0],
    minATR: minATR[0],
    maxATR: maxATR[0],
    requireBollingerBands,
    requireAbove200SMA,
    requireAbove50SMA,
    requireGoldenCross,
    requireMACDBullish,
    requireRedDay,
    minYield: minYield[0],
    minVolumeTechnicals: minVolumeTechnicals[0],
    excludeBigUpDay,
    maxDayMove: maxDayMove[0],
    excludeDownYear,
    excludeBenchmarkLaggard,
    excludeStage4,
    relaxedDeepDeclinePct: relaxedDeepDeclinePct[0],
    relaxedMildDownMinCap:
      RELAXED_MILD_DOWN_CAP_TIERS[relaxedMildDownCapIndex[0]]?.value ??
      RELAXED_MILD_DOWN_CAP_TIERS[RELAXED_MILD_DOWN_CAP_DEFAULT_INDEX].value,
  }

  const checkTechnicalCriteria = (stock: QualifyingStock) => checkCriteriaWithSettings(stock, technicalFilterSettings)

  return {
    maxRSI, setMaxRSI,
    maxStochastic, setMaxStochastic,
    minATR, setMinATR,
    maxATR, setMaxATR,
    requireBollingerBands, setRequireBollingerBands,
    requireAbove200SMA, setRequireAbove200SMA,
    requireAbove50SMA, setRequireAbove50SMA,
    requireGoldenCross, setRequireGoldenCross,
    requireMACDBullish, setRequireMACDBullish,
    requireRedDay, setRequireRedDay,
    excludeBigUpDay, setExcludeBigUpDay,
    maxDayMove, setMaxDayMove,
    excludeDownYear, setExcludeDownYear,
    excludeBenchmarkLaggard, setExcludeBenchmarkLaggard,
    excludeStage4, setExcludeStage4,
    relaxedDeepDeclinePct, setRelaxedDeepDeclinePct,
    relaxedMildDownCapIndex, setRelaxedMildDownCapIndex,
    minYield, setMinYield,
    minVolumeTechnicals, setMinVolumeTechnicals,
    technicalFilterSettings,
    checkTechnicalCriteria,
  }
}
