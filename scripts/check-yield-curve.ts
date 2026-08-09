/**
 * Yield-curve orientation checks — lib/yield-curve.ts.
 *
 * Run: node scripts/check-yield-curve.ts
 *
 * WHY THIS EXISTS. /api/fomc-predictions computed its spread as 2Y − 10Y but
 * tested `spread < 0` for inversion, a test that is only correct for the
 * 10Y − 2Y orientation. On live staging data (2Y 4.25, 10Y 4.69 — a normal
 * curve) the Fed tab rendered "Inverted (Recession Signal)" with a bearish
 * badge. Sign conventions are exactly the kind of thing that looks right in
 * review and is wrong in production, so the real numbers are pinned here.
 */

import { readYieldCurve } from "../lib/yield-curve.ts"

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
// 1. THE REGRESSION: the exact staging figures that were mislabelled.
// ---------------------------------------------------------------------------
const real = readYieldCurve(4.69, 4.25)
check("staging figures (2Y 4.25, 10Y 4.69) are NOT inverted", real !== null && real.inverted === false)
check("staging figures label as Normal", real?.label === "Normal", real?.label ?? "null")
check("staging figures signal neutral", real?.signal === "neutral", real?.signal ?? "null")
check("spread is 10Y − 2Y and positive", real !== null && Math.abs(real.spread - 0.44) < 1e-9, `${real?.spread}`)

// ---------------------------------------------------------------------------
// 2. A genuine inversion must still be caught — the check that matters most,
//    since this is the recession signal the tab exists to surface.
// ---------------------------------------------------------------------------
const inverted = readYieldCurve(4.0, 4.6) // 2Y above 10Y
check("2Y above 10Y is inverted", inverted?.inverted === true)
check("inversion labels as recession signal", inverted?.label === "Inverted (Recession Signal)", inverted?.label ?? "null")
check("inversion signals bearish", inverted?.signal === "bearish", inverted?.signal ?? "null")
check("inverted spread is negative", inverted !== null && inverted.spread < 0, `${inverted?.spread}`)

// ---------------------------------------------------------------------------
// 3. Flat band. Flat is not inverted, and must not carry the bearish signal.
// ---------------------------------------------------------------------------
const flat = readYieldCurve(4.15, 4.05)
check("a 10bp gap reads as flat", flat?.flat === true && flat?.label === "Flat", flat?.label ?? "null")
check("flat is not inverted", flat?.inverted === false)
check("flat signals neutral, not bearish", flat?.signal === "neutral", flat?.signal ?? "null")

const clearlyNormal = readYieldCurve(4.8, 4.0)
check("an 80bp gap is Normal, not Flat", clearlyNormal?.label === "Normal", clearlyNormal?.label ?? "null")

// Exactly zero is the boundary: not inverted, but flat.
const zero = readYieldCurve(4.2, 4.2)
check("zero spread is flat and not inverted", zero?.inverted === false && zero?.flat === true)

// ---------------------------------------------------------------------------
// 4. Missing legs assert nothing.
// ---------------------------------------------------------------------------
check("missing 2Y → null", readYieldCurve(4.69, null) === null)
check("missing 10Y → null", readYieldCurve(null, 4.25) === null)
check("both missing → null", readYieldCurve(null, null) === null)
check("NaN leg → null", readYieldCurve(Number.NaN, 4.25) === null)

console.log(failures === 0 ? "\nAll yield-curve checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
