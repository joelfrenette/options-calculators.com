/**
 * Reading a money limit out of an environment variable. (Phase 7.0, P6-87)
 *
 * WHY IT LIVES IN ITS OWN FILE. `lib/budget-guard.ts` imports three
 * Supabase-touching modules, so no check script can load it — and this
 * function, the one that decides whether the site's paid data gets cut off, was
 * therefore unassertable. AUDIT_PLAN step 7.0 calls that out by name: the
 * import graph had been silently deciding what gets tested. This module is
 * import-free on purpose. Do not add imports.
 *
 * THE RULE, AND WHY IT IS NOT OBVIOUS. A budget of `0` is meaningful — "cut off
 * immediately" — so zero must be honoured when it is genuinely configured. But
 * `Number("")` is `0`, not `NaN`, so a variable that EXISTS WITH NO VALUE used
 * to read as a deliberate zero and killed every metered API on the first cent
 * of spend, with nothing on screen to explain it. Vercel produces exactly that
 * shape whenever a variable is created and left empty, which makes it the most
 * likely operator mistake rather than a hypothetical one.
 *
 * So: trim, treat blank as UNSET, and only then let zero mean zero.
 */

/**
 * @param raw the environment value, as `process.env[NAME]` returns it —
 *   `undefined` when unset, a string otherwise, possibly empty or whitespace.
 * @param fallback used when the value is absent, blank, unparseable or negative.
 * @returns the configured limit in dollars.
 */
export function resolveBudgetLimit(raw: string | undefined, fallback: number): number {
  const trimmed = raw?.trim()
  if (!trimmed) return fallback
  const n = Number(trimmed)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/** Default hard stops, overridable per environment. */
export const DEFAULT_DAILY_HARD_STOP = 50
export const DEFAULT_MONTHLY_HARD_STOP = 100

/**
 * The environment variable names, spelled once.
 *
 * They carry `_BUDGET_`, and that has been got wrong twice in the project's own
 * documentation — a handoff note and a backlog paragraph both shortened them to
 * `DAILY_HARD_STOP` / `MONTHLY_HARD_STOP`. An operator checking Vercel for a
 * variable that does not exist finds nothing, and "nothing" is indistinguishable
 * from "correctly unset", which is the one answer P6-86 needs to be sure about.
 */
export const BUDGET_ENV_NAMES = {
  dailyHardStop: "DAILY_BUDGET_HARD_STOP",
  monthlyHardStop: "MONTHLY_BUDGET_HARD_STOP",
  monthlyTarget: "MONTHLY_BUDGET_TARGET",
} as const
