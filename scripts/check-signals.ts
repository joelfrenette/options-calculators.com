/**
 * Signal-definition checks — lib/ccpi/signals.ts.
 *
 * Run: node scripts/check-signals.ts
 *
 * WHY THIS EXISTS. This module is where a stored level becomes a claim about
 * the market, so every arbitrary number in the redesign lives here. The checks
 * below do not validate the thresholds — those are hypotheses and only the
 * walk-forward backtest can judge them. They validate the things that must hold
 * whatever the thresholds are: missing data never fires, a ratio is never taken
 * across two different days, and a velocity signal is null before its lookback
 * is satisfied rather than quietly reporting "no".
 */

import { SIGNALS, evaluableSignals, type SeriesPoint } from "../lib/ccpi/signals.ts"

let failures = 0
function check(name: string, passed: boolean, detail = "") {
  if (passed) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`)
  else { failures++; console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`) }
}

function days(from: string, n: number, value: (i: number) => number): SeriesPoint[] {
  const out: SeriesPoint[] = []
  for (let i = 0; i < n; i++) {
    out.push({ day: new Date(Date.parse(from + "T00:00:00Z") + i * 86400000).toISOString().slice(0, 10), value: value(i) })
  }
  return out
}
const byId = (id: string) => SIGNALS.find((s) => s.id === id)!

// ---------------------------------------------------------------------------
// 1. Registry integrity.
// ---------------------------------------------------------------------------
check("signal ids are unique", new Set(SIGNALS.map((s) => s.id)).size === SIGNALS.length)
check("every signal states what firing means", SIGNALS.every((s) => s.meaning.length > 10))
check("every signal records its hypothesis, so it cannot be mistaken for a result", SIGNALS.every((s) => s.hypothesis.length > 20))
check("every signal declares the series it needs", SIGNALS.every((s) => s.requires.length > 0))

check(
  "a signal whose series are missing is not evaluable",
  evaluableSignals(["T10Y3M"]).every((s) => s.id === "curve-10y3m-inverted"),
)
check("no stored series means no evaluable signals", evaluableSignals([]).length === 0)
check(
  "the VIX ratio needs BOTH legs",
  evaluableSignals(["VIXCLS"]).some((s) => s.id === "vix-backwardation") === false,
)

// ---------------------------------------------------------------------------
// 2. Level signals: the direction must be the stated one.
// ---------------------------------------------------------------------------
const curve = byId("curve-10y3m-inverted")
const inverted = curve.evaluate({ T10Y3M: [{ day: "2020-01-02", value: -0.25 }] })
check("a negative 10Y-3M spread fires", inverted[0].firing === true)
const normal = curve.evaluate({ T10Y3M: [{ day: "2026-08-07", value: 0.78 }] })
check("today's +0.78 does NOT fire", normal[0].firing === false, "0.78")
check("exactly zero is not inverted", curve.evaluate({ T10Y3M: [{ day: "2020-01-02", value: 0 }] })[0].firing === false)

const nfci = byId("nfci-tightening")
check("NFCI −0.529 (today) does not fire", nfci.evaluate({ NFCI: [{ day: "2026-07-31", value: -0.529 }] })[0].firing === false)
check("NFCI +0.3 fires", nfci.evaluate({ NFCI: [{ day: "2008-10-03", value: 0.3 }] })[0].firing === true)

// ---------------------------------------------------------------------------
// 3. MISSING DATA NEVER FIRES — and is never reported as quiet.
// ---------------------------------------------------------------------------
check("NaN is null, not false", curve.evaluate({ T10Y3M: [{ day: "2020-01-02", value: Number.NaN }] })[0].firing === null)
check("an absent series yields no observations at all", curve.evaluate({}).length === 0)

// ---------------------------------------------------------------------------
// 4. Velocity: null before the lookback is satisfied.
// ---------------------------------------------------------------------------
const hy = byId("hy-spread-widening")
const flat = hy.evaluate({ BAMLH0A0HYM2: days("2020-01-01", 40, () => 3.0) })
check("velocity is null while the lookback is unsatisfied", flat[0].firing === null)
check("...and false once satisfied on a flat series", flat[39].firing === false, String(flat[39].firing))

const widening = hy.evaluate({ BAMLH0A0HYM2: days("2020-01-01", 40, (i) => 3.0 + i * 0.05) })
check("a 5bp/day widening fires once the lookback is satisfied", widening[39].firing === true)
check(
  "...and a NARROWING series of the same magnitude does not",
  hy.evaluate({ BAMLH0A0HYM2: days("2020-01-01", 40, (i) => 5.0 - i * 0.05) })[39].firing === false,
)

// ---------------------------------------------------------------------------
// 5. Ratios are never taken across two different days.
//    This is the S-11 defect (two dates paired as one reading) generalised.
// ---------------------------------------------------------------------------
const vix = byId("vix-backwardation")
const paired = vix.evaluate({
  VXVCLS: [{ day: "2020-03-16", value: 60 }],
  VIXCLS: [{ day: "2020-03-16", value: 82 }],
})
check("a same-day pair evaluates", paired[0].firing === true, "3M 60 < spot 82")
const mismatched = vix.evaluate({
  VXVCLS: [{ day: "2020-03-16", value: 60 }],
  VIXCLS: [{ day: "2020-03-13", value: 82 }],
})
check("a MISMATCHED pair is null, never a reading", mismatched[0].firing === null)
check(
  "a zero denominator is null, not Infinity",
  vix.evaluate({ VXVCLS: [{ day: "2020-03-16", value: 60 }], VIXCLS: [{ day: "2020-03-16", value: 0 }] })[0].firing === null,
)
check(
  "contango does not fire",
  vix.evaluate({ VXVCLS: [{ day: "2026-08-06", value: 18 }], VIXCLS: [{ day: "2026-08-06", value: 15.15 }] })[0].firing === false,
)

console.log(failures === 0 ? "\nAll signal checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
