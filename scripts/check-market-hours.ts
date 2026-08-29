/**
 * The market-session clock decides whether a scanner run is allowed, so a sign
 * error or a mishandled DST offset would either block trading-hours scans or
 * wave through the after-hours zeros the gate exists to stop. Worked instants,
 * not shapes.
 *
 * Run: node scripts/check-market-hours.ts
 */

import { getMarketStatus, formatCountdown } from "../lib/market-hours.ts"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

const at = (iso: string) => new Date(iso)
const etWeekday = (ms: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }).format(new Date(ms))

// Monday 2026-08-31, EDT (−4). 14:00Z = 10:00 ET → mid-session.
check("a weekday 10:00 ET is open", getMarketStatus(at("2026-08-31T14:00:00Z")).isOpen === true)
check("open status has msUntilOpen 0", getMarketStatus(at("2026-08-31T14:00:00Z")).msUntilOpen === 0)

// 12:00Z = 08:00 ET, before the 9:30 open.
{
  const s = getMarketStatus(at("2026-08-31T12:00:00Z"))
  check("08:00 ET is pre-market, not open", !s.isOpen && s.phase === "pre", s.phase)
  check("pre-market opens the SAME day", etWeekday(s.nextOpen) === "Monday", etWeekday(s.nextOpen))
}

// 21:00Z = 17:00 ET, after the 16:00 close.
{
  const s = getMarketStatus(at("2026-08-31T21:00:00Z"))
  check("17:00 ET is after-hours, not open", !s.isOpen && s.phase === "after", s.phase)
  check("after-hours Monday opens Tuesday", etWeekday(s.nextOpen) === "Tuesday", etWeekday(s.nextOpen))
}

// Saturday 2026-08-29.
{
  const s = getMarketStatus(at("2026-08-29T16:00:00Z"))
  check("Saturday is weekend-closed", !s.isOpen && s.phase === "weekend", s.phase)
  check("the weekend opens Monday", etWeekday(s.nextOpen) === "Monday", etWeekday(s.nextOpen))
}

// Friday after-hours must skip the weekend to Monday.
{
  const s = getMarketStatus(at("2026-08-28T21:00:00Z")) // 17:00 ET Fri
  check("Friday after-hours next-opens Monday, not Saturday", etWeekday(s.nextOpen) === "Monday", etWeekday(s.nextOpen))
}

// Christmas 2026-12-25 (Fri), EST (−5). 15:00Z = 10:00 ET: a weekday, in-hours, but a holiday.
{
  const s = getMarketStatus(at("2026-12-25T15:00:00Z"))
  check("a holiday in trading hours is still closed", !s.isOpen && s.phase === "holiday", s.phase)
  check("the holiday names itself", s.reason === "Christmas Day", s.reason)
  check("Christmas (Fri) next-opens the following week", etWeekday(s.nextOpen) === "Monday", etWeekday(s.nextOpen))
}

// Countdown breakdown.
{
  const c = formatCountdown(90_061_000) // 1d 1h 1m 1s
  check(
    "countdown splits ms into d/h/m/s",
    c.days === 1 && c.hours === 1 && c.minutes === 1 && c.seconds === 1,
    JSON.stringify(c),
  )
  check("a negative countdown floors at zero", formatCountdown(-5000).seconds === 0)
}

if (failures > 0) {
  console.error(`\n${failures} market-hours check(s) failed.`)
  process.exit(1)
}
