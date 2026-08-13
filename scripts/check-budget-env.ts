/**
 * A blank budget variable means UNSET, never "cut off at zero". (P6-86/P6-87)
 *
 * Run: node scripts/check-budget-env.ts
 *
 * WHY THIS COULD NOT BE WRITTEN BEFORE. The rule lived in `lib/budget-guard.ts`,
 * which imports three Supabase-touching modules, so no check script could load
 * it. The single decision that can take every paid data source offline was
 * therefore unassertable — the exact situation AUDIT_PLAN step 7.0 exists to
 * end. Phase 7.0 moved it to `lib/budget-env.ts`, which is import-free.
 *
 * WHAT IS ACTUALLY AT STAKE. `Number("")` is `0`, not `NaN`. A variable that
 * exists with no value — the shape Vercel produces whenever someone creates one
 * and leaves it empty — used to read as a deliberate "cut off immediately" and
 * killed every metered API on the first cent of spend, with nothing on screen
 * to explain it. And a genuine `0` must still mean zero, so the fix cannot be
 * "treat falsy as unset".
 *
 * That is two adjacent behaviours that a single wrong `||` collapses into one,
 * which is why both are pinned here with worked values rather than described.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  BUDGET_ENV_NAMES,
  DEFAULT_DAILY_HARD_STOP,
  DEFAULT_MONTHLY_HARD_STOP,
  resolveBudgetLimit,
} from "../lib/budget-env.ts"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

const FALLBACK = 50

// ------------------------------------------------------- blank means unset

check(
  "an UNSET variable falls back",
  resolveBudgetLimit(undefined, FALLBACK) === FALLBACK,
  String(resolveBudgetLimit(undefined, FALLBACK)),
)
check(
  "an EMPTY variable falls back — this is the one that took the site offline",
  resolveBudgetLimit("", FALLBACK) === FALLBACK,
  `Number("") is 0, not NaN — got ${resolveBudgetLimit("", FALLBACK)}`,
)
check(
  "a WHITESPACE-ONLY variable falls back",
  resolveBudgetLimit("   ", FALLBACK) === FALLBACK,
  String(resolveBudgetLimit("   ", FALLBACK)),
)

// ------------------------------------------------------ zero still means zero

check(
  'a configured "0" IS honoured as zero',
  resolveBudgetLimit("0", FALLBACK) === 0,
  "cutting off immediately is a legitimate instruction and must survive the blank fix",
)
check(
  'a configured "0" with whitespace is still zero',
  resolveBudgetLimit(" 0 ", FALLBACK) === 0,
  String(resolveBudgetLimit(" 0 ", FALLBACK)),
)

// The two above are the pair. A `||`-based implementation passes the blank
// tests and fails this one; a `!== undefined` implementation passes this one
// and fails the blank tests. Asserting both is what makes the pair a rule.
check(
  "blank and zero are DISTINGUISHED, not merely both handled",
  resolveBudgetLimit("", FALLBACK) !== resolveBudgetLimit("0", FALLBACK),
  `blank → ${resolveBudgetLimit("", FALLBACK)}, "0" → ${resolveBudgetLimit("0", FALLBACK)}`,
)

// ----------------------------------------------------------- normal values

check("a plain number is used", resolveBudgetLimit("25", FALLBACK) === 25)
check("a decimal is used", resolveBudgetLimit("12.5", FALLBACK) === 12.5)
check("surrounding whitespace is trimmed", resolveBudgetLimit("  30\n", FALLBACK) === 30)

// ------------------------------------------------------------- rejections

check("a non-numeric value falls back rather than becoming NaN", resolveBudgetLimit("abc", FALLBACK) === FALLBACK)
check(
  "a NEGATIVE budget falls back",
  resolveBudgetLimit("-5", FALLBACK) === FALLBACK,
  "a negative hard stop has no meaning; taking it literally would trip on any spend at all",
)
check("Infinity falls back", resolveBudgetLimit("Infinity", FALLBACK) === FALLBACK)

// ------------------------------------------------------------ the names

/**
 * The variable names carry `_BUDGET_`, and the project has written them wrong
 * twice — a handoff note and a backlog paragraph both shortened them to
 * `DAILY_HARD_STOP` / `MONTHLY_HARD_STOP`. An operator checking Vercel for a
 * variable that does not exist finds nothing, and nothing is indistinguishable
 * from "correctly unset", which is the single answer P6-86 needs.
 */
check(
  "the env names all carry _BUDGET_",
  Object.values(BUDGET_ENV_NAMES).every((n) => n.includes("_BUDGET_")),
  Object.values(BUDGET_ENV_NAMES).join(" · "),
)
check(
  "the defaults are positive and monthly exceeds daily",
  DEFAULT_DAILY_HARD_STOP > 0 && DEFAULT_MONTHLY_HARD_STOP > DEFAULT_DAILY_HARD_STOP,
  `daily ${DEFAULT_DAILY_HARD_STOP}, monthly ${DEFAULT_MONTHLY_HARD_STOP}`,
)

// ------------------------------------------- the deployment side (P6-86)

/**
 * The code side of P6-86 is everything above. This half is about the PLATFORM:
 * only the running deployment knows whether `MONTHLY_BUDGET_TARGET` is unset,
 * holds a number, or exists with an empty value.
 *
 * The finding was going to close as "the owner will check the Vercel dashboard".
 * A dashboard check is a point-in-time answer to a question that can change
 * silently afterwards, which is the shape of most findings in this audit, so the
 * health check reports it on every run instead. These assertions pin that the
 * report exists, distinguishes the four states, and never publishes a value.
 */
const healthSrc = readFileSync(join(ROOT, "app/api/admin/run-health-checks/route.ts"), "utf8")

check(
  "the health check reports budget env state",
  /budgetEnv: budgetEnvReport\(\)/.test(healthSrc),
  "alongside seriesCoverage and universeFreshness in the same payload",
)
check(
  "it reads the names from BUDGET_ENV_NAMES rather than re-typing them",
  /Object\.entries\(BUDGET_ENV_NAMES\)/.test(healthSrc),
  "the project has typed these names wrong twice already",
)
for (const state of ["unset", "configured", "BLANK", "unparseable"]) {
  check(
    `the report can say "${state}"`,
    new RegExp(`"${state}"`).test(healthSrc),
    state === "BLANK" ? "present-and-empty is the operator error the finding is about" : "",
  )
}
check(
  "BLANK is distinguished from unset rather than folded into it",
  /raw === undefined\) state = "unset"[\s\S]{0,160}!trimmed\) state = "BLANK"/.test(healthSrc),
  'Number("") === 0, so a blank used to mean spend-zero — the two must not render alike',
)
check(
  "the report publishes state, never the configured value",
  !/return \{ key, name, state, (raw|value)/.test(healthSrc),
  "a ceiling is not a credential, but there is no reason to publish it either",
)
check(
  "a blank or unparseable variable makes the whole report non-ok",
  /status: bad\.length === 0 \? \("ok" as const\) : \("misconfigured" as const\)/.test(healthSrc),
  "a per-variable state nobody aggregates is a state nobody notices",
)

if (failures > 0) {
  console.error(`\n${failures} budget-env check(s) failed.`)
  process.exit(1)
}
