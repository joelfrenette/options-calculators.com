#!/usr/bin/env node
/**
 * scripts/site-inventory.ts — Phase 0 of AUDIT_PLAN.md
 *
 * Walks app/api/*, components/*, lib/* and app/page.tsx to produce SITE_MAP.md:
 * the FUNCTION -> TAB -> COMPONENT skeleton plus the API dependency graph
 * (which tab calls which internal route, which route calls which upstream host,
 * which env keys each route needs).
 *
 * Zero dependencies. Node >= 22 strips the type annotations natively:
 *   node scripts/site-inventory.ts
 * Add --json to dump the raw inventory instead of writing SITE_MAP.md.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..")

/**
 * Reads the sign-off marks out of the CURRENT SITE_MAP.md so a regeneration
 * does not wipe them. Returns tab id -> the 8 cells, verbatim.
 *
 * Deliberately forgiving about the cell characters: the ledger has used ☑/☐
 * and could use anything else tomorrow. Whatever a human wrote is preserved
 * as-is; this function's job is not to interpret it.
 */
function readExistingLedger(): Map<string, string[]> {
  const marks = new Map<string, string[]>()
  let text: string
  try {
    text = readFileSync(join(ROOT, "SITE_MAP.md"), "utf8")
  } catch {
    return marks // first run, no file yet
  }
  const section = text.split("## 6. PHASE 6 SIGN-OFF LEDGER")[1]
  if (!section) return marks
  const body = section.split(/^## /m)[0]
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|(.+)\|\s*$/)
    if (!m) continue
    const cells = m[2].split("|").map((c) => c.trim())
    if (cells.length !== 8) continue
    marks.set(m[1], cells)
  }
  return marks
}
const rel = (p: string) => relative(ROOT, p).split(sep).join("/")

// ---------------------------------------------------------------- fs helpers

function walk(dir: string, match: (p: string) => boolean): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full, match))
    else if (match(full)) out.push(full)
  }
  return out
}

const read = (p: string) => readFileSync(p, "utf8")
const uniq = <T,>(xs: T[]) => [...new Set(xs)]

/** 1-based line number of a character offset. */
const lineOf = (src: string, index: number) => src.slice(0, index).split("\n").length

/**
 * Every `lib/` module reachable from `entry` by import, transitively.
 *
 * Scoped to `@/lib` and to relative specifiers that stay inside `lib/` — a
 * route's own `./x` is its own directory, already covered. The visited set is
 * also the cycle guard, which `lib/strategy-scanner/*` needs: several
 * generators reach `market-data` by two paths.
 */
function reachableLibs(entry: string): string[] {
  const seen = new Set<string>()
  const libs: string[] = []
  const visit = (file: string, isEntry: boolean) => {
    const key = rel(file)
    if (seen.has(key)) return
    seen.add(key)
    let src: string
    try {
      src = read(file)
    } catch {
      return // an import that does not resolve to a file on disk
    }
    if (!isEntry) libs.push(file)
    const re = /from\s+["'](@\/lib\/[^"']+|\.{1,2}\/[^"']+)["']/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      const spec = m[1]
      const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : join(file, "..", spec)
      if (!rel(base).startsWith("lib/")) continue
      for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        const candidate = base + ext
        try {
          if (statSync(candidate).isFile()) {
            visit(candidate, false)
            break
          }
        } catch {
          // try the next extension
        }
      }
    }
  }
  visit(entry, true)
  return libs
}

/**
 * A route's source PLUS the modules that exist only to be its body.
 *
 * WHY A ROUTE IS NO LONGER ONE FILE. P6-13 split the 1,808-line strategy-scanner
 * route into `lib/strategy-scanner/`, and this inventory — reading route files
 * one at a time — immediately reported that `/api/strategy-scanner` reaches no
 * upstream host, needs no env key and wires no timeout. All three were false the
 * moment they were written: the fetches had moved one import away. SITE_MAP is
 * where a reader asks "what does this route touch", and a refactor had just
 * answered "nothing" for the route with the largest upstream surface on the site.
 *
 * WHY NOT THE FULL IMPORT CLOSURE, which was the first attempt: it changed 115
 * of the 59 routes' rows. Every admin route inherited `lib/auth.ts`'s six
 * secrets and every Supabase reader inherited its keys, so the Env-keys column
 * stopped distinguishing routes from each other. That is not more accurate, it
 * is less legible — and shared infrastructure already has its own row in the
 * lib table below.
 *
 * So the body is the EXCLUSIVE closure: a lib module reachable from exactly one
 * route is that route's implementation, and a module reachable from several is
 * infrastructure. `lib/strategy-scanner/**` qualifies; `lib/auth.ts` does not.
 * The distinction is derived from the import graph, so a module that gains a
 * second caller leaves the first route's row on its own.
 */
