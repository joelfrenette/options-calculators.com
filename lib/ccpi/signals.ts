/**
 * Signal definitions — turning stored series into firing / not-firing days.
 *
 * The missing link between `market_series` and `lib/ccpi/lead-time.ts`. The
 * scorer takes daily observations; the store holds levels. This is where a
 * level becomes a claim ("financial conditions are tighter than average"), and
 * therefore where every arbitrary number in the whole design lives.
 *
 * Dependency-free, so `scripts/check-signals.ts` can load it directly.
 *
 * ## THE THRESHOLDS BELOW ARE HYPOTHESES, NOT SETTINGS
 *
 * Each one is a starting point taken from the conventional reading of that
 * series — NFCI above zero means conditions tighter than average, an inverted
 * curve is negative, and so on. **Not one of them has been fitted, and none
 * should be tuned by hand.** CCPI_DESIGN.md §6 step 6 requires walk-forward
 * fitting: choose thresholds on 1990-2010 and score them on 2010-2026. Nudging
 * a threshold until a signal "catches 2008" is curve-fitting, it will look
 * excellent in the backtest, and it will predict nothing.
 *
 * The one thing that is not a hypothesis: **a signal never fires on missing
 * data.** `null` in, `null` out — never `false`. A quiet signal and an
 * unmeasured one are different claims, and the scorer treats them differently
 * (a null breaks an episode; a false continues the gap between episodes).
 */

export interface SeriesPoint {
  day: string
  value: number
}

export interface SignalObservationOut {
  day: string
  firing: boolean | null
}

