/**
 * No fabricated value is interpolated into a prompt sent to a model.
 *
 * Run: node scripts/check-prompt-inputs.ts
 *
 * WHY THIS FILE EXISTS. P7-20. `/api/ccpi/executive-summary` built its prompt
 * with `const ccpi = body.ccpi ?? 0` and rendered it as:
 *
 *     - CCPI Score: ${ccpi}/100
 *
 * directly beneath its own legend:
 *
 *     - 0-19: Low Risk (markets healthy)
 *
 * So a composite that could NOT be scored was handed to the model as the
 * strongest all-clear the scale has — and the model's answer is what the user
 * reads as the executive summary. The absence became a reassurance, laundered
 * through a language model.
 *
 * **This class is worse than a fabricated number on screen.** A wrong figure in
 * the UI is at least inspectable; a wrong figure in a prompt is reasoned over,
 * and what reaches the user is prose that no longer contains the number at all.
 * Nothing downstream can recover the fact that the input was invented.
 *
 * WHAT IS CHECKED. In every file that reaches a model, a variable declared with
 * a literal `??`/`||` fallback must not be interpolated into a prompt template.
 * Prompts are identified structurally by the codebase's own consistent idiom —
 * `const prompt`, `const systemPrompt`, `const userPrompt` assigned a template
 * literal — and that idiom's presence is asserted, so a rename that would empty
 * the scope fails rather than passing.
 *
 * WHAT IT DOES NOT CATCH, stated rather than implied:
 *   - A default applied at the SOURCE rather than at the prompt-building site.
 *     That is the P7-10 lesson and the reason `check-ccpi-defaults.ts` exists
 *     separately: a producer returning a baseline OBJECT defeats every
 *     call-site guard, and no textual rule at the consumer can see it.
 *   - A fabricated value passed through a helper before interpolation.
 *   - Prompt text assembled by concatenation rather than interpolation.
 *
 * SCOPE IS STRUCTURAL (P6-75) and asserted (P6-77).
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const rel = (p: string) => relative(ROOT, p).split(sep).join("/")

let failures = 0
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!passed) failures++
}

function walk(dir: string, match: (p: string) => boolean): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const e of entries) {
    if (e === "node_modules" || e === ".next" || e === ".git" || e === ".claude") continue
    const full = join(dir, e)
    if (statSync(full).isDirectory()) out.push(...walk(full, match))
    else if (match(full)) out.push(full)
  }
  return out
}

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m, pre) =>
    m.startsWith("/*") ? " " + "\n".repeat((m.match(/\n/g) || []).length) : (pre ?? ""),
  )

/** A file reaches a model if it calls the shared chain or the SDK directly. */
const REACHES_MODEL =
  /from ["']@\/lib\/ai-providers["']|generateWithFallback|streamWithFallback|streamText\(|generateText\(/

const ALL = [
  ...walk(join(ROOT, "app"), (p) => p.endsWith(".ts") || p.endsWith(".tsx")),
  ...walk(join(ROOT, "lib"), (p) => p.endsWith(".ts")),
]
const AI_FILES = ALL.filter((f) => REACHES_MODEL.test(readFileSync(f, "utf8")))

const MIN_AI_FILES = 10
check(
  `scope: ${AI_FILES.length} file(s) reach a model`,
  AI_FILES.length >= MIN_AI_FILES,
  `${AI_FILES.length}, floor ${MIN_AI_FILES} — a collapsed scope must fail, not pass`,
)

/**
 * `const prompt = \`…\`` / `systemPrompt` / `userPrompt` — this repo's idiom.
 *
 * The identifier is captured whole and filtered by name afterwards, rather than
 * matched with `[A-Za-z_$][\w$]*[Pp]rompt`. That earlier pattern required a
 * PREFIX before "prompt", so it matched `systemPrompt` and `userPrompt` and
 * **silently never matched a bare `const prompt`** — which is exactly where the
 * P7-20 defect lived. The rule reported 5 prompts, passed, and covered none of
 * the files that matter most.
 */
const PROMPT_DECL = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*`/g
const isPromptName = (n: string) => /prompt/i.test(n)

/**
 * The body of a template literal whose opening backtick has just been consumed.
 *
 * A nesting-aware scan, and it has to be. The first version took
 * `src.indexOf("\`", start)` on the assumption that these templates contain no
 * nested backticks — **they do**, inside their own `${…}` expressions, e.g.
 * `` ${ccpi === null ? "NOT SCOREABLE …" : `${ccpi}/100`} ``. That truncated the
 * body at the first inner backtick, so the rule looked at a prompt fragment
 * ending long before the interesting part, and **the negative test carrying the
 * verbatim P7-20 defect did not fail.** Caught the same way the stripComments
 * bug was: by injecting the real defect and noticing nothing happened.
 */
function templateBody(src: string, start: number): string {
  let i = start
  let exprDepth = 0
  while (i < src.length) {
    const c = src[i]
    if (c === "\\") {
      i += 2
      continue
    }
    if (c === "$" && src[i + 1] === "{") {
      exprDepth++
      i += 2
      continue
    }
    if (c === "}" && exprDepth > 0) {
      exprDepth--
      i++
      continue
    }
    // A backtick inside an interpolation opens a NESTED template; skip it
    // wholesale so its own closing tick is not mistaken for ours.
    if (c === "`") {
      if (exprDepth === 0) return src.slice(start, i)
      const inner = templateBody(src, i + 1)
      i += 1 + inner.length + 1
      continue
    }
    i++
  }
  return src.slice(start)
}

/** A literal fallback: `const x = <anything> ?? 0` (or `|| false`). */
const DEFAULTED = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*[^\n]*?(?:\?\?|\|\|)\s*(-?\d+(?:\.\d+)?|false|true)\s*$/gm

let promptsSeen = 0
const offences: string[] = []

for (const f of AI_FILES) {
  const src = stripComments(readFileSync(f, "utf8"))

  // Collect the prompt template bodies in this file.
  const promptBodies: string[] = []
  PROMPT_DECL.lastIndex = 0
  let pm: RegExpExecArray | null
  while ((pm = PROMPT_DECL.exec(src)) !== null) {
    if (!isPromptName(pm[1])) continue
    promptsSeen++
    promptBodies.push(templateBody(src, PROMPT_DECL.lastIndex))
  }
  if (promptBodies.length === 0) continue

  DEFAULTED.lastIndex = 0
  let dm: RegExpExecArray | null
  while ((dm = DEFAULTED.exec(src)) !== null) {
    const name = dm[1]
    const interpolated = new RegExp(`\\$\\{\\s*${name}\\b`)
    if (promptBodies.some((b) => interpolated.test(b))) {
      offences.push(`${rel(f)} — \`${dm[0].trim().slice(0, 70)}\` reaches a prompt as \${${name}}`)
    }
  }
}

check(
  `scope: ${promptsSeen} prompt template(s) found`,
  promptsSeen > 0,
  `${promptsSeen} — zero would mean the prompt idiom changed and this rule stopped covering anything`,
)

check(
  "no defaulted value is interpolated into a prompt",
  offences.length === 0,
  offences.length ? offences.join(" | ") : `${promptsSeen} prompt(s) across ${AI_FILES.length} AI file(s)`,
)

if (failures > 0) {
  console.error(`\n${failures} prompt-input check(s) failed.`)
  process.exit(1)
}