const exclusiveBody = new Map<string, string[]>()
function computeExclusiveBodies(routeFiles: string[]): void {
  const reachedBy = new Map<string, string[]>()
  const perRoute = new Map<string, string[]>()
  for (const f of routeFiles) {
    const libs = reachableLibs(f)
    perRoute.set(f, libs)
    for (const lib of libs) reachedBy.set(rel(lib), [...(reachedBy.get(rel(lib)) ?? []), f])
  }
  for (const f of routeFiles) {
    exclusiveBody.set(
      f,
      (perRoute.get(f) ?? []).filter((lib) => (reachedBy.get(rel(lib)) ?? []).length === 1),
    )
  }
}

/** The route file's source concatenated with its exclusive-body modules'. */
function routeBody(entry: string): string {
  return [entry, ...(exclusiveBody.get(entry) ?? [])].map(read).join("\n")
}

// ------------------------------------------------------------- extractors

/** Every `/api/...` path this file fetches, with the line it appears on. */
function internalApiCalls(src: string): Array<{ route: string; line: number }> {
  const hits: Array<{ route: string; line: number }> = []
  const re = /["'`](\/api\/[a-zA-Z0-9\-_/[\]]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    // strip trailing dynamic segment noise and template holes
    const route = m[1].replace(/\/$/, "")
    hits.push({ route, line: lineOf(src, m.index) })
  }
  const seen = new Set<string>()
  return hits.filter((h) => (seen.has(h.route) ? false : seen.add(h.route)))
}

/** Upstream hostnames this file fetches (http/https literals + template heads). */
function upstreamHosts(src: string): string[] {
  const hosts: string[] = []
  const re = /https?:\/\/([a-zA-Z0-9.\-]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) hosts.push(m[1].toLowerCase())
  return uniq(hosts).sort()
}

