/**
 * CCPI canary signals — the warning list on the Crash & Corrections tab.
 *
 * WHY THIS MODULE EXISTS (P6-31, P6-32). These thresholds used to live inside
 * `app/api/ccpi/route.ts`, reading the assembly layer's values directly. That
 * layer substitutes constants for anything it could not fetch — `|| 0`,
 * `|| false`, and `fetchWithAIFallback`'s baseline argument — so a canary could
 * evaluate a number the market never produced. Three did it through a visible
 * `|| <const>` (P6-31); the Buffett one sat above its own threshold and pushed
 * "Above fair value" as a warning on every load with no data behind it. The
 * other 31 did it invisibly, because their constant was upstream.
 *
 * The fix is structural, not a patch: **every input is nullable, and null
 * produces no canary.** The caller resolves tiers (`notBaseline`) before
 * calling in, so this module has no notion of provenance — it cannot be handed
 * a baseline constant without the caller having decided to lie to it. That also
 * makes it testable: it is import-free, so
 * `scripts/check-ccpi-canaries.ts` loads it directly and asserts the property
 * that matters — all-null input yields zero canaries.
 *
 * `suppressed` names every indicator that could not be evaluated. A short
 * canary list and a short canary list with eleven suppressed inputs mean very
 * different things, and the UI could not previously tell them apart.
 */

/**
 * Pillar shares, as percentages, passed in by the caller.
 *
 * Deliberately a parameter rather than an import. The check scripts run under
 * node's type stripping, which cannot resolve extensionless local imports, so
 * anything a check script loads has to stay import-free — the same constraint
 * that keeps lib/ccpi/scoring.ts and lib/vix-term.ts dependency-free. Taking
 * the weights as an argument keeps PILLAR_WEIGHTS as the single source of
 * truth without duplicating it here.
 */
import { buffettCanarySeverity } from "./buffett-bands.ts"

export interface PillarPercentages {
  momentum: number
  riskAppetite: number
  valuation: number
  macro: number
}

const MOMENTUM = "Momentum & Technical"
const RISK = "Risk Appetite & Volatility"
const VALUATION = "Valuation & Market Structure"
const MACRO = "Macro"

export interface CanarySignal {
  signal: string
  pillar: string
  severity: "high" | "medium" | "low"
  indicatorWeight: number
  pillarWeight: number
  impactScore: number
}

export interface CanaryResult {
  canaries: CanarySignal[]
  /** Indicator labels that could not be evaluated because their input was null. */
  suppressed: string[]
}

/**
 * Every field is nullable and null means "not measured". Callers must pass null
 * rather than a stand-in: a zero daily return and an unavailable daily return
 * are different claims about the market.
 */
export interface CanaryInputs {
  // Momentum & Technical
  qqqDailyReturn: number | null
  qqqConsecDown: number | null
  qqqBelowSMA20: boolean | null
  qqqSMA20Proximity: number | null
  qqqBelowSMA50: boolean | null
  qqqSMA50Proximity: number | null
  qqqBelowSMA200: boolean | null
  qqqSMA200Proximity: number | null
  qqqBelowBollinger: boolean | null
  qqqBollingerProximity: number | null
  vix: number | null
  vixTermStructure: number | null
  nvidiaMomentum: number | null
  soxIndex: number | null
  // Risk Appetite
  putCallRatio: number | null
  fearGreedIndex: number | null
  aaiiBullish: number | null
  etfFlows: number | null
  // Valuation
  spxPE: number | null
  spxPS: number | null
  buffettIndicator: number | null
  equityRiskPremium: number | null
  // Macro
  fedFundsRate: number | null
  junkSpread: number | null
  debtToGDP: number | null
  yieldCurve: number | null
  dxyIndex: number | null
  fedReverseRepo: number | null
}

