// VIX term-structure maths — pure, I/O-free, and DELIBERATELY IMPORT-FREE.
//
// Split out of lib/vix-term-structure.ts (E-7c). That module gained imports
// when it became store-first, and `node scripts/check-ccpi-scoring.ts` loads
// its dependencies with native type stripping, where `@/lib/...` aliases do
// not resolve — so the whole formulas suite died at the CCPI checks. The rule
// is the same one written at the top of lib/ccpi/scoring.ts: anything a check
// script pulls in has to stay dependency-free.
//
// RATIO convention: termStructure = VIX3M / spot VIX.
//   > 1  contango (normal; 3-month vol priced above spot vol)
//   < 1  backwardation (near-term fear priced above 3-month vol) = crash signal

/** Long-run normal contango ratio, used only on the baseline path. */
export const BASELINE_RATIO = 1.08
export const BASELINE_SPOT = 18

/** Pure helper so the ratio/inversion rule is unit-testable without I/O. */
export function computeTermStructure(spotVIX: number, vix3m: number): { termStructure: number; isInverted: boolean } {
  if (!(spotVIX > 0) || !(vix3m > 0)) {
    return { termStructure: BASELINE_RATIO, isInverted: false }
  }
  const termStructure = vix3m / spotVIX
  return { termStructure, isInverted: termStructure < 1 }
}