/** process.env.X references. */
function envKeys(src: string): string[] {
  const keys: string[] = []
  const re = /process\.env\.([A-Z0-9_]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) keys.push(m[1])
  // getApiKey("X") / resolveKey("X") style lookups used by lib/api-keys.ts
  const re2 = /(?:getApiKey|resolveApiKey|getKey)\(\s*["'`]([A-Za-z0-9_]+)["'`]/g
  while ((m = re2.exec(src))) keys.push(m[1])
  return uniq(keys).sort()
}

/** Exported HTTP verbs of a route handler. */
function httpMethods(src: string): string[] {
  const verbs = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
  return verbs.filter((v) =>
    new RegExp(`export\\s+(?:async\\s+)?function\\s+${v}\\b|export\\s+const\\s+${v}\\s*[:=]`).test(src),
  )
}

/** Route segment config exports (runtime / dynamic / revalidate / maxDuration). */
function routeConfig(src: string): Record<string, string> {
  const cfg: Record<string, string> = {}
  const re = /export\s+const\s+(runtime|dynamic|revalidate|maxDuration|fetchCache)\s*=\s*([^\n]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) cfg[m[1]] = m[2].replace(/[;\s]+$/, "")
  return cfg
}

/** Does the file wire an abort/timeout onto its fetches? */
function hasTimeout(src: string): boolean {
  return /AbortSignal\.timeout|AbortController|setTimeout\(\s*\(\)\s*=>\s*\w*\.abort/.test(src)
}

/** localStorage / sessionStorage cache keys touched by a component. */
function storageKeys(src: string): string[] {
  const keys: string[] = []
  const re = /(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*["'`]([^"'`]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) keys.push(m[1])
  return uniq(keys).sort()
}

// ------------------------------------------------------- tab registry (page)

interface TabDef {
  fn: string
  nav: string
  id: string
  label: string
  component: string | null
  file: string | null
  featured: boolean
}

const FUNCTION_OF: Record<string, string> = {
  ANALYZE_TABS: "DECIDE",
  SCAN_TABS: "FIND",
  COPY_TABS: "FIND",
  EXECUTE_TABS: "LEARN",
}
const NAV_OF: Record<string, string> = {
  ANALYZE_TABS: "ANALYZE",
  SCAN_TABS: "SCAN",
  COPY_TABS: "COPY",
  EXECUTE_TABS: "LEARN",
}

function parseTabs(pageSrc: string): TabDef[] {
  // tab id -> component name, from the renderTab switch
  const tabComponent = new Map<string, string>()
  const caseRe = /case\s+"([a-z0-9-]+)":\s*\n\s*return\s+<([A-Za-z0-9_]+)([^>]*)>/g
  let m: RegExpExecArray | null
  while ((m = caseRe.exec(pageSrc))) {
    const props = m[3].replace(/\/$/, "").trim() // drop the self-closing slash
    tabComponent.set(m[1], props ? `${m[2]} ${props}` : m[2])
  }

  // component name -> source file, from the import block
  const componentFile = new Map<string, string>()
  const impRe = /import\s+\{\s*([A-Za-z0-9_,\s]+)\}\s+from\s+"@\/(components\/[^"]+)"/g
  while ((m = impRe.exec(pageSrc))) {
    const file = `${m[2]}.tsx`
    for (const name of m[1].split(",").map((s) => s.trim()).filter(Boolean)) componentFile.set(name, file)
  }

  const tabs: TabDef[] = []
  for (const arrayName of Object.keys(FUNCTION_OF)) {
    const block = pageSrc.match(new RegExp(`const ${arrayName}[^=]*=\\s*\\[([\\s\\S]*?)\\n\\]`))
    if (!block) continue
    // The `{0,400}` window this used to carry silently DROPPED any entry whose
    // body ran longer — the lookahead could not be satisfied inside it, so the
    // match failed and the tab vanished from the inventory AND from the §6
    // sign-off ledger, taking its marks with it.
    //
    // That is exactly P6-23, and it happened again on 2026-08-11: adding an
    // explanatory comment to the `ccpi` entry in app/page.tsx pushed it past
    // 400 characters and the flagship tab disappeared from both. Nothing failed;
    // the totals line quietly read 41 instead of 42.
    //
    // No cap now — the lookahead alone bounds each entry — and the count is
    // asserted below, because a parser that can drop a row must not be the only
    // thing that knows how many rows there should be.
    const entryRe = /id:\s*"([a-z0-9-]+)",\s*\n?\s*label:\s*"([^"]+)"([\s\S]*?)(?=\{\s*\n?\s*id:|$)/g
    let e: RegExpExecArray | null
    while ((e = entryRe.exec(block[1]))) {
      const comp = tabComponent.get(e[1]) ?? null
      const bare = comp ? comp.split(" ")[0] : null
      tabs.push({
        fn: FUNCTION_OF[arrayName],
        nav: NAV_OF[arrayName],
        id: e[1],
        label: e[2],
        component: comp,
        file: bare ? (componentFile.get(bare) ?? null) : null,
        featured: /featured:\s*true/.test(e[3]),
      })
    }
  }
  // A parse that silently loses entries is worse than one that crashes: the
  // generated file still looks complete. Cross-check the count against the raw
  // `id:` occurrences in the same source, so a regex that stops matching fails
  // loudly instead of quietly shrinking the site map and the sign-off ledger.
  let declared = 0
  for (const arrayName of Object.keys(FUNCTION_OF)) {
    const block = pageSrc.match(new RegExp(`const ${arrayName}[^=]*=\\s*\\[([\\s\\S]*?)\\n\\]`))
    if (block) declared += [...block[1].matchAll(/\bid:\s*"[a-z0-9-]+"/g)].length
  }
  if (tabs.length !== declared) {
    throw new Error(
      `Tab parse lost entries: matched ${tabs.length} but app/page.tsx declares ${declared}. ` +
        `The entry regex stopped matching something — fix it rather than regenerating, or SITE_MAP ` +
        `and the §6 sign-off ledger will both silently drop a tab (P6-23, and again 2026-08-11).`,
    )
  }

  return tabs
}

// ------------------------------------------------------------------ collect

interface RouteInfo {
  path: string
  file: string
  lines: number
  methods: string[]
  config: Record<string, string>
  hosts: string[]
  env: string[]
  calls: string[]
  timeout: boolean
}

interface FileInfo {
  file: string
  lines: number
  apiCalls: string[]
  hosts: string[]
  storage: string[]
}

const routeFiles = walk(join(ROOT, "app", "api"), (p) => /[\\/]route\.tsx?$/.test(p))
computeExclusiveBodies(routeFiles)
const routes: RouteInfo[] = routeFiles
  .map((f) => {
    const src = read(f)
    // Verbs and segment config are properties of the entry file itself — only
    // a route file can export GET or `dynamic`. Everything a route DOES is read
    // from its reachable body, because since P6-13 the body is not the file.
    const body = routeBody(f)
    return {
      path: "/" + rel(f).replace(/^app\//, "").replace(/\/route\.tsx?$/, ""),
      file: rel(f),
      lines: src.split("\n").length,
      methods: httpMethods(src),
      config: routeConfig(src),
      hosts: upstreamHosts(body).filter((h) => !h.startsWith("localhost")),
      env: envKeys(body),
      calls: internalApiCalls(body).map((c) => c.route),
      timeout: hasTimeout(body),
    }
  })
  .sort((a, b) => a.path.localeCompare(b.path))

// Components + the app-router pages/layouts that consume them (app/api is covered separately).
const componentFiles = [
  ...walk(join(ROOT, "components"), (p) => /\.tsx?$/.test(p) && !p.includes(`${sep}ui${sep}`)),
  ...walk(join(ROOT, "app"), (p) => /\.tsx?$/.test(p) && !p.includes(`${sep}api${sep}`)),
  ...walk(join(ROOT, "hooks"), (p) => /\.tsx?$/.test(p)),
]
const components: FileInfo[] = componentFiles
  .map((f) => {
    const src = read(f)
    return {
      file: rel(f),
      lines: src.split("\n").length,
      apiCalls: internalApiCalls(src).map((c) => c.route),
      hosts: upstreamHosts(src),
      storage: storageKeys(src),
    }
  })
  .sort((a, b) => a.file.localeCompare(b.file))

const libFiles = walk(join(ROOT, "lib"), (p) => /\.tsx?$/.test(p))
const libs: FileInfo[] = libFiles
  .map((f) => {
    const src = read(f)
    return {
      file: rel(f),
      lines: src.split("\n").length,
      apiCalls: internalApiCalls(src).map((c) => c.route),
      hosts: upstreamHosts(src),
      storage: storageKeys(src),
    }
  })
  .sort((a, b) => a.file.localeCompare(b.file))

const tabs = parseTabs(read(join(ROOT, "app", "page.tsx")))

/** Component file -> every internal route it (or its imported siblings) hits. */
const byFile = new Map<string, FileInfo>([...components, ...libs].map((c) => [c.file, c]))

/** Which components/routes reference a given route path. */
function consumersOf(routePath: string): string[] {
  const out: string[] = []
  for (const c of [...components, ...libs]) if (c.apiCalls.includes(routePath)) out.push(c.file)
  for (const r of routes) if (r.path !== routePath && r.calls.includes(routePath)) out.push(r.file)
  return out
}

// ------------------------------------------------------------------- render

const knownRoutePaths = new Set(routes.map((r) => r.path))
const orphanRoutes = routes.filter((r) => consumersOf(r.path).length === 0)
const oversized = [...components, ...libs].filter((c) => c.lines > 600).sort((a, b) => b.lines - a.lines)

function table(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n")
}

const esc = (s: string) => s.replace(/\|/g, "\\|")

function render(): string {
  const out: string[] = []
  const stamp = process.env.SITE_MAP_DATE ?? new Date().toISOString().slice(0, 10)

  out.push("# SITE MAP — Options-Calculators.com")
  out.push("")
  out.push(`> Generated by \`node scripts/site-inventory.ts\` on ${stamp}. **Do not hand-edit the`)
  out.push("> generated sections** — re-run the script. Sign-off checkboxes in §6 are hand-maintained.")
  out.push("")
  out.push(
    `**Totals:** ${routes.length} API routes · ${components.length} components · ${libs.length} lib modules · ${tabs.length} public tabs across ${uniq(tabs.map((t) => t.nav)).length} nav groups.`,
  )
  out.push("")

  // 1. Function -> tab -> component
  out.push("## 1. FUNCTION → TAB → COMPONENT")
  out.push("")
  for (const nav of ["ANALYZE", "SCAN", "COPY", "LEARN"]) {
    const group = tabs.filter((t) => t.nav === nav)
    if (!group.length) continue
    out.push(`### ${group[0].fn} — nav: ${nav} (${group.length} tabs)`)
    out.push("")
    out.push(
      table(
        ["Tab id", "Label", "Component", "File", "Lines", "Internal APIs"],
        group.map((t) => {
          const info = t.file ? byFile.get(t.file) : undefined
          return [
            `\`${t.id}\`${t.featured ? " ★" : ""}`,
            esc(t.label),
            t.component ? `\`${esc(t.component)}\`` : "—",
            t.file ? `\`${t.file}\`` : "—",
            info ? String(info.lines) : "—",
            info && info.apiCalls.length ? info.apiCalls.map((a) => `\`${a}\``).join("<br>") : "none (static)",
          ]
        }),
      ),
    )
    out.push("")
  }

  // 2. API dependency graph
  out.push("## 2. API DEPENDENCY GRAPH")
  out.push("")
  out.push("Every route: HTTP verbs, segment config, upstream hosts, env keys, timeout wiring, consumers.")
  out.push("")
  out.push(
    table(
      ["Route", "Verbs", "Config", "Upstream hosts", "Env keys", "Timeout?", "Consumers"],
      routes.map((r) => [
        `\`${r.path}\``,
        r.methods.join(", ") || "—",
        Object.entries(r.config)
          .map(([k, v]) => `${k}=${esc(v)}`)
          .join("<br>") || "—",
        r.hosts.length ? r.hosts.join("<br>") : "—",
        r.env.length ? r.env.join("<br>") : "—",
        r.timeout ? "yes" : "**no**",
        consumersOf(r.path).length ? consumersOf(r.path).map((c) => `\`${c}\``).join("<br>") : "**none**",
      ]),
    ),
  )
  out.push("")

  // 3. Unreferenced routes
  out.push("## 3. ROUTES WITH NO IN-REPO CONSUMER")
  out.push("")
  out.push("Called externally, by the admin page, or dead. Each needs a verdict in AUDIT_BACKLOG.md.")
  out.push("")
  out.push(
    orphanRoutes.length
      ? table(
          ["Route", "File", "Lines", "Upstream hosts"],
          orphanRoutes.map((r) => [`\`${r.path}\``, `\`${r.file}\``, String(r.lines), r.hosts.join("<br>") || "—"]),
        )
      : "_None._",
  )
  out.push("")

  // 4. Upstream provider index
  out.push("## 4. UPSTREAM PROVIDERS")
  out.push("")
  const providerMap = new Map<string, string[]>()
  for (const r of [...routes]) for (const h of r.hosts) providerMap.set(h, [...(providerMap.get(h) ?? []), r.path])
  for (const c of [...components, ...libs])
    for (const h of c.hosts) providerMap.set(h, [...(providerMap.get(h) ?? []), c.file])
  out.push(
    table(
      ["Host", "Used by"],
      [...providerMap.entries()]
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
        .map(([host, users]) => [host, uniq(users).map((u) => `\`${u}\``).join("<br>")]),
    ),
  )
  out.push("")

  // 5. Module size / debt
  out.push("## 5. MODULES OVER THE 600-LINE BUDGET")
  out.push("")
  out.push(
    oversized.length
      ? table(
          ["File", "Lines", "Over by"],
          oversized.map((c) => [`\`${c.file}\``, String(c.lines), String(c.lines - 600)]),
        )
      : "_None._",
  )
  out.push("")

  // 6. Sign-off ledger (Phase 6)
  //
  // HAND-MAINTAINED ROWS INSIDE A GENERATED FILE. Every previous run emitted a
  // fresh all-☐ table, so `pnpm inventory` — which CLAUDE.md tells you to run
  // whenever routes change — silently erased the audit sign-off record. It
  // already did: 33 ticks were wiped in af2e324 and nobody noticed, because a
  // blank ledger looks exactly like a ledger nobody has filled in yet.
  // Existing marks are now read back out of SITE_MAP.md and merged by tab id.
  const existingMarks = readExistingLedger()
  const newTabs = tabs.filter((t) => !existingMarks.has(t.id)).map((t) => t.id)
  const droppedTabs = [...existingMarks.keys()].filter((id) => !tabs.some((t) => t.id === id))

  out.push("## 6. PHASE 6 SIGN-OFF LEDGER")
  out.push("")
  out.push("Hand-maintained. Legend: `data` live/labeled · `api` verified · `math` verified ·")
  out.push("`fb` fallbacks fire · `copy` accurate · `err` handled · `mob` mobile · `size` ≤600 lines/module.")
  out.push("")
  out.push("Marks: ☑ verified · ☐ not yet verified · – no such surface on this tab.")
  out.push("A static reference tab has no API, no fallbacks and no error paths, so it can never")
  out.push("reach all-☑; without a third mark it would sit half-blank forever and read as")
  out.push("unaudited. `–` says the column was considered and does not apply.")
  out.push("")
  out.push("Marks survive `pnpm inventory` — they are read back and merged by tab id.")
  out.push("")
  out.push("**A tick records the lenses that existed when it was granted, not a clean bill.**")
  out.push("On 2026-08-11 two new lenses were applied for the first time — provenance (does a")
  out.push("label match the code behind it) and composite independence (can input A ever")
  out.push("disagree with input B). **Fourteen tabs that already carried ticks failed one or")
  out.push("both**: `insiders`, `market-sentiment`, `panic-euphoria`, `trend-analysis`,")
  out.push("`social-sentiment`, `jobs`, `fomc-predictions`, `earnings-calendar`,")
  out.push("`calendar-spread-scanner`, `risk-rewards`, `greeks`, `earnings-iv-crusher`,")
  out.push("`wheel-scanner`, `exit-rules` — see AUDIT_BACKLOG P6-38…P6-72. Every one of")
  out.push("those defects is now fixed, and rules 1-13 in `scripts/check-provenance.ts`")
  out.push("stop them returning. The point of this note is narrower and outlives them:")
  out.push("**a ☑ granted before a lens existed was never tested by it**, and the ledger")
  out.push("cannot show that on its own. Adding a lens means re-reading the ticks, not")
  out.push("trusting them.")
  out.push("")
  out.push(
    table(
      ["Tab", "data", "api", "math", "fb", "copy", "err", "mob", "size"],
      tabs.map((t) => [`\`${t.id}\``, ...(existingMarks.get(t.id) ?? Array(8).fill("☐"))]),
    ),
  )
  out.push("")
  if (newTabs.length > 0) {
    out.push(`_New since the last run, unverified: ${newTabs.map((t) => `\`${t}\``).join(", ")}._`)
    out.push("")
  }
  if (droppedTabs.length > 0) {
    // Say what was dropped rather than letting rows vanish silently — a tab
    // that disappears from the ledger is indistinguishable from one that was
    // never audited.
    out.push(`_Dropped (tab no longer exists): ${droppedTabs.map((t) => `\`${t}\``).join(", ")}._`)
    out.push("")
  }

  // 7. Client-side cache keys
  const withStorage = [...components, ...libs].filter((c) => c.storage.length)
  out.push("## 7. CLIENT-SIDE CACHE KEYS")
  out.push("")
  out.push("Stale-key cleanup is a known backlog item — every key here needs a version/expiry story.")
  out.push("")
  out.push(
    withStorage.length
      ? table(
          ["File", "Keys"],
          withStorage.map((c) => [`\`${c.file}\``, c.storage.map((k) => `\`${k}\``).join("<br>")]),
        )
      : "_None._",
  )
  out.push("")

  return out.join("\n")
}

