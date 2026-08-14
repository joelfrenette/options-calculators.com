// P7-73 ANALYSIS (not a check — network in, judgement out): the numbers behind
// CCPI_DESIGN.md §8b. Recomputes the FRED-basis Buffett series, its
// percentiles, the episode entries and the candidate-band lead times.
//
// Run: node scripts/analysis-buffett-bands.mjs [dir-with-csvs]
//
// Inputs are two keyless public downloads (quarterly):
//   https://fred.stlouisfed.org/graph/fredgraph.csv?id=NCBEILQ027S&cosd=1970-01-01
//   https://fred.stlouisfed.org/graph/fredgraph.csv?id=GDP&cosd=1970-01-01
// The script fetches them itself; if outbound TLS is intercepted on your
// machine (this project's workstation resets node fetch to this host — see
// [[tooling-gotchas]]), curl both into a directory and pass it as the
// argument.
//
// The ^DWCF translation this file once also computed is deliberately GONE: a
// full-cap PRICE index misses net issuance, and scaled to today it put the
// March-2000 top at 114% against the documented ~140% — it fails its own
// landmark check. §8b records that so nobody re-tries it.
import { readFileSync } from "node:fs"

const DIR = process.argv[2] ?? null

function parseCsv(text, id) {
  const lines = text.trim().split(/\r?\n/)
  if (!/observation_date|DATE/i.test(lines[0])) throw new Error(`${id}: unexpected header ${lines[0].slice(0, 60)}`)
  const out = new Map()
  for (const line of lines.slice(1)) {
    const [date, raw] = line.split(",")
    const v = Number(raw)
    if (raw !== "." && Number.isFinite(v)) out.set(date, v)
  }
  return out
}

async function series(id) {
  if (DIR) return parseCsv(readFileSync(`${DIR}/${id}.csv`, "utf8"), id)
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=1970-01-01`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  })
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`)
  return parseCsv(await res.text(), id)
}

let eq, gdp
try {
  ;[eq, gdp] = await Promise.all([series("NCBEILQ027S"), series("GDP")])
} catch (e) {
  console.log("FETCH FAILED:", e.message, e.cause?.code ?? "", "— curl the two URLs in the header into a dir and pass it as argv[2]")
  process.exit(3)
}

// FRED-basis ratio (percent), quarterly.
const fred = []
for (const [date, e] of eq) {
  const g = gdp.get(date)
  if (g !== undefined) fred.push({ date, v: (e / 1000 / g) * 100 })
}
fred.sort((a, b) => a.date.localeCompare(b.date))

// FRED-basis percentiles.
function pct(sorted, p) {
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i), hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}
for (const since of ["1970-01-01", "1995-01-01", "2000-01-01"]) {
  const vals = fred.filter((r) => r.date >= since).map((r) => r.v).sort((x, y) => x - y)
  console.log(`\nfred-basis percentiles since ${since.slice(0, 4)} (n=${vals.length}): ` +
    [0.5, 0.75, 0.9, 0.95].map((p) => `p${p * 100}=${pct(vals, p).toFixed(1)}`).join("  "))
}

// Episode readings and lead-time for candidate top bands on the FRED basis.
const CRASHES = [
  ["2000-03", "dot-com top"],
  ["2007-10", "GFC top"],
  ["2020-02", "covid crash"],
  ["2022-01", "2022 bear"],
]
console.log("\nreadings entering each episode (last quarterly obs strictly before the start month):")
for (const [ym, label] of CRASHES) {
  const last = fred.filter((r) => r.date < `${ym}-01`).at(-1)
  console.log(`  ${label}: fred-basis ${last.v.toFixed(1)} @ ${last.date}`)
}

function leadCheck(topBand) {
  const first = CRASHES.map(([ym]) => {
    const from = `${Number(ym.slice(0, 4)) - 3}-${ym.slice(5)}-01`
    const hit = fred.find((r) => r.date >= from && r.date < `${ym}-01` && r.v > topBand)
    return hit ? `${hit.date}(${hit.v.toFixed(0)})` : "never"
  })
  const windows = CRASHES.map(([ym]) => [`${Number(ym.slice(0, 4)) - 3}-${ym.slice(5)}-01`, `${ym}-31`])
  const outside = fred.filter((r) => r.date >= "1995-01-01" && r.v > topBand && !windows.some(([a, b]) => r.date >= a && r.date <= b))
  return { firstCross: first, qtrsAboveOutside3yWindows: outside.length, sample: outside.slice(0, 10).map((r) => r.date) }
}
// The proposed ladder's top two rungs (§8b) plus the old scraped-basis top
// cutoff for comparison.
for (const band of [195, 200, 210]) console.log(`\nfred-basis band >${band}:`, JSON.stringify(leadCheck(band)))

console.log("\nlatest fred-basis:", fred.at(-1))
