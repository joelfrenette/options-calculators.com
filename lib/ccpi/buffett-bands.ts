/**
 * The Buffett Indicator's scoring ladder — the ONLY place a Buffett reading
 * becomes points or a canary severity.
 *
 * WHY THIS FILE EXISTS. Owner decision 2026-08-14 (CCPI_DESIGN §8b, option a):
 * adopt the FRED nonfinancial-corporate-equities basis and retire the
 * GuruFocus/ScrapingBee scrape for this input. Moving the ladder meant moving
 * it in FOUR places — `scoring.ts`, the `canaries.ts` severity thresholds,
 * `scripts/check-buffett-indicator.ts`'s local copy, and the UI marker's
 * `(v - 80) / 1.6` axis. That is the P7-77 shape exactly: a threshold change is
 * half a change until every independent ladder reading the same number moves
 * with it. All four now read this module.
 *
 * IMPORT-FREE, and imported with an explicit `.ts` extension by its consumers.
 * P7-67 established that check scripts load `lib/ccpi/*` under plain `node`,
 * which cannot resolve an EXTENSIONLESS relative TypeScript import; P7-82
 * established that an explicit `.ts` one resolves fine and that
 * `allowImportingTsExtensions` lets the bundler build it. So this file may be
 * imported, and may itself import nothing.
 *
 * ── THE BANDS, AND WHERE THEY CAME FROM ──────────────────────────────────────
 * Derived from the FRED series' own 225-quarter history (1970-Q1 → 2026-Q1),
 * percentile-matched to the modern era (1995+, n=125):
 *
 *   >210  p95   (210.7)     16 pts
 *   >195  ~p90  (198.0)     13
 *   >150  ~p75  (150.8)      9
 *   >120  ~p50  (120.8)      5
 *
 * The lower two rungs coincide with the retired total-market-cap ladder; only
 * the top two moved (200→210, 180→195). `scripts/analysis-buffett-bands.mjs`
 * recomputes every number from two keyless public FRED downloads.
 *
 * ── WHAT THE READER IS OWED ──────────────────────────────────────────────────
 * This ladder is calibrated for ONE basis and is wrong for the other. On
 * 2026-08-14 the FRED basis read 218.1 and the scraped total-market-cap figure
 * read 183.8 — the same week, 34 points apart, because they measure different
 * things. Feeding a total-market-cap reading into these cutoffs understates it;
 * feeding this basis into the old ones overstated it. `BUFFETT_BASIS` names
 * which one these numbers are for, so a future source swap has to confront it.
 *
 * Lead-time record on this basis, stated because a scored indicator should
 * carry its own record: >210 first fired 2021-Q2, three quarters before the
 * 2022 bear. It did not fire before 2000, 2008 or 2020 — on this basis the
 * dot-com top only reached 162.6, because nonfinancial corporate equities were
 * not where that bubble's capitalisation sat. One episode in four.
 */

/** The measurement these cutoffs are calibrated for. Not interchangeable. */
export const BUFFETT_BASIS = "nonfinancial-corporate-equities" as const

/** Cutoff (exclusive) → points, highest first. The single source of the ladder. */
export const BUFFETT_BANDS: ReadonlyArray<{ above: number; points: number }> = [
  { above: 210, points: 16 },
  { above: 195, points: 13 },
  { above: 150, points: 9 },
  { above: 120, points: 5 },
]

/** Full marks for this indicator — the top band's points. */
export const BUFFETT_MAX = 16

/**
 * Points for a reading, or NULL when there is no reading.
 *
 * Null in, null out (P6-34): an absent Buffett Indicator scores nothing and is
 * excluded from the pillar, rather than scoring zero — zero is a real reading
 * on this scale and would mean "cheap", which is the opposite of "unknown".
 */
export function scoreBuffett(percent: number | null): number | null {
  if (percent === null || !Number.isFinite(percent)) return null
  for (const band of BUFFETT_BANDS) {
    if (percent > band.above) return band.points
  }
  return 0
}

/**
 * Canary severity for a reading, or null for no canary.
 *
 * Tied to the same cutoffs rather than carrying its own pair: the canary that
 * says "significantly overvalued" and the score that awards full marks must
 * agree about where that is. Before this module they were 200/150 and 200/180
 * respectively — two ladders, already disagreeing at the middle rung.
 */
export function buffettCanarySeverity(percent: number | null): "high" | "medium" | null {
  if (percent === null || !Number.isFinite(percent)) return null
  if (percent > BUFFETT_BANDS[0].above) return "high"
  if (percent > BUFFETT_BANDS[2].above) return "medium"
  return null
}

/**
 * Where a reading sits on the UI's horizontal marker, 0-100.
 *
 * The bar previously hardcoded `(v - 80) / 1.6`, i.e. an 80-240 axis, chosen
 * for the old ladder and left behind when the bands moved. Deriving it from
 * the bands means the marker cannot silently describe a different scale than
 * the one being scored.
 */
const BUFFETT_AXIS_MIN = 80
const BUFFETT_AXIS_MAX = 240

export function buffettMarkerPercent(percent: number): number {
  const span = BUFFETT_AXIS_MAX - BUFFETT_AXIS_MIN
  return Math.min(100, Math.max(0, ((percent - BUFFETT_AXIS_MIN) / span) * 100))
}
