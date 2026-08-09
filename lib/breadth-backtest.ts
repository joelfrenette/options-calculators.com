/**
 * Breadth lead-time backtest — E-7e.
 *
 * Joel's standing constraint (AUDIT_BACKLOG E-6): an indicator earns CCPI
 * scoring weight only after it demonstrates LEAD time on real drawdown starts.
 * Coincident movers display unscored. This module is the evidence, and it is
 * built to be able to return "no" — a harness that cannot fail its own
 * indicator is not a test.
 *
 * Pure and I/O-free so scripts/check-breadth-backtest.ts can exercise every
 * branch without a database.
 *
 * TWO LIMITS ARE STRUCTURAL, NOT BUGS, AND TRAVEL WITH EVERY RESULT:
 *
 * 1. SURVIVORSHIP. lib/breadth-universe.ts is a 2026 membership list. Running
 *    it against 2000 or 2008 asks "how did the companies that SURVIVED to 2026
 *    behave back then" — a question whose answer is biased upward by
 *    construction, because the constituents that were deleted are exactly the
 *    ones that fell hardest. A lead time measured that way is not evidence.
 *
 * 2. COVERAGE. An episode is only testable when the stored series reaches back
 *    far enough BEFORE the peak to have seen a warning. With no pre-peak
 *    window there is nothing to lead with, and the episode reports
 *    `covered: false` rather than a lead of zero.
 */

export interface BreadthPoint {
  /** YYYY-MM-DD */
  day: string
  /** % of the qualified universe above its own 200-DMA */
  pct: number
}

export interface DrawdownEpisode {
  name: string
  /** S&P 500 closing peak, YYYY-MM-DD */
  peak: string
  /** S&P 500 closing trough, YYYY-MM-DD */
  trough: string
  /** Peak-to-trough decline, percent */
  declinePct: number
}

/**
 * The four drawdown starts the E-6 constraint names. Closing peak/trough dates
 * for the S&P 500.
 *
 * The first two are listed for completeness and will report `covered: false`
 * for the foreseeable future: the closes store retains a rolling window, and
 * even with a deep backfill the 2026 universe cannot honestly be run against
 * 2000 or 2008 (see SURVIVORSHIP above).
 */
export const DRAWDOWN_EPISODES: DrawdownEpisode[] = [
  { name: "Dot-com (2000-02)", peak: "2000-03-24", trough: "2002-10-09", declinePct: -49.1 },
  { name: "GFC (2007-09)", peak: "2007-10-09", trough: "2009-03-09", declinePct: -56.8 },
  { name: "COVID (2020)", peak: "2020-02-19", trough: "2020-03-23", declinePct: -33.9 },
  { name: "Rate shock (2022)", peak: "2022-01-03", trough: "2022-10-12", declinePct: -25.4 },
]

export interface SignalConfig {
  /** Breadth below this percentage counts as a warning day. */
  threshold: number
  /** Consecutive warning days required before the signal fires. */
  sustainDays: number
  /** How far before a peak a firing still counts as having led it. */
  lookbackDays: number
  /** A firing not followed by a peak within this many days is a false positive. */
  horizonDays: number
}

export const DEFAULT_SIGNAL: SignalConfig = {
  threshold: 50,
  sustainDays: 3,
  lookbackDays: 180,
  horizonDays: 180,
}

export interface EpisodeResult {
  episode: string
  peak: string
  /** True when the series covers enough of the pre-peak window to be testable. */
  covered: boolean
  coverageNote: string
  /** First day the signal fired inside the lookback window. */
  firstTriggerDay: string | null
  /** Calendar days from that firing to the peak. Null when nothing fired. */
  leadDays: number | null
}

export interface BacktestResult {
  config: SignalConfig
  seriesStart: string | null
  seriesEnd: string | null
  seriesPoints: number
  episodes: EpisodeResult[]
  /** Distinct signal firings across the whole series. */
  triggerCount: number
  /** Firings with no episode peak inside horizonDays. */
  falsePositives: number
  verdict: "insufficient-history" | "no-lead-demonstrated" | "lead-demonstrated"
  verdictReason: string
  survivorshipWarning: string
  /** Restates the E-6 gate so a caller cannot read a verdict as authorisation. */
  scoringGate: string
}

export const SURVIVORSHIP_WARNING =
  "The breadth universe is a 2026 membership list. Applied to an episode before that date it measures only the constituents that survived to 2026 — the ones that fell hardest are missing — so any lead time it reports is biased and must not be used as evidence for scoring weight."

const SCORING_GATE =
  "Demonstrated lead time is a precondition for CCPI scoring weight, not a grant of it (AUDIT_BACKLOG E-6). Breadth stays display-and-canary only until the owner decides otherwise."

function toUtcMs(day: string): number {
  return new Date(`${day}T00:00:00Z`).getTime()
}

/** Calendar days from `a` to `b`; negative when b precedes a. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86400000)
}

/**
 * Days on which the signal FIRES — the first day of each run of
 * `sustainDays` consecutive points below the threshold. Subsequent days of the
 * same run are not new firings: a signal that re-fires every day it stays true
 * would report a false-positive count driven by how long it stayed on.
 *
 * "Consecutive" means consecutive POINTS, not calendar days. The series is
 * trading days, so weekends and holidays are absences, not breaks.
 */
