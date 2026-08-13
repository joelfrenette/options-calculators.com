/**
 * Trade legs read out of the human-readable setup string.
 *
 * Split out of `components/trade-walkthrough-modal.tsx` (P6-13) unchanged.
 *
 * It returns the legs for the ticket mockup plus the two key strikes when the
 * structure is a clean vertical — and returns them as-is when it is not, rather
 * than guessing a shape the string does not describe.
 */
import type { Leg, StrategyFlow } from "./strategy-flows"

// (for the ticket mockup) plus the two key strikes when it's a clean vertical.
export function parseSetup(setup: string, flow: StrategyFlow) {
  const text = setup
  const isPut = /put/i.test(text) && !/call/i.test(text)
  const baseRight: Leg["right"] = /put/i.test(text) ? "PUT" : "CALL"

  // Pull every number out of the string (strikes).
  const nums = (text.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter((n) => n > 0)

  let shortStrike: number | null = null
  let longStrike: number | null = null
  let width = 0
  const legs: Leg[] = []

  // Iron-condor style "550/545 – 580/585": a put spread below price and a call
  // spread above it. Two slash-pairs of strikes → four legs. Handled before the
  // generic vertical branch, which would otherwise misread the first two numbers
  // as a 2-leg call vertical.
  const condor = text.match(
    /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/,
  )
  // Explicit "Buy ... Sell ..." phrasing (collars, diagonals).
  const explicit = text.match(/(buy|sell)\s+[^,]*?(\d+(?:\.\d+)?)\s*(put|call|p|c)?/gi)
  if (condor) {
    // Sort the four strikes: lowest two form the put wing, highest two the call wing.
    const sorted = [Number(condor[1]), Number(condor[2]), Number(condor[3]), Number(condor[4])].sort((a, b) => a - b)
    const [putLong, putShort, callShort, callLong] = sorted
    width = Math.max(putShort - putLong, callLong - callShort)
    legs.push({ side: "SELL", qty: 1, strike: putShort, right: "PUT", label: `Sell ${putShort} PUT` })
    legs.push({ side: "BUY", qty: 1, strike: putLong, right: "PUT", label: `Buy ${putLong} PUT` })
    legs.push({ side: "SELL", qty: 1, strike: callShort, right: "CALL", label: `Sell ${callShort} CALL` })
    legs.push({ side: "BUY", qty: 1, strike: callLong, right: "CALL", label: `Buy ${callLong} CALL` })
    // Leave shortStrike/longStrike null: the 2-leg vertical chain mockup does not
    // apply — the generic chain screen renders all four legs instead.
  } else if (explicit && explicit.length >= 2) {
    explicit.forEach((seg) => {
      const side = /buy/i.test(seg) ? "BUY" : "SELL"
      const strikeMatch = seg.match(/(\d+(?:\.\d+)?)/)
      const strike = strikeMatch ? Number(strikeMatch[1]) : null
      const right: Leg["right"] = /put|p\b/i.test(seg) ? "PUT" : /call|c\b/i.test(seg) ? "CALL" : baseRight
      legs.push({ side, qty: 1, strike, right, label: seg.trim().replace(/\s+/g, " ") })
    })
  } else if (flow.vertical && nums.length >= 2) {
    // Vertical: sell the strike nearer the money, buy the protective wing.
    const a = nums[0]
    const b = nums[1]
    if (isPut) {
      shortStrike = Math.max(a, b)
      longStrike = Math.min(a, b)
    } else {
      shortStrike = Math.min(a, b)
      longStrike = Math.max(a, b)
    }
    width = Math.abs(a - b)
    legs.push({ side: "SELL", qty: 1, strike: shortStrike, right: baseRight, label: `Sell ${shortStrike} ${baseRight}` })
    legs.push({ side: "BUY", qty: 1, strike: longStrike, right: baseRight, label: `Buy ${longStrike} ${baseRight}` })
  } else {
    // Generic: just present the setup text as the order to build.
    shortStrike = nums[0] ?? null
    longStrike = nums[1] ?? null
    width = nums.length >= 2 ? Math.abs(nums[0] - nums[1]) : 0
  }

  return { shortStrike, longStrike, width, right: baseRight, isPut, legs, nums }
}
