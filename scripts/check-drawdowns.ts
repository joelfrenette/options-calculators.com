/**
 * Reference-drawdown checks — lib/ccpi/drawdowns.ts.
 *
 * Run: node scripts/check-drawdowns.ts
 *
 * WHAT THIS CAN AND CANNOT VERIFY. The dates and closes are recorded from
 * reference knowledge, because the site holds 131 days of index history. Nothing
 * here can confirm that the 2007 peak really was 1565.15 — only that the table
 * is internally consistent and that the derived percentages match the closes
 * they claim to come from. That still catches the realistic failure: a typo or a
 * transposed date silently shifting an event by months and making every lead
 * time measured against it wrong.
 *
 * When ~25 years of index history is stored, RE-DERIVE the table from it and
 * treat any disagreement as this file being wrong.
 */

import {
  BEAR_MARKETS,
  CORRECTIONS,
  REFERENCE_DRAWDOWNS,
  drawdownsCoveredBy,
  daysBetween,
} from "../lib/ccpi/drawdowns.ts"

let failures = 0
function check(name: string, passed: boolean, detail = "") {
  if (passed) {
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`)
  } else {
    failures++
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

// ---------------------------------------------------------------------------
// 1. Arithmetic: every declinePct must follow from its own two closes.
// ---------------------------------------------------------------------------
for (const d of REFERENCE_DRAWDOWNS) {
  const derived = ((d.troughClose - d.peakClose) / d.peakClose) * 100
  check(
    `${d.id}: declinePct matches its closes`,
    Math.abs(derived - d.declinePct) < 0.02,
    `stated ${d.declinePct}, derived ${derived.toFixed(2)}`,
  )
}

// ---------------------------------------------------------------------------
// 2. Ordering and sign — a transposed date is the realistic typo.
// ---------------------------------------------------------------------------
for (const d of REFERENCE_DRAWDOWNS) {
  check(`${d.id}: trough falls after peak`, d.peak < d.trough, `${d.peak} → ${d.trough}`)
  check(`${d.id}: trough close is below peak close`, d.troughClose < d.peakClose)
  check(`${d.id}: decline is negative`, d.declinePct < 0)
}

// ---------------------------------------------------------------------------
// 3. Severity bands must match the arithmetic, not the label.
// ---------------------------------------------------------------------------
for (const d of BEAR_MARKETS) {
  check(`${d.id}: a bear market falls at least 20%`, d.declinePct <= -20, `${d.declinePct}%`)
}
for (const d of CORRECTIONS) {
  check(
    `${d.id}: a correction falls 10-20%`,
    d.declinePct <= -10 && d.declinePct > -20,
    `${d.declinePct}%`,
  )
}

// ---------------------------------------------------------------------------
// 4. Set integrity.
// ---------------------------------------------------------------------------
const ids = REFERENCE_DRAWDOWNS.map((d) => d.id)
check("ids are unique", new Set(ids).size === ids.length)
check(
  "the combined list is sorted oldest first",
  REFERENCE_DRAWDOWNS.every((d, i) => i === 0 || REFERENCE_DRAWDOWNS[i - 1].peak <= d.peak),
)
check("four bear markets", BEAR_MARKETS.length === 4, String(BEAR_MARKETS.length))
check(
  "corrections outnumber bear markets — they carry the false-positive statistics",
  CORRECTIONS.length > BEAR_MARKETS.length,
  `${CORRECTIONS.length} vs ${BEAR_MARKETS.length}`,
)

// No two events may overlap: one drawdown's trough must precede the next peak.
for (let i = 1; i < REFERENCE_DRAWDOWNS.length; i++) {
  const prev = REFERENCE_DRAWDOWNS[i - 1]
  const cur = REFERENCE_DRAWDOWNS[i]
  check(
    `${prev.id} ends before ${cur.id} begins`,
    prev.trough < cur.peak,
    `${prev.trough} → ${cur.peak}`,
  )
}

// ---------------------------------------------------------------------------
// 5. Coverage gate — the guard against scoring events we have no data for.
// ---------------------------------------------------------------------------
check(
  "131 days of history covers NOTHING — the current state, stated honestly",
  drawdownsCoveredBy("2026-03-01").length === 0,
  `${drawdownsCoveredBy("2026-03-01").length} covered`,
)
check(
  "9,000 days (~2001) covers everything except the dot-com peak",
  drawdownsCoveredBy("2001-01-01").length === REFERENCE_DRAWDOWNS.length - 2,
  `${drawdownsCoveredBy("2001-01-01").length} of ${REFERENCE_DRAWDOWNS.length}`,
)
check(
  "...and specifically excludes dot-com and LTCM",
  drawdownsCoveredBy("2001-01-01").every((d) => d.id !== "dotcom-2000" && d.id !== "ltcm-1998"),
)
check(
  "a 1990 start covers all of them",
  drawdownsCoveredBy("1990-01-01").length === REFERENCE_DRAWDOWNS.length,
)

// ---------------------------------------------------------------------------
// 6. daysBetween — the primitive every lead-time measurement will use.
// ---------------------------------------------------------------------------
check("daysBetween counts forward", daysBetween("2020-02-19", "2020-03-23") === 33)
check("daysBetween is negative backwards", daysBetween("2020-03-23", "2020-02-19") === -33)
check("daysBetween handles a leap day", daysBetween("2020-02-28", "2020-03-01") === 2)
check("daysBetween on rubbish is NaN, not 0", Number.isNaN(daysBetween("not-a-date", "2020-01-01")))

console.log(failures === 0 ? "\nAll reference-drawdown checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
