// Research Queue — the DECIDE step (RESEARCH_QUEUE_DESIGN.md).
//
// Strategy SELECTION is deterministic, following the documented selection logic
// of the owner's TradingAgents options_strategist (Apache-2.0): premium selling
// gated on IV, direction from the rating, covered calls only with shares,
// NO_TRADE for bearish reads rather than an invented bearish structure. That
// keeps the choice auditable — the same inputs always yield the same strategy.
//
// Opus 5 then writes the RATIONALE over the computed numbers (lib/ai-providers).
// It never picks the strategy or invents a number; if it is unavailable, a
// deterministic rationale is used, so the feature works with or without it.

import { generateWithFallback } from "@/lib/ai-providers"
import type { OptionsRecommendation, OptionsStrategy, PortfolioRating, WheelProfile } from "./types"
import type { ComputedNumbers } from "./compute"

interface Selection {
  strategy: OptionsStrategy
  fitScore: 1 | 2 | 3 | 4 | 5
  riskFlags: string[]
}

/** Premium selling is only honest when IV is elevated (the strategist's IV gate). */
function ivFavoursSelling(n: ComputedNumbers, profile: WheelProfile): boolean {
  return n.ivRank !== null && n.ivRank >= profile.minIvRankForPremiumSale
}

function selectStrategy(
  rating: PortfolioRating,
  n: ComputedNumbers,
  profile: WheelProfile,
  sharesHeld: number,
): Selection {
  const flags: string[] = []
  if (n.atmIvPct === null) flags.push("no options IV available — pricing withheld")
  if (n.ivRank !== null && n.ivRank < profile.minIvRankForPremiumSale)
    flags.push(`IV rank ${n.ivRank} below your ${profile.minIvRankForPremiumSale} premium-selling floor (estimate)`)
  const sells = ivFavoursSelling(n, profile)

  // Bearish reads: never invent a bullish premium sale. With shares, the honest
  // answer is trim/exit, not an options income play.
  if (rating === "Sell") {
    flags.push(sharesHeld > 0 ? "you hold shares into a downtrend — consider trimming or exiting" : "downtrend — no premium-selling setup")
    return { strategy: "NO_TRADE", fitScore: sharesHeld > 0 ? 2 : 1, riskFlags: flags }
  }

  // Holding shares: covered call for income (unless strongly bullish, where you
  // would not want to cap upside).
  if (sharesHeld > 0) {
    if (rating === "Buy") {
      flags.push("strongly bullish while holding — a covered call caps upside; consider holding or adding a LEAPS instead")
      return { strategy: sells ? "CC" : "NO_TRADE", fitScore: 3, riskFlags: flags }
    }
    if (sells && n.ccStrike !== null) return { strategy: "CC", fitScore: 4, riskFlags: flags }
    flags.push("IV too low to sell a worthwhile covered call")
    return { strategy: "NO_TRADE", fitScore: 2, riskFlags: flags }
  }

  // No shares. Bullish/constructive: get paid to enter (CSP) when IV cooperates,
  // else a LEAPS (a debit structure, not premium selling).
  if (rating === "Buy" || rating === "Overweight") {
    if (sells && n.cspCredit !== null) return { strategy: "CSP", fitScore: rating === "Overweight" ? 5 : 4, riskFlags: flags }
    if (n.leapsStrike !== null) return { strategy: "LEAPS", fitScore: 4, riskFlags: flags }
    return { strategy: "NO_TRADE", fitScore: 2, riskFlags: flags }
  }

  // Hold: sell a put ONLY if IV is rich (get paid for a possible entry); else wait.
  if (rating === "Hold") {
    if (sells && n.cspCredit !== null) return { strategy: "CSP", fitScore: 3, riskFlags: flags }
    flags.push("neutral read and unremarkable IV — waiting beats forcing a trade")
    return { strategy: "NO_TRADE", fitScore: 2, riskFlags: flags }
  }

  // Underweight (mild pullback, below 200-DMA): a LEAPS on a further dip is the
  // patient play; a CSP only if IV is genuinely rich.
  if (sells && n.cspCredit !== null) return { strategy: "CSP", fitScore: 3, riskFlags: flags }
  if (n.leapsStrike !== null) return { strategy: "LEAPS", fitScore: 3, riskFlags: flags }
  return { strategy: "NO_TRADE", fitScore: 2, riskFlags: flags }
}

/** Templated management plan + defined-risk alternative, by strategy. */
function mechanics(strategy: OptionsStrategy): { management: string; alt: string } {
  switch (strategy) {
    case "CSP":
      return {
        management: "Take profit at ~50% of max credit; defend or roll at ~21 DTE; if assigned, sell 30–45 DTE covered calls against the shares (run the wheel).",
        alt: "A put credit spread (buy a lower put) for the same directional view at a fraction of the buying power, with defined max loss.",
      }
    case "CC":
      return {
        management: "Take profit at ~50%; roll up-and-out if the stock runs to the strike before ~21 DTE; let it be called away only above your basis.",
        alt: "Sell a further-OTM call (lower delta) for less premium but more room, or a call credit spread if you want defined risk on the short leg.",
      }
    case "LEAPS":
      return {
        management: "Buy on the pullback trigger; treat as stock replacement; consider selling short calls against it (PMCC) once you hold it.",
        alt: "A vertical call debit spread for less capital, or simply a smaller share position.",
      }
    case "PMCC":
      return { management: "Sell 30–45 DTE calls against the LEAPS; keep the short strike above the LEAPS strike + debit.", alt: "A standard covered call if you own the shares outright." }
    case "LONG_CALL":
      return { management: "Defined risk to the debit paid; take profit into strength; time decay works against you, so give it room on DTE.", alt: "A call debit spread to cut the cost and define the target." }
    default:
      return { management: "No position recommended. Re-check when the trend or IV changes.", alt: "—" }
  }
}

