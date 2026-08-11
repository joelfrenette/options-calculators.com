// CCPI Calculation & Utility Functions
// Pure functions for color mapping, scoring, and data transformations

import type { CCPIData, CCPIRegimeZone } from "./types"
import { COLOR_MAP, CCPI_THRESHOLDS, PILLAR_WEIGHTS } from "./constants"

/**
 * Converts color name to hex value
 */
export function getReadableColor(colorName: string): string {
  return COLOR_MAP[colorName as keyof typeof COLOR_MAP] || COLOR_MAP.gray
}

// P7-9. `getBarColor` and `getRegimeColor` were deleted here, with the
// GRADIENT_BAR_COLORS and REGIME_COLORS constants only they read.
//
// `getRegimeColor` is the one that mattered: it classified a CCPI level into
// five bands off CCPI_THRESHOLDS and returned a Tailwind class, which is the
// same classification `getRegimeZone` below performs — returning a label and a
// colour NAME instead. One score, one set of thresholds, classified twice.
// Only `getRegimeZone` was ever called. Two copies agreeing today is not a
// property anything enforces; the next threshold change would have had to find
// both, and the audit has already watched that fail four times (the "comment
// recording a fix is where the missed instance lives" pattern).
//
// `getBarColor` bucketed a 0-100 percentage at 33/66. The live gradient bar is
// `CCPIGradientBar` in components/ccpi/indicator-primitives.tsx, which renders
// a continuous CSS gradient and a mask — no buckets, no thresholds, nothing
// this function could have kept in step with.

/**
 * Gets regime zone information based on CCPI score
 */
export function getRegimeZone(ccpi: number): CCPIRegimeZone {
  if (ccpi >= CCPI_THRESHOLDS.CRASH_WATCH) return { color: "red", label: "CRASH WATCH" }
  if (ccpi >= CCPI_THRESHOLDS.HIGH_ALERT) return { color: "orange", label: "HIGH ALERT" }
  if (ccpi >= CCPI_THRESHOLDS.CAUTION) return { color: "yellow", label: "CAUTION" }
  if (ccpi >= CCPI_THRESHOLDS.NORMAL) return { color: "lightgreen", label: "NORMAL" }
  return { color: "green", label: "LOW RISK" }
}

// P7-9. `getIndicatorStatus` was deleted here, together with the
// `CCPIIndicatorThresholds` and `CCPIIndicatorStatus` types in ./types that
// only it used.
//
// It had no caller, and the reason is that the design it belonged to was
// replaced: indicators are rendered by `CCPIIndicator` in
// components/ccpi/indicator-primitives.tsx, which takes a threshold object of
// an entirely different shape — `{ low: { value, label }, high: { value,
// label } }` against this one's `{ low: number, high: number, ideal? }` — and
// shows a gradient bar with band labels rather than a colour/status pair.
//
// **The component declares its own interface under the same name**, so the
// repo held two incompatible `CCPIIndicatorThresholds`, one live and one dead,
// and an import of the wrong one type-errors in a way that reads as a mistake
// in the caller. That ambiguity is the whole reason to remove the loser rather
// than leave it sitting in a module no check script can load (P6-85).

/**
 * Sorts canaries by severity (high > medium > low) then by impact score
 */
export function sortCanaries(canaries: CCPIData["canaries"]): CCPIData["canaries"] {
  return [...canaries].sort((a, b) => {
    // First sort by severity: high before medium before low
    if (a.severity === "high" && b.severity !== "high") return -1
    if (a.severity !== "high" && b.severity === "high") return 1
    if (a.severity === "medium" && b.severity === "low") return -1
    if (a.severity === "low" && b.severity === "medium") return 1

    // Within same severity, sort by impact score descending
    const impactA = a.impactScore ?? 0
    const impactB = b.impactScore ?? 0
    return impactB - impactA
  })
}

/**
 * Weighted-average CCPI from pillar values, renormalized over the non-null
 * pillars — mirroring lib/ccpi/scoring.ts's composite semantics. A pillar is
 * null when its scored weight fell below the minimum after baseline exclusion.
 * Returns null when no pillar is scoreable; treating null as 0 here is exactly
 * the un-renormalized bug the scoring rework removed (AUDIT P3-12).
 */
export function calculateCCPI(pillars: CCPIData["pillars"]): number | null {
  const entries: Array<[number | null, number]> = [
    [pillars.momentum, PILLAR_WEIGHTS.momentum],
    [pillars.riskAppetite, PILLAR_WEIGHTS.riskAppetite],
    [pillars.valuation, PILLAR_WEIGHTS.valuation],
    [pillars.macro, PILLAR_WEIGHTS.macro],
  ]
  let weighted = 0
  let totalWeight = 0
  for (const [score, weight] of entries) {
    if (score === null) continue
    weighted += score * weight
    totalWeight += weight
  }
  return totalWeight > 0 ? weighted / totalWeight : null
}

// `validateCCPICalculation` was deleted here (P7-4). It was a function named
// "validate" that answered `true` — valid — for a composite it could not
// compute: `if (calculated === null) return true`. On this index a null
// composite means no pillar had enough live or AI weight to score, which is the
// state most in need of being flagged, and it reported clean.
//
// Nothing called it. A repo-wide search for the symbol across app/, lib/,
// components/ and scripts/ returned only its own definition — so it was dead
// code holding a reassuring default, the exact shape of P6-81's second Fear &
// Greed implementation, sitting in one of the two modules no check script can
// load (P6-85). Nothing would have caught it if someone had wired it up.
//
// The live implementation of this decision is `validateCCPI` in
// `components/ccpi-audit-admin.tsx`, and it is correct: an unscoreable
// composite returns `ok: null` with "NOT VERIFIABLE", not a pass. Two
// implementations of one decision, one right and one wrong — keep the one the
// admin panel actually renders.

/**
 * Formats pillar contribution for logging. Null pillars print "n/a (excluded)".
 */
export function formatPillarContribution(pillars: CCPIData["pillars"]): string {
  const line = (label: string, score: number | null, weight: number) =>
    score === null
      ? `${label}: n/a (excluded — insufficient scored weight)`
      : `${label}: ${score} × ${(weight * 100).toFixed(0)}% = ${(score * weight).toFixed(1)}`
  return [
    line("Momentum", pillars.momentum, PILLAR_WEIGHTS.momentum),
    line("Risk Appetite", pillars.riskAppetite, PILLAR_WEIGHTS.riskAppetite),
    line("Valuation", pillars.valuation, PILLAR_WEIGHTS.valuation),
    line("Macro", pillars.macro, PILLAR_WEIGHTS.macro),
  ].join("\n")
}

/**
 * Counts active warnings (high and medium severity canaries)
 */
export function countActiveWarnings(canaries: CCPIData["canaries"]): number {
  return canaries.filter((c) => c.severity === "high" || c.severity === "medium").length
}
