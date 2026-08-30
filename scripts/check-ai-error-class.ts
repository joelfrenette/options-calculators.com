/**
 * A failed AI call must record WHY it failed.
 *
 * WHAT WENT WRONG WITHOUT THIS. Between 2026-08-08 and 2026-08-30, xAI failed
 * 401 times out of 401 — a 100% failure rate on the first provider of all six
 * CCPI fallback chains, feeding the site's default landing page. Nothing
 * surfaced it, because a failed LLM call recorded `ok: false` and nothing else:
 * `recordAiCall` hardcoded `status: 0` on the failure path and discarded the
 * SDK error entirely. Three of the four market-data fetchers did worse and
 * returned null without metering at all, two of them under a comment
 * explaining the silence. It was investigated for three weeks as a
 * token-accounting bug, because unpriced rows are what you see when you cannot
 * see the cause.
 *
 * WHAT THIS ENFORCES. Two structural rules, both derived from the code rather
 * than from prose — CLAUDE.md's Rule 13 lesson is that a check scoped by
 * keyword silently stops covering a file when someone rewords a comment:
 *
 *   1. Every `recordAiCall({ ... ok: false ... })` call passes an `error`.
 *   2. Every catch block in the four lib/*-market-data.ts fetchers that can
 *      return from a failed generateText reaches a recordAiCall.
 *
 * AND IT ASSERTS ITS OWN SCOPE SIZE (CLAUDE.md P6-75/P6-77). A check that
 * stops COVERING is as invisible as one that stops running — the PASS count is
 * identical either way. If a new failure site appears, or an existing one is
 * deleted, the count assertion fails and forces the baseline to move
 * deliberately.
 *
 * Run: node scripts/check-ai-error-class.ts
 */

import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { classifyAiError } from "../lib/ai-error-class.ts"

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

const ROOT = join(import.meta.dirname, "..")

/**
 * Files that call recordAiCall. Derived by scanning lib/ and app/api/ for the
 * import, NOT hardcoded — a hardcoded list is a scope that silently stops
 * growing.
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

const sources = [...walk(join(ROOT, "lib")), ...walk(join(ROOT, "app", "api"))]
const callers = sources
  .map((f) => ({ file: f.slice(ROOT.length + 1).replace(/\\/g, "/"), text: readFileSync(f, "utf8") }))
  .filter((f) => /\brecordAiCall\s*\(/.test(f.text))

// --------------------------------------------------------------- scope size

// 7 files call recordAiCall: the 4 lib/*-market-data.ts fetchers, the provider
// chain, the metering module that defines it, and the executive-summary route.
const EXPECTED_CALLER_FILES = 7
check(
  "scope: every file calling recordAiCall is in scope",
  callers.length === EXPECTED_CALLER_FILES,
  `${callers.length} file(s), want ${EXPECTED_CALLER_FILES} — ${callers.map((c) => c.file).join(", ")}`,
)

// ------------------------------------------- rule 1: ok:false carries error

/**
 * Slice each `recordAiCall({ ... })` argument object by brace balance, so a
 * nested object or a trailing comment cannot fool a line-window heuristic.
 */
function recordAiCallArgs(text: string): string[] {
  const out: string[] = []
  const re = /\brecordAiCall\s*\(\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    let depth = 1
    let i = m.index + m[0].length
    while (i < text.length && depth > 0) {
      if (text[i] === "{") depth++
      else if (text[i] === "}") depth--
      i++
    }
    out.push(text.slice(m.index, i))
  }
  return out
}

let failureSites = 0
let sitesMissingError = 0
const missing: string[] = []

for (const { file, text } of callers) {
  // lib/metered-fetch.ts DEFINES recordAiCall; it has no call sites of its own.
  if (file === "lib/metered-fetch.ts") continue
  for (const args of recordAiCallArgs(text)) {
    if (!/\bok:\s*false\b/.test(args)) continue
    failureSites++
    // `error,` shorthand or `error: <expr>`.
    if (!/\berror\s*[,:]/.test(args)) {
      sitesMissingError++
      missing.push(file)
    }
  }
}

