/**
 * Verifies lib/api-contracts.ts and the KNOWN_ROUTES list in
 * app/api/admin/run-health-checks/route.ts still match the routes on disk.
 *
 * Run: node scripts/check-contract-coverage.ts
 *
 * Route handlers are bundled at build time, so app/api cannot be enumerated at
 * runtime on Vercel — the health endpoint carries a committed list instead, and
 * this script is what keeps that list honest. Add it to CI alongside typecheck.
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/route\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

const onDisk = walk(join(ROOT, "app", "api"))
  .map((f) => "/" + relative(ROOT, f).split(sep).join("/").replace(/^app\//, "").replace(/\/route\.tsx?$/, ""))
  .sort()

const contractsSrc = readFileSync(join(ROOT, "lib", "api-contracts.ts"), "utf8")
const contracted = new Set([...contractsSrc.matchAll(/path:\s*"(\/api\/[^"]+)"/g)].map((m) => m[1]))

const healthSrc = readFileSync(join(ROOT, "app", "api", "admin", "run-health-checks", "route.ts"), "utf8")
const knownBlock = healthSrc.match(/const KNOWN_ROUTES = \[([\s\S]*?)\]/)
const known = new Set([...(knownBlock?.[1] ?? "").matchAll(/"(\/api\/[^"]+)"/g)].map((m) => m[1]))

let failures = 0
function report(label: string, missing: string[]) {
  if (missing.length === 0) {
    console.log(`PASS  ${label}`)
    return
  }
  failures++
  console.log(`FAIL  ${label} (${missing.length}):`)
  for (const m of missing) console.log(`        ${m}`)
}

report(
  "every route on disk has a contract",
  onDisk.filter((r) => !contracted.has(r)),
)
report(
  "every contract points at a real route",
  [...contracted].filter((r) => !onDisk.includes(r)).sort(),
)
report(
  "KNOWN_ROUTES covers every route on disk",
  onDisk.filter((r) => !known.has(r)),
)
report(
  "KNOWN_ROUTES has no phantom entries",
  [...known].filter((r) => !onDisk.includes(r)).sort(),
)

console.log(
  failures === 0
    ? `\nContract coverage complete: ${onDisk.length} routes, ${contracted.size} contracts.`
    : `\n${failures} coverage check(s) failed. Run \`pnpm inventory\` and update lib/api-contracts.ts.`,
)
process.exit(failures === 0 ? 0 : 1)
