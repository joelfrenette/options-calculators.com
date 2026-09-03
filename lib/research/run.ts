// Research Queue — the orchestrator. COMPUTE → RATE → DECIDE.
//
// Thin on purpose: each step is its own audited module. This is the single
// entry point the route and (Phase 3) the nightly cron call.

import { computeNumbers } from "./compute"
import { rateTicker } from "./rate"
import { decide } from "./strategist"
import type { OptionsRecommendation, WheelProfile } from "./types"

export async function researchTicker(
  ticker: string,
  profile: WheelProfile,
  sharesHeld: number,
): Promise<OptionsRecommendation> {
  const numbers = await computeNumbers(ticker, profile, sharesHeld)
  const { rating, basis } = rateTicker(numbers)
  return decide(ticker, numbers, rating, basis, profile, sharesHeld)
}