// 8 failure sites: 3 in lib/ai-providers.ts (generate catch, stream .catch,
// stream catch), 1 each in the 4 lib/*-market-data.ts fetchers, 1 in
// app/api/ccpi/executive-summary/route.ts.
const EXPECTED_FAILURE_SITES = 8
check(
  "scope: every ok:false recordAiCall site is in scope",
  failureSites === EXPECTED_FAILURE_SITES,
  `${failureSites} site(s), want ${EXPECTED_FAILURE_SITES}`,
)
check(
  "every failed AI call records its cause",
  sitesMissingError === 0,
  sitesMissingError === 0 ? `${failureSites} failure sites all pass error` : `missing in ${missing.join(", ")}`,
)

// ------------------------- rule 2: the market-data fetchers meter on failure

const fetchers = callers.filter((c) => /^lib\/[a-z-]+-market-data\.ts$/.test(c.file))
const EXPECTED_FETCHERS = 4
check(
  "scope: all four lib/*-market-data.ts fetchers are in scope",
  fetchers.length === EXPECTED_FETCHERS,
  `${fetchers.length} — ${fetchers.map((f) => f.file).join(", ")}`,
)

/**
 * Pair every `try { … } catch (…) { … }` by brace balance and return both
 * bodies.
 *
 * Scope comes from STRUCTURE, not from proximity: a catch must meter iff its
 * OWN try block actually invokes the model. An outer catch that wraps key
 * resolution and prompt construction has no call to record — metering it would
 * inflate the ledger with calls that were never made, which is the same class
 * of lie as not recording the ones that were. lib/grok-market-data.ts has
 * exactly this shape: an inner try around generateText that must meter, inside
 * an outer try that must not.
 */
function tryCatchPairs(text: string): { tryBody: string; catchBody: string }[] {
  const pairs: { tryBody: string; catchBody: string }[] = []
  const re = /\btry\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    let depth = 1
    let i = m.index + m[0].length
    const tryStart = i
    while (i < text.length && depth > 0) {
      if (text[i] === "{") depth++
      else if (text[i] === "}") depth--
      i++
    }
    const tryBody = text.slice(tryStart, i - 1)
    const after = text.slice(i)
    const cm = /^\s*catch\s*\([^)]*\)\s*\{/.exec(after)
    if (!cm) continue
    depth = 1
    let j = cm[0].length
    const catchStart = j
    while (j < after.length && depth > 0) {
      if (after[j] === "{") depth++
      else if (after[j] === "}") depth--
      j++
    }
    pairs.push({ tryBody, catchBody: after.slice(catchStart, j - 1) })
  }
  return pairs
}

/**
 * Blank out any nested `try { … } catch (…) { … }` region, leaving only the
 * code this try block is DIRECTLY responsible for.
 *
 * Without this, an outer try that merely encloses an inner one inherits the
 * inner's model call and is wrongly required to meter it — which would mean
 * recording the same failure twice. Responsibility stops at the nearest
 * enclosing handler, so the scope must too.
 */