// --------------------------------------------------------------------- main

const inventory = { tabs, routes, components, libs, orphanRoutes, oversized }

if (process.argv.includes("--check")) {
  // Verification mode: render into memory and compare, writing nothing.
  //
  // P6-78 is the reason this exists. `pnpm inventory` is run for its side
  // effect, its output is committed, and nothing ever looked at either — so a
  // parser bug that dropped the flagship tab (and its sign-off marks) went
  // unnoticed for three commits, surfacing only because a doc sweep happened to
  // compare two numbers by eye.
  //
  // Two things are asserted, and it is worth being clear about which failure
  // each one catches, because they are not the same:
  //
  //   1. SITE_MAP.md matches a fresh render — catches a STALE file, i.e. routes
  //      or components changed and nobody re-ran the generator, which is the
  //      rule CLAUDE.md states and nothing enforced.
  //   2. §1's tab list and §6's ledger agree — catches an ASYMMETRY between the
  //      two sections. Note this deliberately does NOT catch a silent drop:
  //      once the generator loses a tab it loses it from both sections, and a
  //      regenerate-and-diff would then call the smaller file correct. That
  //      failure is caught upstream, by the parser asserting its own match
  //      count against the source (see `parseTabs`). Recording the distinction
  //      because "we have a check for that" is exactly the false assurance this
  //      audit exists to remove.
  const DATE_LINE = /^> Generated by .* on \d{4}-\d{2}-\d{2}\./m
  const normalise = (s: string) => s.replace(DATE_LINE, "> Generated by <script> on <date>.").trimEnd()

  let failures = 0
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
    if (!ok) failures++
  }

  const committed = readFileSync(join(ROOT, "SITE_MAP.md"), "utf8")
  check(
    "SITE_MAP.md is up to date with the code",
    normalise(committed) === normalise(render()),
    normalise(committed) === normalise(render())
      ? `${routes.length} routes, ${components.length} components, ${tabs.length} tabs`
      : "run `pnpm inventory` and commit the result",
  )

  const ledgerIds = new Set(
    [...(committed.split("## 6. PHASE 6 SIGN-OFF LEDGER")[1] ?? "").split(/^## /m)[0].matchAll(/^\|\s*`([^`]+)`/gm)].map(
      (m) => m[1],
    ),
  )
  const tabIds = new Set(tabs.map((t) => t.id))
  const missingRows = [...tabIds].filter((id) => !ledgerIds.has(id))
  const orphanRows = [...ledgerIds].filter((id) => !tabIds.has(id))
  check(
    "every tab has a sign-off row and every row has a tab",
    missingRows.length === 0 && orphanRows.length === 0,
    missingRows.length || orphanRows.length
      ? `no row: ${missingRows.join(", ") || "none"}; no tab: ${orphanRows.join(", ") || "none"}`
      : `${ledgerIds.size} rows match ${tabIds.size} tabs`,
  )

  console.log(failures === 0 ? "\nSITE_MAP is current and internally consistent." : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
} else if (process.argv.includes("--json")) {
  console.log(JSON.stringify(inventory, null, 2))
} else {
  const target = join(ROOT, "SITE_MAP.md")
  writeFileSync(target, render(), "utf8")
  console.log(`SITE_MAP.md written: ${routes.length} routes, ${components.length} components, ${tabs.length} tabs`)
  const unknown = uniq(
    [...components, ...libs, ...routes].flatMap((f) => ("apiCalls" in f ? f.apiCalls : f.calls)),
  ).filter((p) => !knownRoutePaths.has(p))
  if (unknown.length) console.log(`WARN unresolved /api paths (dynamic or dead): ${unknown.join(", ")}`)
  if (orphanRoutes.length) console.log(`WARN ${orphanRoutes.length} routes have no in-repo consumer`)
}