export interface SignalDefinition {
  id: string
  label: string
  /** Series required, by bare FRED id. All must be present or the signal is unevaluable. */
  requires: readonly string[]
  /** One-line statement of what firing means, for the UI. */
  meaning: string
  /** The hypothesis being tested, recorded so it is never mistaken for a result. */
  hypothesis: string
  evaluate: (inputs: Record<string, readonly SeriesPoint[]>) => SignalObservationOut[]
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/** Fires when the level crosses a threshold in the given direction. */
function levelSignal(seriesId: string, threshold: number, direction: "above" | "below") {
  return (inputs: Record<string, readonly SeriesPoint[]>): SignalObservationOut[] => {
    const pts = inputs[seriesId]
    if (!pts) return []
    return pts.map((p) => ({
      day: p.day,
      firing: Number.isFinite(p.value) ? (direction === "above" ? p.value > threshold : p.value < threshold) : null,
    }))
  }
}

/**
 * Fires when the level has moved by more than `delta` across `lookbackDays`.
 *
 * Velocity rather than level, because a spread that has sat at 8% for a year is
 * a different claim from one that reached 8% last week — and the second is the
 * one that precedes things. Days before the lookback is satisfied are null, not
 * false: the signal has not been measured yet, it is not quiet.
 */
function velocitySignal(seriesId: string, lookbackDays: number, delta: number, direction: "rise" | "fall") {
  return (inputs: Record<string, readonly SeriesPoint[]>): SignalObservationOut[] => {
    const pts = inputs[seriesId]
    if (!pts) return []
    const byDay = new Map(pts.map((p) => [p.day, p.value]))
    return pts.map((p) => {
      const then = new Date(Date.parse(p.day + "T00:00:00Z") - lookbackDays * 86400000).toISOString().slice(0, 10)
      // Nearest stored day at or before the lookback point.
      let prior: number | undefined
      for (let i = 0; i <= 10 && prior === undefined; i++) {
        const d = new Date(Date.parse(then + "T00:00:00Z") - i * 86400000).toISOString().slice(0, 10)
        prior = byDay.get(d)
      }
      if (prior === undefined || !Number.isFinite(p.value) || !Number.isFinite(prior)) return { day: p.day, firing: null }
      const change = p.value - prior
      return { day: p.day, firing: direction === "rise" ? change > delta : change < -delta }
    })
  }
}

/** Fires when the ratio of two series crosses a threshold. */
function ratioSignal(numerator: string, denominator: string, threshold: number, direction: "above" | "below") {
  return (inputs: Record<string, readonly SeriesPoint[]>): SignalObservationOut[] => {
    const num = inputs[numerator]
    const den = inputs[denominator]
    if (!num || !den) return []
    const denByDay = new Map(den.map((p) => [p.day, p.value]))
    return num.map((p) => {
      const d = denByDay.get(p.day)
      // Deliberately NOT pairing across dates. Mismatched days produced the
      // AAII defect (S-11) and the CPI gap-month defect; a ratio of two
      // different days is not a reading.
      if (d === undefined || !Number.isFinite(p.value) || !Number.isFinite(d) || d === 0) {
        return { day: p.day, firing: null }
      }
      const r = p.value / d
      return { day: p.day, firing: direction === "above" ? r > threshold : r < threshold }
    })
  }
}

/**
 * Fires when a rising index is being carried by fewer and fewer names.
 *
 * The classic topping tell, and the one candidate with prior support that the
 * 2026-08-10 run could not test: an index at or near its highs while the share
 * of members above their 200-day average falls. Both halves are required —
 * breadth falling in a falling market is not divergence, it is just a decline.
 *
 * NOT a FRED series. `index` comes from stored closes (SPY) and `breadthPct`
 * from `breadth_daily`, so wiring it needs a data path the other signals do
 * not use. Until that exists and ~2 years of breadth has accumulated, this
 * reports nothing — which the lead-time scorer will state as
 * `insufficient-history` rather than a quiet zero.
 */
export function breadthDivergence(
  index: readonly SeriesPoint[],
  breadthPct: readonly SeriesPoint[],
  opts: { lookbackDays?: number; nearHighPct?: number; breadthDropPts?: number } = {},
): SignalObservationOut[] {
  const lookback = opts.lookbackDays ?? 60
  const nearHigh = opts.nearHighPct ?? 2 // within 2% of the lookback high
  const drop = opts.breadthDropPts ?? 5 // breadth down 5 percentage points

  const breadthByDay = new Map(breadthPct.map((p) => [p.day, p.value]))
  return index.map((p, i) => {
    const b = breadthByDay.get(p.day)
    // Same day only. A ratio or comparison across two dates is not a reading
    // (S-11, and the CPI gap month before it).
    if (b === undefined || !Number.isFinite(p.value) || !Number.isFinite(b)) return { day: p.day, firing: null }

    const window = index.slice(Math.max(0, i - lookback), i + 1)
    if (window.length < lookback) return { day: p.day, firing: null }
    const priorBreadth = breadthByDay.get(window[0].day)
    if (priorBreadth === undefined || !Number.isFinite(priorBreadth)) return { day: p.day, firing: null }

    const high = Math.max(...window.map((w) => w.value))
    const indexNearHigh = high > 0 && ((high - p.value) / high) * 100 <= nearHigh
    const breadthFalling = priorBreadth - b >= drop
    return { day: p.day, firing: indexNearHigh && breadthFalling }
  })
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

export const SIGNALS: readonly SignalDefinition[] = [
  {
    id: "curve-10y3m-inverted",
    label: "10Y-3M curve inverted",
    requires: ["T10Y3M"],
    meaning: "The 10-year yield is below the 3-month bill.",
    hypothesis: "Inversion precedes recessions by 12-18 months (Estrella-Mishkin). Lead to market PEAKS is the open question.",
    evaluate: levelSignal("T10Y3M", 0, "below"),
  },
  {
    id: "curve-10y2y-inverted",
    label: "10Y-2Y curve inverted",
    requires: ["T10Y2Y"],
    meaning: "The 10-year yield is below the 2-year.",
    hypothesis: "Same family as 10Y-3M, historically the weaker of the two. Kept so the pair can be compared rather than assumed.",
    evaluate: levelSignal("T10Y2Y", 0, "below"),
  },
  {
    id: "nfci-tightening",
    label: "Financial conditions tighter than average",
    requires: ["NFCI"],
    meaning: "The Chicago Fed index is above zero — conditions tighter than the historical average.",
    hypothesis: "A purpose-built financial-conditions index should lead drawdowns. Zero is the series' own definition of average, not a fitted number.",
    evaluate: levelSignal("NFCI", 0, "above"),
  },
  {
    id: "stlfsi-stress",
    label: "Financial stress elevated",
    requires: ["STLFSI4"],
    meaning: "The St. Louis Fed stress index is a full standard deviation above normal.",
    hypothesis: "Independent confirmation of NFCI. If the two never disagree, one of them is redundant weight.",
    evaluate: levelSignal("STLFSI4", 1, "above"),
  },
  {
    id: "hy-spread-widening",
    label: "Credit spreads widening fast",
    requires: ["BAMLH0A0HYM2"],
    meaning: "High-yield spreads have widened more than 50bp in 20 days.",
    hypothesis:
      "UNTESTABLE — display only. Velocity rather than level is the right shape, and credit turning is the classic precursor, but the ICE licence caps every BofA series at ~3 years (first observation 2023-08-11, confirmed against the KEYED API on 2026-08-10). There is no 2008, 2020 or 2022 to measure a lead time against, so this signal can show a reading and must never earn weight.",
    evaluate: velocitySignal("BAMLH0A0HYM2", 20, 0.5, "rise"),
  },
  {
    id: "claims-rising",
    label: "Jobless claims rising",
    requires: ["ICSA"],
    meaning: "Initial claims are more than 50,000 above their level six months ago.",
    hypothesis: "Labour market turns before recessions. Expect a long lead and a poor record against market peaks specifically.",
    evaluate: velocitySignal("ICSA", 182, 50000, "rise"),
  },
  {
    id: "vix-backwardation",
    label: "VIX term structure inverted",
    requires: ["VXVCLS", "VIXCLS"],
    meaning: "3-month VIX is below spot — the market prices more risk now than later.",
    hypothesis: "Almost certainly coincident. Included precisely so the backtest can demote it rather than the design assuming it.",
    evaluate: ratioSignal("VXVCLS", "VIXCLS", 1, "below"),
  },
]

/** The signals whose required series are all present in the store. */
export function evaluableSignals(availableSeriesIds: readonly string[]): SignalDefinition[] {
  return SIGNALS.filter((s) => s.requires.every((r) => availableSeriesIds.includes(r)))
}