/** Assemble the recommendation. `narrate` optionally replaces the rationale via Opus 5. */
export async function decide(
  ticker: string,
  n: ComputedNumbers,
  rating: PortfolioRating,
  ratingBasis: string,
  profile: WheelProfile,
  sharesHeld: number,
): Promise<OptionsRecommendation> {
  const sel = selectStrategy(rating, n, profile, sharesHeld)
  const mech = mechanics(sel.strategy)

  const base: OptionsRecommendation = {
    ticker,
    strategy: sel.strategy,
    fitScore: sel.fitScore,
    riskFlags: sel.riskFlags,
    rationale: deterministicRationale(ticker, sel.strategy, n, rating),
    price: n.price,
    asOf: n.asOf,
    atmIvPct: n.atmIvPct,
    ivRank: n.ivRank,
    ivRankIsEstimate: n.ivRankIsEstimate,
    ivRankNote: n.ivRankNote,
    cspStrikeLow: n.cspStrikeLow,
    cspStrikeHigh: n.cspStrikeHigh,
    cspDte: n.cspDte,
    cspCredit: n.cspCredit,
    cspProbabilityOfProfit: n.cspProbabilityOfProfit,
    cspBreakeven: n.cspBreakeven,
    cspAnnualizedReturnPct: n.cspAnnualizedReturnPct,
    cspCapitalRequired: n.cspCapitalRequired,
    leapsStrike: n.leapsStrike,
    leapsDte: n.leapsDte,
    leapsBuyBelowPrice: n.leapsBuyBelowPrice,
    ccStrike: n.ccStrike,
    ccCredit: n.ccCredit,
    managementPlan: mech.management,
    definedRiskAlternative: mech.alt,
    rating,
    ratingBasis,
  }

  const llm = await narrate(base).catch(() => null)
  if (llm) base.rationale = llm
  return base
}

function deterministicRationale(ticker: string, strategy: OptionsStrategy, n: ComputedNumbers, rating: PortfolioRating): string {
  if (strategy === "NO_TRADE") return `${ticker}: no options setup fits a ${rating} read with the current IV. Wait for the trend or premium to improve.`
  if (strategy === "CSP") return `${ticker} rates ${rating}; sell puts in the $${n.cspStrikeLow}–$${n.cspStrikeHigh} band (~${n.cspDte} DTE) to be paid to enter at a discount.`
  if (strategy === "LEAPS") return `${ticker} rates ${rating}; buy a ${n.leapsDte}-day ~0.75Δ call as a stock replacement if it drops to ~$${n.leapsBuyBelowPrice}.`
  if (strategy === "CC") return `${ticker}: sell covered calls at ~$${n.ccStrike} against the shares for income while the read is ${rating}.`
  return `${ticker}: ${strategy} recommended on a ${rating} read.`
}

/**
 * Opus 5 writes the rationale over the COMPUTED numbers. The prompt hands it the
 * numbers and the chosen strategy and asks ONLY for prose — it cannot change the
 * strategy or the figures. JSON-free: we want a paragraph, so we take the text.
 */
async function narrate(rec: OptionsRecommendation): Promise<string | null> {
  const facts = [
    `Ticker: ${rec.ticker}`,
    `Directional rating: ${rec.rating} (${rec.ratingBasis})`,
    `Chosen strategy: ${rec.strategy}`,
    rec.price !== null ? `Price: $${rec.price}` : null,
    rec.atmIvPct !== null ? `ATM IV: ${rec.atmIvPct}%` : null,
    rec.ivRank !== null ? `IV rank: ${rec.ivRank}${rec.ivRankIsEstimate ? " (estimate)" : ""}` : null,
    rec.cspStrikeLow !== null ? `CSP band: $${rec.cspStrikeLow}–$${rec.cspStrikeHigh}, ~${rec.cspDte} DTE, credit ~$${rec.cspCredit}, POP ~${rec.cspProbabilityOfProfit}%, breakeven $${rec.cspBreakeven}, annualized ~${rec.cspAnnualizedReturnPct}%` : null,
    rec.leapsStrike !== null ? `LEAPS: ~$${rec.leapsStrike} strike, ${rec.leapsDte} DTE, buy below ~$${rec.leapsBuyBelowPrice}` : null,
    rec.ccStrike !== null ? `Covered call: ~$${rec.ccStrike}, credit ~$${rec.ccCredit}` : null,
    rec.riskFlags.length ? `Risk flags: ${rec.riskFlags.join("; ")}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const prompt = `You are an options strategist for a premium seller running the wheel and buying LEAPS. Below are COMPUTED facts for one ticker and the strategy already selected by rules. Write a tight 2–4 sentence rationale for that strategy. Use ONLY these numbers — do not invent prices, IV, or levels, and do not change the strategy. Be concrete and practical.

${facts}

Rationale:`

  try {
    const result = await generateWithFallback({
      prompt,
      temperature: 0.4,
      maxTokens: 220,
      routeTag: "research-queue",
    })
    const text = result.text.trim()
    return text.length > 0 ? text : null
  } catch {
    return null
  }
}
