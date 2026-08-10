/**
 * Lead-time scorer — the instrument that decides which signals earn weight.
 *
 * CCPI_DESIGN.md §6 step 4. Generalises the shape proved by
 * `lib/breadth-backtest.ts` in E-7e, whose single most valuable property was
 * that it could say NO: `insufficient-history` is a verdict, not a failure.
 *
 * Dependency-free. The drawdown list is a parameter rather than an import for
 * the same reason `PILLAR_PCT` is in `lib/ccpi/canaries.ts` — node's type
 * stripping cannot resolve extensionless local imports, so anything a check
 * script loads has to stand alone.
 *
 * ## What it measures, and why each number is here
 *
 * A signal is a series of daily firing/not-firing observations. Contiguous runs
 * of firing days are **episodes**. For each reference drawdown, the signal
 * "hit" if an episode began within the lookback window before that drawdown's
 * peak. Everything else follows:
 *
 * - **medianLeadDays** — how much warning you actually got. Median, not mean:
 *   one 400-day lead should not flatter a signal that was otherwise late.
 * - **hitRate** — of the drawdowns this data can see, how many were preceded.
 * - **falsePositives** — episodes that preceded nothing. **This is the number
 *   dashboards omit and the reason most "crash indicators" are useless.** A
 *   signal that caught all four bear markets and fired eleven other times has a
 *   hit rate of 100% and no value whatsoever.
 * - **persistence** — how long episodes last. A one-day spike cannot be acted
 *   on; the design targets something you can act on over a week.
 *
 * ## What it deliberately refuses to do
 *
 * It never scores against a drawdown the observation window does not cover.
 * Silently skipping uncovered events is how `insufficient-history` becomes a
 * false pass — the exact trap E-7e was built to avoid.
 */

export interface SignalObservation {
  /** ISO date. */
  day: string
  /** Whether the signal was in its elevated state that day. Null = no data. */
  firing: boolean | null
}

export interface ReferenceEvent {
  id: string
  /** ISO date of the market peak the signal should have preceded. */
  peak: string
}

export interface LeadTimeOptions {
  /**
   * How far before a peak an episode may begin and still count as a warning.
   * Default 180 days: beyond roughly six months a "warning" is indistinguishable
   * from a permanently elevated reading, which is the boy-who-cried-wolf failure.
   */
  maxLeadDays?: number
  /**
   * Minimum episode length. Shorter runs are noise, not signals, and cannot be
   * acted on. Default 3 days.
   */
  minPersistenceDays?: number
  /** Below this many covered events, the scorer refuses to report. Default 3. */
  minCoveredEvents?: number
}

export interface Episode {
  start: string
  end: string
  days: number
  /** The event this episode preceded, if any. */
  precededEventId: string | null
  leadDays: number | null
}

