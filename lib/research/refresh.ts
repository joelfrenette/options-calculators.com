// Research Queue — the nightly refresh + morning recap (RESEARCH_QUEUE_DESIGN.md
// §Phase 3). Re-researches every non-archived, non-paused queued ticker (capped
// per owner), collects the overnight deltas, writes each owner's recap, and
// emails it when something changed. Run by /api/cron/research-refresh.
//
// Bounded three ways so the nightly cost and wall-clock stay predictable:
//   - MAX_PER_OWNER caps how many tickers an owner's queue can research a night;
//   - a soft deadline stops starting new work before Vercel's 300s function cap
//     (partial progress persists — each saveRecommendation commits on its own);
//   - the budget guard still caps total LLM spend upstream.

import { listActiveForRefresh, getProfile, setStatus, saveRecommendation, saveRecap } from "./store"
import { researchTicker } from "./run"
import { tickerDeltas, narrateRecap } from "./recap"
import { sendRecapEmail } from "./recap-email"
import type { RecapItem, ResearchRow } from "./types"

const MAX_PER_OWNER = 50
const SOFT_DEADLINE_MS = 270_000 // leave headroom under the route's maxDuration=300

export interface RefreshResult {
  owners: number
  tickersResearched: number
  tickersFailed: number
  recapsWritten: number
  emailsSent: number
  timedOut: boolean
}

export async function runResearchRefresh(): Promise<RefreshResult> {
  const start = Date.now()
  const res: RefreshResult = {
    owners: 0,
    tickersResearched: 0,
    tickersFailed: 0,
    recapsWritten: 0,
    emailsSent: 0,
    timedOut: false,
  }

  const rows = await listActiveForRefresh()

  // Group by owner, capping each queue at MAX_PER_OWNER (rows arrive oldest-first).
  const byOwner = new Map<string, ResearchRow[]>()
  for (const r of rows) {
    const list = byOwner.get(r.ownerEmail) ?? []
    if (list.length < MAX_PER_OWNER) list.push(r)
    byOwner.set(r.ownerEmail, list)
  }
  res.owners = byOwner.size

  for (const [email, list] of byOwner) {
    const profile = await getProfile(email)
    const items: RecapItem[] = []
    let researchedForOwner = 0

    for (const row of list) {
      if (Date.now() - start > SOFT_DEADLINE_MS) {
        res.timedOut = true
        break
      }
      const prev = row.recommendation // yesterday's read, or null on a first research
      try {
        await setStatus(row.id, email, "researching")
        const rec = await researchTicker(row.ticker, profile, row.sharesHeld)
        const saved = await saveRecommendation(row.id, email, rec, prev)
        if (!saved) {
          await setStatus(row.id, email, "failed")
          res.tickersFailed++
          continue
        }
        res.tickersResearched++
        researchedForOwner++
        items.push(...tickerDeltas(row.ticker, rec, prev))
      } catch {
        await setStatus(row.id, email, "failed")
        res.tickersFailed++
      }
    }

    // Write the recap for this owner even when nothing changed (the tab shows the
    // latest state, "No changes overnight" included). Email only when something
    // changed, so the inbox is signal, not a nightly heartbeat.
    const { summary, isLlm } = await narrateRecap(items, researchedForOwner)
    if (await saveRecap(email, { summary, items, isLlm })) res.recapsWritten++
    if (items.length > 0 && (await sendRecapEmail(email, summary, items))) res.emailsSent++

    if (res.timedOut) break
  }

  return res
}