/**
 * The SOX canary has no trailing baseline to compare against — the semiconductor
 * index is not in FRED and Polygon's grouped bars carry no indices, so nothing
 * the site stores can supply a moving reference (P6-33).
 *
 * It therefore compares against a fixed level, and the copy has to say so. The
 * old wording, "SOX down 12% - Chip sector crash", read as a market move; it
 * actually meant "12% below 5,000", which drifts from meaningless to permanent
 * as the index re-rates. Naming the constant was not enough — the SENTENCE was
 * the false claim. Until a real reference series exists, the canary states the
 * level it is measuring against.
 */
export const SOX_REFERENCE_LEVEL = 5000

export function generateCanarySignals(inputs: CanaryInputs, PILLAR_PCT: PillarPercentages): CanaryResult {
  const canaries: CanarySignal[] = []
  const suppressed: string[] = []

  const push = (
    signal: string,
    pillar: string,
    severity: "high" | "medium",
    indicatorWeight: number,
    pillarPct: number,
  ) => {
    canaries.push({
      signal,
      pillar,
      severity,
      indicatorWeight,
      pillarWeight: pillarPct,
      impactScore: indicatorWeight * (pillarPct / 100),
    })
  }

  /**
   * Runs `body` only when every input it needs is present. A missing input is
   * recorded rather than defaulted — that record is the difference between
   * "no warning" and "could not check".
   */
  const when = (label: string, values: Array<number | boolean | null>, body: () => void) => {
    if (values.some((v) => v === null || (typeof v === "number" && !Number.isFinite(v)))) {
      suppressed.push(label)
      return
    }
    body()
  }

  // --- Pillar 1: Momentum & Technical ---

  when("QQQ Daily Return", [inputs.qqqDailyReturn], () => {
    const v = inputs.qqqDailyReturn as number
    if (v <= -6) {
      push(`QQQ crashed ${Math.abs(v).toFixed(1)}% - Momentum loss`, MOMENTUM, "high", 12, PILLAR_PCT.momentum)
    } else if (v <= -3) {
      push(`QQQ dropped ${Math.abs(v).toFixed(1)}% - Sharp decline`, MOMENTUM, "medium", 12, PILLAR_PCT.momentum)
    }
  })

  when("QQQ Consecutive Down Days", [inputs.qqqConsecDown], () => {
    const v = inputs.qqqConsecDown as number
    if (v >= 5) {
      push(`${v} consecutive down days - Trend break`, MOMENTUM, "high", 7, PILLAR_PCT.momentum)
    } else if (v >= 3) {
      push(`${v} consecutive down days`, MOMENTUM, "medium", 7, PILLAR_PCT.momentum)
    }
  })

  // The breach flag and the proximity share one source, so they share one gate.
  when("QQQ 20-Day SMA", [inputs.qqqBelowSMA20, inputs.qqqSMA20Proximity], () => {
    const prox = inputs.qqqSMA20Proximity as number
    if (inputs.qqqBelowSMA20 && prox >= 100) {
      push("QQQ breached 20-day SMA - Short-term support lost", MOMENTUM, "high", 7, PILLAR_PCT.momentum)
    } else if (prox >= 50) {
      push(`QQQ approaching 20-day SMA (${prox.toFixed(0)}% proximity)`, MOMENTUM, "medium", 7, PILLAR_PCT.momentum)
    }
  })

  when("QQQ 50-Day SMA", [inputs.qqqBelowSMA50, inputs.qqqSMA50Proximity], () => {
    const prox = inputs.qqqSMA50Proximity as number
    if (inputs.qqqBelowSMA50 && prox >= 100) {
      push("QQQ breached 50-day SMA - Medium-term trend broken", MOMENTUM, "high", 10, PILLAR_PCT.momentum)
    } else if (prox >= 50) {
      push(`QQQ approaching 50-day SMA (${prox.toFixed(0)}% proximity)`, MOMENTUM, "medium", 10, PILLAR_PCT.momentum)
    }
  })

  when("QQQ 200-Day SMA", [inputs.qqqBelowSMA200, inputs.qqqSMA200Proximity], () => {
    const prox = inputs.qqqSMA200Proximity as number
    if (inputs.qqqBelowSMA200 && prox >= 100) {
      push("QQQ breached 200-day SMA - Long-term bull market in question", MOMENTUM, "high", 15, PILLAR_PCT.momentum)
    } else if (prox >= 50) {
      push(`QQQ approaching 200-day SMA (${prox.toFixed(0)}% proximity)`, MOMENTUM, "medium", 15, PILLAR_PCT.momentum)
    }
  })

  when("QQQ Bollinger Band", [inputs.qqqBelowBollinger, inputs.qqqBollingerProximity], () => {
    const prox = inputs.qqqBollingerProximity as number
    if (inputs.qqqBelowBollinger && prox >= 100) {
      push("QQQ breached lower Bollinger Band - Oversold territory", MOMENTUM, "high", 9, PILLAR_PCT.momentum)
    } else if (prox >= 50) {
      push(`QQQ approaching Bollinger Band (${prox.toFixed(0)}% proximity)`, MOMENTUM, "medium", 9, PILLAR_PCT.momentum)
    }
  })

  when("VIX", [inputs.vix], () => {
    const v = inputs.vix as number
    if (v > 35) {
      push(`VIX at ${v.toFixed(1)} - Extreme fear`, MOMENTUM, "high", 13, PILLAR_PCT.momentum)
    } else if (v > 25) {
      push(`VIX at ${v.toFixed(1)} - Elevated fear`, MOMENTUM, "medium", 13, PILLAR_PCT.momentum)
    }
  })

  // RATIO convention: VIX3M / spot; < 1 = backwardation.
  when("VIX Term Structure", [inputs.vixTermStructure], () => {
    const v = inputs.vixTermStructure as number
    if (v < 0.95) {
      push(`VIX term structure in backwardation (${v.toFixed(2)}) - Immediate fear`, MOMENTUM, "high", 9, PILLAR_PCT.momentum)
    } else if (v < 1.0) {
      push(`VIX term structure flattening (${v.toFixed(2)})`, MOMENTUM, "medium", 9, PILLAR_PCT.momentum)
    }
  })

  when("NVIDIA Momentum", [inputs.nvidiaMomentum], () => {
    const v = inputs.nvidiaMomentum as number
    if (v < 20) {
      push(`NVIDIA momentum at ${v} - AI sector weakness`, MOMENTUM, "high", 9, PILLAR_PCT.momentum)
    } else if (v < 40) {
      push(`NVIDIA momentum at ${v} - Tech leadership fading`, MOMENTUM, "medium", 9, PILLAR_PCT.momentum)
    }
  })

  when("SOX Index", [inputs.soxIndex], () => {
    const deviation = (((inputs.soxIndex as number) - SOX_REFERENCE_LEVEL) / SOX_REFERENCE_LEVEL) * 100
    const level = inputs.soxIndex as number
    if (deviation < -15) {
      push(
        `SOX at ${level.toFixed(0)}, ${Math.abs(deviation).toFixed(1)}% below the ${SOX_REFERENCE_LEVEL} reference - Chip sector weakness`,
        MOMENTUM,
        "high",
        9,
        PILLAR_PCT.momentum,
      )
    } else if (deviation < -10) {
      push(
        `SOX at ${level.toFixed(0)}, ${Math.abs(deviation).toFixed(1)}% below the ${SOX_REFERENCE_LEVEL} reference`,
        MOMENTUM,
        "medium",
        9,
        PILLAR_PCT.momentum,
      )
    }
  })

  // --- Pillar 2: Risk Appetite & Sentiment ---

  when("Put/Call Ratio", [inputs.putCallRatio], () => {
    const v = inputs.putCallRatio as number
    if (v < 0.6) {
      push(`Put/Call at ${v.toFixed(2)} - Extreme complacency`, RISK, "high", 37, PILLAR_PCT.riskAppetite)
    } else if (v < 0.85) {
      push(`Put/Call at ${v.toFixed(2)} - Low hedging activity`, RISK, "medium", 37, PILLAR_PCT.riskAppetite)
    }
  })

  when("Fear & Greed", [inputs.fearGreedIndex], () => {
    const v = inputs.fearGreedIndex as number
    if (v > 80) {
      push(`Fear & Greed at ${v} - Extreme greed`, RISK, "high", 30, PILLAR_PCT.riskAppetite)
    } else if (v > 70) {
      push(`Fear & Greed at ${v} - Elevated greed`, RISK, "medium", 30, PILLAR_PCT.riskAppetite)
    }
  })

  when("AAII Bullish", [inputs.aaiiBullish], () => {
    const v = inputs.aaiiBullish as number
    if (v > 55) {
      push(`AAII Bullish at ${v}% - Retail euphoria`, RISK, "high", 33, PILLAR_PCT.riskAppetite)
    } else if (v > 45) {
      push(`AAII Bullish at ${v}% - Elevated retail optimism`, RISK, "medium", 33, PILLAR_PCT.riskAppetite)
    }
  })

  // Informational only — not part of any pillar's weights, hence weight 0.
  when("ETF Flows", [inputs.etfFlows], () => {
    const v = inputs.etfFlows as number
    if (v < -3.0) {
      push(`ETF outflows at $${Math.abs(v).toFixed(1)}B - Capital flight`, RISK, "high", 0, PILLAR_PCT.riskAppetite)
    } else if (v < -1.5) {
      push(`ETF outflows at $${Math.abs(v).toFixed(1)}B - Selling pressure`, RISK, "medium", 0, PILLAR_PCT.riskAppetite)
    }
  })

  // --- Pillar 3: Valuation & Market Structure ---

  when("S&P 500 P/E", [inputs.spxPE], () => {
    const v = inputs.spxPE as number
    if (v > 30) {
      push(`S&P 500 P/E at ${v.toFixed(1)} - Extreme overvaluation`, VALUATION, "high", 32, PILLAR_PCT.valuation)
    } else if (v > 22) {
      push(`S&P 500 P/E at ${v.toFixed(1)} - Above historical average`, VALUATION, "medium", 32, PILLAR_PCT.valuation)
    }
  })

  when("S&P 500 P/S", [inputs.spxPS], () => {
    const v = inputs.spxPS as number
    if (v > 3.5) {
      push(`S&P 500 P/S at ${v.toFixed(1)} - Extremely expensive`, VALUATION, "high", 21, PILLAR_PCT.valuation)
    } else if (v > 2.5) {
      push(`S&P 500 P/S at ${v.toFixed(1)} - Elevated valuation`, VALUATION, "medium", 21, PILLAR_PCT.valuation)
    }
  })

  // P7-73a: severity comes from the same ladder that scores the indicator
  // (lib/ccpi/buffett-bands.ts). Before this, the canary said "significantly
  // overvalued" above 200 while scoring awarded full marks above 200 and the
  // middle rungs disagreed (150 vs 180) — two ladders for one number.
  when("Buffett Indicator", [inputs.buffettIndicator], () => {
    const v = inputs.buffettIndicator as number
    const severity = buffettCanarySeverity(v)
    if (severity === "high") {
      push(`Buffett Indicator at ${v.toFixed(0)}% - Significantly overvalued`, VALUATION, "high", 29, PILLAR_PCT.valuation)
    } else if (severity === "medium") {
      push(`Buffett Indicator at ${v.toFixed(0)}% - Above fair value`, VALUATION, "medium", 29, PILLAR_PCT.valuation)
    }
  })

  when("Equity Risk Premium", [inputs.equityRiskPremium], () => {
    const v = inputs.equityRiskPremium as number
    if (v < 1.5) {
      push(`Equity Risk Premium at ${v.toFixed(2)}% - Stocks vs bonds severely overpriced`, VALUATION, "high", 18, PILLAR_PCT.valuation)
    } else if (v < 3.0) {
      push(`Equity Risk Premium at ${v.toFixed(2)}% - Low compensation for equity risk`, VALUATION, "medium", 18, PILLAR_PCT.valuation)
    }
  })

  // --- Pillar 4: Macro ---

  when("Fed Funds Rate", [inputs.fedFundsRate], () => {
    const v = inputs.fedFundsRate as number
    if (v > 6.0) {
      push(`Fed Funds at ${v.toFixed(2)}% - Extremely restrictive`, MACRO, "high", 21, PILLAR_PCT.macro)
    } else if (v > 5.0) {
      push(`Fed Funds at ${v.toFixed(2)}% - Restrictive policy`, MACRO, "medium", 21, PILLAR_PCT.macro)
    }
  })

  when("Junk Spread", [inputs.junkSpread], () => {
    const v = inputs.junkSpread as number
    if (v > 8) {
      push(`Junk Bond Spread at ${v.toFixed(2)}% - Severe credit stress`, MACRO, "high", 14, PILLAR_PCT.macro)
    } else if (v > 5) {
      push(`Junk Bond Spread at ${v.toFixed(2)}% - Credit tightening`, MACRO, "medium", 14, PILLAR_PCT.macro)
    }
  })

  when("Debt-to-GDP", [inputs.debtToGDP], () => {
    const v = inputs.debtToGDP as number
    if (v > 130) {
      push(`US Debt-to-GDP at ${v.toFixed(0)}% - Fiscal crisis risk`, MACRO, "high", 14, PILLAR_PCT.macro)
    } else if (v > 110) {
      push(`US Debt-to-GDP at ${v.toFixed(0)}% - Elevated fiscal burden`, MACRO, "medium", 14, PILLAR_PCT.macro)
    }
  })

  // Scored once, in Macro (P3-13). Convention is 10Y − 2Y, so negative =
  // inverted — see lib/yield-curve.ts, which owns that sign (P6-21).
  when("Yield Curve", [inputs.yieldCurve], () => {
    const v = inputs.yieldCurve as number
    if (v < -1.0) {
      push(`Yield curve inverted ${Math.abs(v).toFixed(2)}% - Deep inversion`, MACRO, "high", 19, PILLAR_PCT.macro)
    } else if (v < -0.2) {
      push(`Yield curve inverted ${Math.abs(v).toFixed(2)}%`, MACRO, "medium", 19, PILLAR_PCT.macro)
    }
  })

  when("Dollar Index", [inputs.dxyIndex], () => {
    const v = inputs.dxyIndex as number
    if (v > 115) {
      push(`Dollar Index at ${v.toFixed(1)} - Extreme dollar strength hurts tech`, MACRO, "high", 17, PILLAR_PCT.macro)
    } else if (v > 105) {
      push(`Dollar Index at ${v.toFixed(1)} - Strong dollar headwind`, MACRO, "medium", 17, PILLAR_PCT.macro)
    }
  })

  when("Fed Reverse Repo", [inputs.fedReverseRepo], () => {
    const v = inputs.fedReverseRepo as number
    if (v > 2000) {
      push(`Fed RRP at $${v.toFixed(0)}B - Severe liquidity drain`, MACRO, "high", 15, PILLAR_PCT.macro)
    } else if (v > 1000) {
      push(`Fed RRP at $${v.toFixed(0)}B - Tight liquidity conditions`, MACRO, "medium", 15, PILLAR_PCT.macro)
    }
  })

  canaries.sort((a, b) => {
    // High before medium, then by impact score descending.
    if (a.severity === "high" && b.severity !== "high") return -1
    if (a.severity !== "high" && b.severity === "high") return 1
    return b.impactScore - a.impactScore
  })

  return { canaries, suppressed }
}