export function findTriggerDays(series: BreadthPoint[], config: SignalConfig): string[] {
  const sorted = [...series].sort((x, y) => toUtcMs(x.day) - toUtcMs(y.day))
  const triggers: string[] = []
  let run = 0
  let firedThisRun = false

  for (let i = 0; i < sorted.length; i++) {
    const point = sorted[i]
    if (!Number.isFinite(point.pct)) {
      // A gap is not a warning day and must not extend a run through it.
      run = 0
      firedThisRun = false
      continue
    }
    if (point.pct < config.threshold) {
      run++
      if (run >= config.sustainDays && !firedThisRun) {
        // Credit the firing to the day the run STARTED, not the day it
        // completed: that is when the warning was first observable, and
        // crediting the later day would understate lead time by sustainDays-1.
        triggers.push(sorted[i - (config.sustainDays - 1)].day)
        firedThisRun = true
      }
    } else {
      run = 0
      firedThisRun = false
    }
  }
  return triggers
}

export function runBreadthBacktest(
  series: BreadthPoint[],
  config: SignalConfig = DEFAULT_SIGNAL,
  episodes: DrawdownEpisode[] = DRAWDOWN_EPISODES,
): BacktestResult {
  const sorted = [...series]
    .filter((p) => Number.isFinite(p.pct))
    .sort((x, y) => toUtcMs(x.day) - toUtcMs(y.day))
  const seriesStart = sorted.length > 0 ? sorted[0].day : null
  const seriesEnd = sorted.length > 0 ? sorted[sorted.length - 1].day : null

  const triggers = findTriggerDays(sorted, config)

  const episodeResults: EpisodeResult[] = episodes.map((ep) => {
    // Testable only when the series actually spans the pre-peak window. A
    // series that begins after the peak, or covers only a sliver of the
    // lookback, cannot have led anything.
    const windowStart = seriesStart
    const spansPeak = seriesEnd !== null && daysBetween(ep.peak, seriesEnd) >= 0
    const preWindowDays = windowStart === null ? 0 : daysBetween(windowStart, ep.peak)
    const covered = spansPeak && preWindowDays >= config.lookbackDays

    if (!covered) {
      const why =
        seriesStart === null
          ? "no breadth history stored"
          : !spansPeak
            ? `stored history ends ${seriesEnd} — before this peak`
            : `stored history starts ${seriesStart}, only ${Math.max(0, preWindowDays)} of the ${config.lookbackDays} pre-peak days needed`
      return { episode: ep.name, peak: ep.peak, covered: false, coverageNote: why, firstTriggerDay: null, leadDays: null }
    }

    const inWindow = triggers.filter((t) => {
      const lead = daysBetween(t, ep.peak)
      return lead >= 0 && lead <= config.lookbackDays
    })
    const firstTriggerDay = inWindow.length > 0 ? inWindow[0] : null

    return {
      episode: ep.name,
      peak: ep.peak,
      covered: true,
      coverageNote: `series covers ${preWindowDays} pre-peak days`,
      firstTriggerDay,
      leadDays: firstTriggerDay === null ? null : daysBetween(firstTriggerDay, ep.peak),
    }
  })

  // A firing is a false positive when no episode peak follows it inside the
  // horizon. Episodes the series cannot cover are excluded from the judgement
  // — counting a firing against a peak the data cannot see is not evidence.
  const testablePeaks = episodeResults.filter((e) => e.covered).map((e) => e.peak)
  const falsePositives = triggers.filter(
    (t) => !testablePeaks.some((p) => daysBetween(t, p) >= 0 && daysBetween(t, p) <= config.horizonDays),
  ).length

  const covered = episodeResults.filter((e) => e.covered)
  const led = covered.filter((e) => e.leadDays !== null && e.leadDays > 0)

  let verdict: BacktestResult["verdict"]
  let verdictReason: string
  if (covered.length === 0) {
    verdict = "insufficient-history"
    verdictReason =
      "No episode has enough stored history before its peak to be testable. This is the expected answer until the closes store holds a deep backfill — it is not a pass."
  } else if (led.length === covered.length) {
    verdict = "lead-demonstrated"
    verdictReason = `Signal fired ahead of all ${covered.length} testable episode(s); median lead ${median(led.map((e) => e.leadDays as number))} days, with ${falsePositives} firing(s) not followed by a testable peak.`
  } else {
    verdict = "no-lead-demonstrated"
    verdictReason = `Signal led ${led.length} of ${covered.length} testable episode(s). It did not warn ahead of ${covered.length - led.length}.`
  }

  return {
    config,
    seriesStart,
    seriesEnd,
    seriesPoints: sorted.length,
    episodes: episodeResults,
    triggerCount: triggers.length,
    falsePositives,
    verdict,
    verdictReason,
    survivorshipWarning: SURVIVORSHIP_WARNING,
    scoringGate: SCORING_GATE,
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? Math.round((s[mid - 1] + s[mid]) / 2) : s[mid]
}
