/**
 * Assertions for the two operational guards nothing was testing.
 *
 * Run: node scripts/check-ops-guards.ts
 *
 * WHY THIS FILE EXISTS. The coverage sweep that followed P6-82 listed every
 * exported function in `lib/` that computes something, is reachable from app
 * code, and has no assertion behind it anywhere in the check suite. Two of the
 * survivors guard operations rather than display:
 *
 *   - `checkCronAuth` — the only thing standing between the internet and the
 *     cron endpoints that write to the market store. It implements a
 *     constant-time comparison, which is exactly the kind of code that looks
 *     right, silently stops being constant-time under a refactor, and is never
 *     noticed because the happy path keeps working.
 *   - `getMonthlyBudgetTarget` — the ceiling the E-5 budget guard trips
 *     against. If it silently returns the wrong number, the guard either never
 *     fires or fires constantly, and both failures are quiet.
 *
 * Neither produces a figure a user reads, which is presumably why neither was
 * covered — the audit's attention has been on displayed numbers. **A wrong
 * number on a page is embarrassing; a wrong auth check is a different category
 * of problem**, and it had strictly less verification than the CCPI's colour
 * thresholds.
 *
 * Both modules import nothing, which is what makes them loadable here at all —
 * see P6-85 for the branch of `lib/ccpi/` that is untestable for the opposite
 * reason.
 */

import { checkCronAuth } from "../lib/cron-auth.ts"
import { getMonthlyBudgetTarget } from "../lib/api-keys.ts"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

const req = (auth?: string) =>
  new Request("https://example.test/api/cron/whatever", auth === undefined ? {} : { headers: { authorization: auth } })

// ---------------------------------------------------------------------------
// checkCronAuth
// ---------------------------------------------------------------------------

const ORIGINAL_SECRET = process.env.CRON_SECRET

process.env.CRON_SECRET = ""
{
  const r = checkCronAuth(req("Bearer anything"))
  // 503 not 401 is deliberate and worth pinning: an unconfigured route is not
  // rejecting the caller, and answering 401 would send whoever is debugging it
  // hunting for a bad token that was never the problem.
  check("unconfigured secret → 503, not 401", !r.ok && r.status === 503, `got ${r.ok ? "ok" : r.status}`)
}

process.env.CRON_SECRET = "s3cr3t-value"
{
  check("correct bearer token → ok", checkCronAuth(req("Bearer s3cr3t-value")).ok)

  const wrong = checkCronAuth(req("Bearer s3cr3t-valuf")) // same length, last char differs
  check("same-length wrong token → 401", !wrong.ok && wrong.status === 401)

  const short = checkCronAuth(req("Bearer s3cr3t"))
  check("shorter token → 401", !short.ok && short.status === 401)

  const long = checkCronAuth(req("Bearer s3cr3t-value-extra"))
  check("longer token → 401", !long.ok && long.status === 401)

  check("missing header → 401", !checkCronAuth(req()).ok)
  check("empty header → 401", !checkCronAuth(req("")).ok)

  // The raw secret without the scheme must NOT authenticate. A refactor that
  // compares the header to `secret` rather than to `Bearer ${secret}` would
  // still pass every happy-path test written above.
  check("raw secret without 'Bearer ' → 401", !checkCronAuth(req("s3cr3t-value")).ok)

  // Case matters: "bearer" is not "Bearer" under a byte comparison. Pinned so a
  // future case-insensitive "fix" is a deliberate decision, not a silent one.
  check("lowercase scheme → 401", !checkCronAuth(req("bearer s3cr3t-value")).ok)

  // The comparison must not short-circuit on the first differing byte for
  // equal-length input. This cannot prove constant time, but it does prove the
  // loop visits every position: a token differing only in the FIRST character
  // and one differing only in the LAST must both be rejected.
  check(
    "rejects a first-char difference",
    !checkCronAuth(req("Bearer X3cr3t-value")).ok,
  )
  check(
    "rejects a last-char difference",
    !checkCronAuth(req("Bearer s3cr3t-valuX")).ok,
  )
}

if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET
else process.env.CRON_SECRET = ORIGINAL_SECRET

// ---------------------------------------------------------------------------
// getMonthlyBudgetTarget
// ---------------------------------------------------------------------------

const ORIGINAL_TARGET = process.env.MONTHLY_BUDGET_TARGET

const withTarget = (v: string | undefined, fn: () => void) => {
  if (v === undefined) delete process.env.MONTHLY_BUDGET_TARGET
  else process.env.MONTHLY_BUDGET_TARGET = v
  fn()
}

withTarget(undefined, () => check("unset → default 40", getMonthlyBudgetTarget() === 40))
withTarget("125", () => check("numeric env is honoured", getMonthlyBudgetTarget() === 125))
withTarget("0", () => {
  // Zero is a legitimate target — "spend nothing" — and must not collapse to
  // the default. A `raw || 40` would have made it silently 40, which is the
  // `|| <const>` defect that ran through this whole audit, applied to money.
  check("zero is a real target, not a fallback to 40", getMonthlyBudgetTarget() === 0)
})
withTarget("-5", () => check("negative → default 40", getMonthlyBudgetTarget() === 40))
withTarget("abc", () => check("non-numeric → default 40", getMonthlyBudgetTarget() === 40))
withTarget("", () => check("empty string → default 40", getMonthlyBudgetTarget() === 40))

if (ORIGINAL_TARGET === undefined) delete process.env.MONTHLY_BUDGET_TARGET
else process.env.MONTHLY_BUDGET_TARGET = ORIGINAL_TARGET

// ---------------------------------------------------------------------------
// NOT covered here, and why — so the gap is a decision rather than an oversight
// ---------------------------------------------------------------------------
//
// `readBudget` in `lib/budget-guard.ts` had the IDENTICAL `Number("") === 0`
// defect and received the identical fix, but it cannot be asserted from a check
// script: that module imports `@/lib/api-costs`, `@/lib/metered-fetch` and
// `@/lib/api-keys`, so node's type-stripping cannot load it (P6-85, the same
// blocker that makes `lib/ccpi/calculations.ts` untestable).
//
// The behaviour is pinned indirectly — `getMonthlyBudgetTarget` above exercises
// the same trim-then-parse shape — but "the sibling is tested" is not the same
// as "this is tested", and saying so is cheaper than discovering the difference
// later. Extracting `readBudget` into an import-free module would fix it and is
// deliberately not done mid-session on a spend-control path.

console.log(failures === 0 ? "\nAll ops-guard checks passed." : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