function stripNestedTryCatch(body: string): string {
  let out = body
  for (;;) {
    const m = /\btry\s*\{/.exec(out)
    if (!m) return out
    let depth = 1
    let i = m.index + m[0].length
    while (i < out.length && depth > 0) {
      if (out[i] === "{") depth++
      else if (out[i] === "}") depth--
      i++
    }
    const cm = /^\s*catch\s*\([^)]*\)\s*\{/.exec(out.slice(i))
    if (cm) {
      let d = 1
      let j = i + cm[0].length
      while (j < out.length && d > 0) {
        if (out[j] === "{") d++
        else if (out[j] === "}") d--
        j++
      }
      i = j
    }
    out = out.slice(0, m.index) + out.slice(i)
  }
}

let modelCatches = 0
for (const { file, text } of fetchers) {
  // A catch that returns without metering is the exact hole this closes: the
  // successes get recorded, the failures do not, and the provider reads as
  // healthy-then-idle rather than healthy-then-broken.
  const guarding = tryCatchPairs(text).filter((p) => /\bgenerateText\s*\(/.test(stripNestedTryCatch(p.tryBody)))
  const metered = guarding.filter((p) => /\brecordAiCall\s*\(/.test(p.catchBody))
  modelCatches += guarding.length
  check(
    `${file}: every catch around a model call meters the failure`,
    guarding.length > 0 && metered.length === guarding.length,
    `${metered.length}/${guarding.length} model-guarding catch block(s)`,
  )
}

// Scope assertion for the rule above: 4 fetchers, one model-guarding catch
// each. If a fetcher grows a second model call, or loses its only one, this
// moves deliberately rather than the check quietly covering less.
const EXPECTED_MODEL_CATCHES = 4
check(
  "scope: every catch guarding a generateText is in scope",
  modelCatches === EXPECTED_MODEL_CATCHES,
  `${modelCatches}, want ${EXPECTED_MODEL_CATCHES}`,
)

// ------------------------------------------- the classifier is wired at all

const meter = readFileSync(join(ROOT, "lib", "metered-fetch.ts"), "utf8")
check(
  "recordAiCall imports the classifier",
  /import\s*\{\s*classifyAiError\s*\}\s*from\s*"@\/lib\/ai-error-class"/.test(meter),
)
check(
  "the failure path no longer hardcodes status 0",
  /status:\s*args\.ok\s*\?\s*200\s*:\s*\(failure\?\.status\s*\?\?\s*0\)/.test(meter),
  "the SDK's upstream status is the single most diagnostic field; it must reach the row",
)
check(
  "the row carries error_class and error_detail",
  /error_class:\s*call\.errorClass/.test(meter) && /error_detail:\s*call\.errorDetail/.test(meter),
)

// ------------------------------------------ the classifier, actually invoked

// Worked cases, not source shapes. Regex-matching the classifier's own text
// would pass just as happily if every branch returned the wrong class — the
// check would be asserting that the code says what it says.

/** An APICallError-shaped throw: the `ai` package puts the status on statusCode. */
const apiError = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode })

const cls = (err: unknown) => classifyAiError(err).errorClass

check("404 → model_not_found (a retired slug, not a dead key)", cls(apiError(404, "model not found")) === "model_not_found")
check("401 → auth", cls(apiError(401, "invalid api key")) === "auth")
check("403 → auth", cls(apiError(403, "forbidden")) === "auth")
check("429 → rate_limit", cls(apiError(429, "rate limit exceeded")) === "rate_limit")
check("500 → upstream (theirs, not ours)", cls(apiError(500, "internal error")) === "upstream")
check("503 → upstream", cls(apiError(503, "unavailable")) === "upstream")
check("400 with a plain complaint → bad_request", cls(apiError(400, "messages must not be empty")) === "bad_request")
check(
  "400 naming a retired model → model_not_found",
  cls(apiError(400, "The model `grok-2-latest` does not exist")) === "model_not_found",
  "several vendors report an unknown slug as a 400, not a 404 — the class must follow the cause, not the code",
)
check("a plain timeout → timeout", cls(new Error("The operation was aborted due to timeout")) === "timeout")
check("a DNS failure → transport", cls(new Error("getaddrinfo ENOTFOUND api.x.ai")) === "transport")
check("an unrecognised error admits it → unknown", cls(new Error("something nobody predicted")) === "unknown")

// `status` is read off a nested cause too — SDKs wrap the transport error.
check(
  "a status nested one level under `cause` is still read",
  classifyAiError({ cause: apiError(429, "slow down") }).status === 429,
)
check("the real upstream status reaches the row", classifyAiError(apiError(404, "gone")).status === 404)
check("no status when the call never got a response", classifyAiError(new Error("fetch failed")).status === null)

// The detail is what a human reads when the class says `unknown`.
check(
  "detail is truncated, not a whole response body",
  classifyAiError(new Error("x".repeat(5000))).detail.length <= 300,
)
check("detail survives for a real message", classifyAiError(apiError(404, "no such model")).detail.includes("no such model"))

check(
  "the migration adding the columns exists",
  readdirSync(join(ROOT, "supabase", "migrations")).some((f) => /error_class\.sql$/.test(f)),
)

console.log(
  failures === 0
    ? `\nAll AI error-class checks passed — ${failureSites} failure sites across ${callers.length} files.`
    : `\n${failures} AI error-class check(s) FAILED.`,
)
process.exit(failures === 0 ? 0 : 1)
