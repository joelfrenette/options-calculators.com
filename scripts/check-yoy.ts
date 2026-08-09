/**
 * Year-over-year alignment checks — lib/fred-store.ts `yoyTrend`.
 *
 * Run: node scripts/check-yoy.ts
 *
 * WHY THIS EXISTS. Monthly FRED series are not guaranteed to be contiguous:
 * CPIAUCSL and CPILFESL have no 2025-10 observation, because that release was
 * never published. Every YoY implementation on this site used to count back
 * twelve ROWS, which around a gap silently measures a 13-month span and labels
 * it year-over-year. FRED also returns gap months as "." placeholders, so a
 * fixed-size request came back one value short and the caller fell through to
 * a hardcoded inflation constant — an invented number presented as live data.
 *
 * These checks pin the fix: alignment is BY DATE, and a missing base month
 * yields null rather than a mismeasured number.
 */

import { yoyTrend } from "../lib/yoy.ts"

let failures = 0
function check(name: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`)
  } else {
    failures++
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

/** Newest-first monthly rows, value = 100 * (1 + rate)^monthsFromStart. */
function monthly(startYear: number, startMonth: number, count: number, values: number[]) {
  const rows: { day: string; value: number }[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(startYear, startMonth - 1 + i, 1))
    rows.push({
      day: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`,
      value: values[i],
    })
  }
  return rows.reverse() // newest first
}

// ---------------------------------------------------------------------------
// 1. Contiguous series: a clean 10% year-over-year rise.
// ---------------------------------------------------------------------------
const flat = monthly(2025, 1, 14, [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 110, 110])
const flatRes = yoyTrend(flat)
check("contiguous series: latest YoY = +10%", flatRes !== null && Math.abs(flatRes.current - 10) < 1e-9,
  flatRes ? `${flatRes.current}%` : "null")
check("contiguous series: previous YoY = +10%", flatRes !== null && Math.abs(flatRes.previous - 10) < 1e-9,
  flatRes ? `${flatRes.previous}%` : "null")
check("equal current/previous ⇒ stable", flatRes?.trend === "stable", flatRes?.trend ?? "null")

// ---------------------------------------------------------------------------
// 2. THE REGRESSION. Real CPI shape: 2025-10 missing. Row-offset arithmetic
//    reaches past the gap and compares the wrong months; date alignment does
//    not. Base year values differ per month so a wrong pairing cannot
//    accidentally produce the right answer.
// ---------------------------------------------------------------------------
const withGap = [
  { day: "2026-06-01", value: 332.568 },
  { day: "2026-05-01", value: 333.979 },
  { day: "2026-04-01", value: 332.407 },
  { day: "2026-03-01", value: 331.0 },
  { day: "2026-02-01", value: 330.0 },
  { day: "2026-01-01", value: 329.0 },
  { day: "2025-12-01", value: 328.0 },
  { day: "2025-11-01", value: 327.0 },
  // 2025-10-01 absent — never published
  { day: "2025-09-01", value: 325.0 },
  { day: "2025-08-01", value: 324.0 },
  { day: "2025-07-01", value: 323.0 },
  { day: "2025-06-01", value: 320.62 },
  { day: "2025-05-01", value: 320.4 },
  { day: "2025-04-01", value: 319.0 },
]
const gapRes = yoyTrend(withGap)
const expectedCurrent = Number((((332.568 - 320.62) / 320.62) * 100).toFixed(2)) // Jun-26 vs Jun-25
const expectedPrevious = Number((((333.979 - 320.4) / 320.4) * 100).toFixed(2)) // May-26 vs May-25
check(
  "gap month: current pairs Jun-2026 with Jun-2025",
  gapRes !== null && gapRes.current === expectedCurrent,
  gapRes ? `${gapRes.current}% (want ${expectedCurrent}%)` : "null",
)
check(
  "gap month: previous pairs May-2026 with May-2025",
  gapRes !== null && gapRes.previous === expectedPrevious,
  gapRes ? `${gapRes.previous}% (want ${expectedPrevious}%)` : "null",
)

// The old row-offset result, kept as the counter-example: with the gap present,
// index 12 is May-2025 rather than Jun-2025, so it measures a 13-month span.
const rowOffsetCurrent = Number((((withGap[0].value - withGap[12].value) / withGap[12].value) * 100).toFixed(2))
check(
  "row-offset arithmetic disagrees with date alignment across a gap",
  rowOffsetCurrent !== expectedCurrent,
  `row-offset ${rowOffsetCurrent}% vs date-aligned ${expectedCurrent}%`,
)

// ---------------------------------------------------------------------------
// 3. Missing base month ⇒ null, never a substituted or approximated figure.
// ---------------------------------------------------------------------------
const shortHistory = [
  { day: "2026-06-01", value: 332.568 },
  { day: "2026-05-01", value: 333.979 },
  { day: "2026-04-01", value: 332.407 },
]
check("no base month 12 months back → null", yoyTrend(shortHistory) === null)
check("single observation → null", yoyTrend([{ day: "2026-06-01", value: 332.568 }]) === null)
check("empty input → null", yoyTrend([]) === null)

// A base month present but zero would divide by zero — null, not Infinity.
const zeroBase = [
  { day: "2026-06-01", value: 100 },
  { day: "2026-05-01", value: 100 },
  { day: "2025-06-01", value: 0 },
  { day: "2025-05-01", value: 0 },
]
check("zero base value → null (no Infinity)", yoyTrend(zeroBase) === null)

// ---------------------------------------------------------------------------
// 4. Trend direction reflects accelerating vs decelerating change.
// ---------------------------------------------------------------------------
const accelerating = [
  { day: "2026-06-01", value: 110 }, // +10% vs Jun-25
  { day: "2026-05-01", value: 105 }, // +5%  vs May-25
  { day: "2025-06-01", value: 100 },
  { day: "2025-05-01", value: 100 },
]
check("rising YoY ⇒ trend up", yoyTrend(accelerating)?.trend === "up", yoyTrend(accelerating)?.trend ?? "null")

const decelerating = [
  { day: "2026-06-01", value: 103 },
  { day: "2026-05-01", value: 108 },
  { day: "2025-06-01", value: 100 },
  { day: "2025-05-01", value: 100 },
]
check("falling YoY ⇒ trend down", yoyTrend(decelerating)?.trend === "down", yoyTrend(decelerating)?.trend ?? "null")

// ---------------------------------------------------------------------------
// 5. Year boundary: December pairs with the previous December.
// ---------------------------------------------------------------------------
const yearBoundary = [
  { day: "2026-01-01", value: 110 },
  { day: "2025-12-01", value: 104 },
  { day: "2025-01-01", value: 100 },
  { day: "2024-12-01", value: 100 },
]
const yb = yoyTrend(yearBoundary)
check("crosses the year boundary correctly", yb !== null && yb.current === 10 && yb.previous === 4,
  yb ? `current ${yb.current}%, previous ${yb.previous}%` : "null")

console.log(failures === 0 ? "\nAll YoY alignment checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