export interface LeadTimeResult {
  verdict: "scored" | "insufficient-history"
  /** Why, when the verdict is insufficient-history. */
  reason: string | null
  /** Events whose peak falls inside the observation window. */
  coveredEventIds: string[]
  /** Events the observation window cannot see — never counted as misses. */
  uncoveredEventIds: string[]
  hitEventIds: string[]
  missedEventIds: string[]
  hitRate: number | null
  /**
   * Of every episode this signal produced, the share that preceded an event.
   *
   * THE NUMBER THAT MATTERS, and the one the first backtest was missing. Hit
   * rate answers "how many drawdowns did it catch"; precision answers "when it
   * fired, was it right". A signal firing twice a year will precede most things
   * by coincidence inside a six-month window and post a flattering hit rate on
   * no information at all — which is exactly what vix-backwardation did on the
   * 2026-08-10 run: 3 of 8 events caught, 43 false alarms, 6.5% precision.
   */
  precision: number | null
  medianLeadDays: number | null
  falsePositives: number
  falsePositivesPerDecade: number | null
  medianEpisodeDays: number | null
  episodes: Episode[]
  observedDays: number
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(fromISO + "T00:00:00Z")
  const b = Date.parse(toISO + "T00:00:00Z")
  return Math.round((b - a) / 86400000)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

export function scoreLeadTime(
  observations: readonly SignalObservation[],
  events: readonly ReferenceEvent[],
  options: LeadTimeOptions = {},
): LeadTimeResult {
  const maxLeadDays = options.maxLeadDays ?? 180
  const minPersistenceDays = options.minPersistenceDays ?? 3
  const minCoveredEvents = options.minCoveredEvents ?? 3

  const empty: LeadTimeResult = {
    verdict: "insufficient-history",
    reason: null,
    coveredEventIds: [],
    uncoveredEventIds: events.map((e) => e.id),
    hitEventIds: [],
    missedEventIds: [],
    hitRate: null,
    precision: null,
    medianLeadDays: null,
    falsePositives: 0,
    falsePositivesPerDecade: null,
    medianEpisodeDays: null,
    episodes: [],
    observedDays: 0,
  }

  const obs = [...observations].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
  if (obs.length === 0) return { ...empty, reason: "no observations" }

  const firstDay = obs[0].day
  const lastDay = obs[obs.length - 1].day

  // An event is only testable if its peak sits inside the window AND there is
  // enough runway before it for a warning to have been visible at all.
  const covered = events.filter((e) => daysBetween(firstDay, e.peak) >= maxLeadDays && e.peak <= lastDay)
  const uncovered = events.filter((e) => !covered.some((c) => c.id === e.id))

  // Episodes: contiguous runs of firing days. A null breaks the run — missing
  // data is not a quiet signal, and treating it as one would invent history.
  const episodes: Episode[] = []
  let runStart: string | null = null
  let runEnd: string | null = null
  for (const o of obs) {
    if (o.firing === true) {
      if (runStart === null) runStart = o.day
      runEnd = o.day
    } else if (runStart !== null && runEnd !== null) {
      const days = daysBetween(runStart, runEnd) + 1
      if (days >= minPersistenceDays) episodes.push({ start: runStart, end: runEnd, days, precededEventId: null, leadDays: null })
      runStart = null
      runEnd = null
    }
  }
  if (runStart !== null && runEnd !== null) {
    const days = daysBetween(runStart, runEnd) + 1
    if (days >= minPersistenceDays) episodes.push({ start: runStart, end: runEnd, days, precededEventId: null, leadDays: null })
  }

  if (covered.length < minCoveredEvents) {
    return {
      ...empty,
      reason: `only ${covered.length} of ${events.length} reference events have ${maxLeadDays} days of runway inside ${firstDay}..${lastDay}; ${minCoveredEvents} required`,
      coveredEventIds: covered.map((e) => e.id),
      uncoveredEventIds: uncovered.map((e) => e.id),
      episodes,
      observedDays: obs.length,
    }
  }

  // Attribute episodes to events. Earliest qualifying episode wins, so the lead
  // is the first warning rather than the last — the number that matters to
  // someone deciding when to sell.
  const hits: Array<{ id: string; leadDays: number }> = []
  for (const e of covered) {
    let best: { ep: Episode; lead: number } | null = null
    for (const ep of episodes) {
      const lead = daysBetween(ep.start, e.peak)
      if (lead >= 0 && lead <= maxLeadDays && (best === null || lead > best.lead)) best = { ep, lead }
    }
    if (best) {
      best.ep.precededEventId = e.id
      best.ep.leadDays = best.lead
      hits.push({ id: e.id, leadDays: best.lead })
    }
  }

  const falsePositives = episodes.filter((ep) => ep.precededEventId === null).length
  const spanDays = daysBetween(firstDay, lastDay)
  const decades = spanDays / 3652.5

  return {
    verdict: "scored",
    reason: null,
    coveredEventIds: covered.map((e) => e.id),
    uncoveredEventIds: uncovered.map((e) => e.id),
    hitEventIds: hits.map((h) => h.id),
    missedEventIds: covered.filter((e) => !hits.some((h) => h.id === e.id)).map((e) => e.id),
    hitRate: hits.length / covered.length,
    precision: episodes.length > 0 ? hits.length / episodes.length : null,
    medianLeadDays: median(hits.map((h) => h.leadDays)),
    falsePositives,
    falsePositivesPerDecade: decades > 0 ? Math.round((falsePositives / decades) * 10) / 10 : null,
    medianEpisodeDays: median(episodes.map((ep) => ep.days)),
    episodes,
    observedDays: obs.length,
  }
}

/**
 * Proposed weight for a signal, from its own record.
 *
 * CCPI_DESIGN.md §6 step 5: weight ∝ hit rate ÷ false-alarm rate, so a signal
 * that fires 4-for-4 with one false alarm outranks one that fires 4-for-4 with
 * nine. Returns null — never 0 — for anything unscored, so a caller cannot
 * quietly average an unproven signal in at zero.
 */
export function proposedWeight(r: LeadTimeResult): number | null {
  if (r.verdict !== "scored" || r.hitRate === null) return null
  // Hit rate ALONE ranked a signal that fires twice a year above one that fires
  // twice a decade, because firing constantly catches things by coincidence.
  // Multiplying by precision prices that in: a signal is worth its coverage
  // times its reliability, and a noisy one collapses however much it "caught".
  const precision = r.precision ?? 0
  return Math.round(r.hitRate * precision * 1000) / 1000
}

/**
 * Score the same signal across several lead windows.
 *
 * A window is not a neutral parameter — it encodes what counts as a usable
 * warning, and a signal documented to lead by 12-18 months CANNOT hit inside a
 * 180-day window however well it works. Testing one window and concluding is
 * the mistake; testing several and reading how precision moves is the
 * measurement. Curve inversion is the case in point: its own hypothesis claims
 * 12-18 months and the first run only ever asked it about six.
 */
export function sweepLeadWindows(
  observations: readonly SignalObservation[],
  events: readonly ReferenceEvent[],
  windows: readonly number[] = [90, 180, 365, 540],
  options: Omit<LeadTimeOptions, "maxLeadDays"> = {},
): Array<{ maxLeadDays: number; result: LeadTimeResult }> {
  return windows.map((maxLeadDays) => ({
    maxLeadDays,
    result: scoreLeadTime(observations, events, { ...options, maxLeadDays }),
  }))
}
