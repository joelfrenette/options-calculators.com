// US equity/options regular-session clock (NYSE / Cboe), in Eastern Time.
//
// WHY THIS EXISTS. The scanners depend on LIVE option quotes and a live trend
// feed. Outside the regular session the data provider returns nothing, so a
// scan run after hours burns API budget (and the user's patience) only to end
// in "No options with valid pricing data" — a guaranteed zero that looks like a
// bug. This module is the single source of truth for "is the market open right
// now, and when does it next open", so the scanner surfaces can BLOCK a run and
// show a countdown instead of firing doomed calls.
//
// Pure and dependency-free: it runs in the browser (the banner's live
// countdown) and on the server (a route can refuse a closed-market scan). Time
// comes from the caller's clock converted to ET via Intl — good to the minute,
// which is all a session gate needs; it is NOT a trade-execution clock.

export type MarketPhase = "open" | "pre" | "after" | "weekend" | "holiday"

export interface MarketStatus {
  /** True only during the regular 9:30–16:00 ET session on a trading day. */
  isOpen: boolean
  phase: MarketPhase
  /** Epoch ms of the next regular open. Equals now-ish when already open. */
  nextOpen: number
  /** ms from `now` until the next open (0 when open). */
  msUntilOpen: number
  /** Human label for the closed reason, e.g. "the weekend" / "Independence Day". */
  reason: string
}

const OPEN_MINUTES = 9 * 60 + 30 // 09:30 ET
const CLOSE_MINUTES = 16 * 60 // 16:00 ET

// NYSE/Cboe full-day closures. Early-close days (1pm) are NOT listed — the
// market is still OPEN on those, just short, so a scan is fine. Update yearly;
// the map value is the holiday's display name.
//
// Verified against the NYSE 2026–2027 holiday calendar (observed dates).
const HOLIDAYS: Record<string, string> = {
  "2026-01-01": "New Year's Day",
  "2026-01-19": "Martin Luther King Jr. Day",
  "2026-02-16": "Presidents' Day",
  "2026-04-03": "Good Friday",
  "2026-05-25": "Memorial Day",
  "2026-06-19": "Juneteenth",
  "2026-07-03": "Independence Day (observed)",
  "2026-09-07": "Labor Day",
  "2026-11-26": "Thanksgiving Day",
  "2026-12-25": "Christmas Day",
  "2027-01-01": "New Year's Day",
  "2027-01-18": "Martin Luther King Jr. Day",
  "2027-02-15": "Presidents' Day",
  "2027-03-26": "Good Friday",
  "2027-05-31": "Memorial Day",
  "2027-06-18": "Juneteenth (observed)",
  "2027-07-05": "Independence Day (observed)",
  "2027-09-06": "Labor Day",
  "2027-11-25": "Thanksgiving Day",
  "2027-12-24": "Christmas Day (observed)",
}

interface EtParts {
  y: number
  mo: number // 1-12
  d: number
  minutes: number // minutes past ET midnight
  dow: number // 0=Sun … 6=Sat
  dateStr: string // YYYY-MM-DD
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** The wall-clock parts of an instant, as seen in Eastern Time. */
function etParts(date: Date): EtParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  const hour = g("hour") === "24" ? 0 : Number(g("hour")) // Intl can emit 24 for midnight
  return {
    y: Number(g("year")),
    mo: Number(g("month")),
    d: Number(g("day")),
    minutes: hour * 60 + Number(g("minute")),
    dow: WEEKDAY_INDEX[g("weekday")] ?? 0,
    dateStr: `${g("year")}-${g("month")}-${g("day")}`,
  }
}

const isTradingDay = (p: { dow: number; dateStr: string }): boolean =>
  p.dow >= 1 && p.dow <= 5 && !(p.dateStr in HOLIDAYS)

/**
 * The epoch ms for a given ET wall-clock (Y-M-D at `minutes` past midnight).
 * Guess in UTC, then correct by the ET offset observed at that guess — one
 * pass resolves EST/EDT for every instant except the ~1h DST fold, where a
 * session gate does not care.
 */
function etWallToEpoch(y: number, mo: number, d: number, minutes: number): number {
  const h = Math.floor(minutes / 60)
  const mi = minutes % 60
  const target = Date.UTC(y, mo - 1, d, h, mi, 0)
  const shown = etParts(new Date(target))
  const shownAsUtc = Date.UTC(shown.y, shown.mo - 1, shown.d, Math.floor(shown.minutes / 60), shown.minutes % 60, 0)
  return target + (target - shownAsUtc)
}

/** Add `n` calendar days to an ET date, returning fresh ET-date fields. */
function addEtDays(y: number, mo: number, d: number, n: number): { y: number; mo: number; d: number } {
  const base = etParts(new Date(etWallToEpoch(y, mo, d, 12 * 60) + n * 86_400_000))
  return { y: base.y, mo: base.mo, d: base.d }
}

/** The next regular-session open at or after `from`, as epoch ms. */
function nextOpenEpoch(from: Date): number {
  const p = etParts(from)
  // Today still qualifies if it is a trading day and we are before the open.
  if (isTradingDay(p) && p.minutes < OPEN_MINUTES) {
    return etWallToEpoch(p.y, p.mo, p.d, OPEN_MINUTES)
  }
  // Otherwise walk forward to the next trading day (cap the loop defensively).
  let cur = { y: p.y, mo: p.mo, d: p.d }
  for (let i = 0; i < 10; i++) {
    cur = addEtDays(cur.y, cur.mo, cur.d, 1)
    const dateStr = `${String(cur.y).padStart(4, "0")}-${String(cur.mo).padStart(2, "0")}-${String(cur.d).padStart(2, "0")}`
    const dow = etParts(new Date(etWallToEpoch(cur.y, cur.mo, cur.d, 12 * 60))).dow
    if (isTradingDay({ dow, dateStr })) return etWallToEpoch(cur.y, cur.mo, cur.d, OPEN_MINUTES)
  }
  // Unreachable in practice; fall back to +1 day open so the countdown never NaNs.
  return etWallToEpoch(p.y, p.mo, p.d, OPEN_MINUTES) + 86_400_000
}

/** The market's status at `now` (defaults to the caller's clock). */
export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const p = etParts(now)
  const holiday = HOLIDAYS[p.dateStr]
  const open = isTradingDay(p) && p.minutes >= OPEN_MINUTES && p.minutes < CLOSE_MINUTES

  let phase: MarketPhase
  let reason: string
  if (open) {
    phase = "open"
    reason = "open"
  } else if (holiday) {
    phase = "holiday"
    reason = holiday
  } else if (p.dow === 0 || p.dow === 6) {
    phase = "weekend"
    reason = "the weekend"
  } else if (p.minutes < OPEN_MINUTES) {
    phase = "pre"
    reason = "pre-market"
  } else {
    phase = "after"
    reason = "after-hours"
  }

  const nextOpen = open ? now.getTime() : nextOpenEpoch(now)
  return {
    isOpen: open,
    phase,
    nextOpen,
    msUntilOpen: open ? 0 : Math.max(0, nextOpen - now.getTime()),
    reason,
  }
}

/** "2d 4h 31m 12s" style breakdown for a countdown display. */
export function formatCountdown(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

/** "Monday 9:30 AM ET" — when the next session opens, for the banner subhead. */
export function nextOpenLabel(status: MarketStatus): string {
  const d = new Date(status.nextOpen)
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }).format(d)
  const today = getMarketStatus().phase
  const prefix = status.phase === "pre" || today === "pre" ? "today" : day
  return `${prefix} 9:30 AM ET`
}
