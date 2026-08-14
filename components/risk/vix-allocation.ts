/**
 * VIX bands and the allocation each one implies.
 *
 * ── WHOSE FRAMEWORK THIS IS ──────────────────────────────────────────────────
 * P7-77. The four cash bands below are Ryan Hildreth's ("Options With Ryan")
 * published VIX cash-allocation levels, adopted by owner decision 2026-08-14.
 * They are a DISCRETIONARY framework a named third party describes publicly —
 * not a backtested rule, not this site's own model, and not advice. Anything
 * rendering them must say so; the tab is a calculator for someone who has
 * already chosen to follow it.
 *
 * The site previously carried six bands of its own, and where they disagreed it
 * was more defensive — 20–25% cash at VIX 15–20 against his 15–25%, and 10–15%
 * at VIX 20–25 against his 5–10%. Those are gone rather than blended: a table
 * that cites a framework and then quietly holds different numbers is the
 * label-is-a-claim defect this audit exists to remove.
 *
 * ── INVESTED IS DERIVED, NOT STORED ──────────────────────────────────────────
 * The source states "15% to 25% in cash, deploying roughly 50% to 75% of the
 * portfolio" for the 15–20 band, and those two do not sum to 100. Rather than
 * pick one and bury the conflict, invested is computed as `100 − cash`, so the
 * pair cannot disagree. Storing one half of a complementary pair and deriving
 * the other is this project's standing rule.
 *
 * ── ONE CLASSIFICATION, AND IT IS NOW TRUE ───────────────────────────────────
 * The header this file carried until today claimed "ONE classification per
 * reading: `getVixLevel` decides the band and `getVixPortfolioAllocation` reads
 * off it." **That was false when written** — the second function carried its own
 * independent six-rung threshold ladder, so two ladders had to be kept in step
 * by hand. The comment was written during P6-13's split, copied from the panic
 * module where the claim IS true, without checking it against this file. It is
 * true here now: the allocation detail hangs off the band object, and
 * `getVixLevel` is the only place a VIX number becomes a band.
 *
 * Positions are shares/LEAPS/options/cash and diversification runs through
 * sectors and indexes — the house allocation rule, which is why no separate
 * asset class appears below.
 */

export interface VixAllocationDetail {
  stocks: string
  options: string
  leaps: string
  hedges: string
  /** Derived from the band's cashMin/cashMax; never typed separately. */
  cash: string
  description: string
  rationale: string[]
}

export interface VixLevel {
  range: string
  sentiment: string
  cashMin: number
  cashMax: number
  investedMin: number
  investedMax: number
  color: string
  optionsAction: string
  equityAction: string
  marginBufferPercent: number // Percentage of total cash for margin buffer
  opportunityPercent: number // Percentage of total cash for dip-buying
  allocation: Omit<VixAllocationDetail, "cash">
}

/**
 * The four bands, cash percentages exactly as the cited framework states them.
 *
 * `investedMin`/`investedMax` are filled in by the derivation below, never typed
 * here — see the header.
 */
const BANDS: Array<Omit<VixLevel, "investedMin" | "investedMax">> = [
  {
    range: "< 15",
    sentiment: "Greed / Low Fear",
    cashMin: 25,
    cashMax: 50,
    color: "text-green-600",
    optionsAction: "Defined-risk spreads; small size on short puts",
    equityAction: "Trim winners; wait for a pullback",
    marginBufferPercent: 50,
    opportunityPercent: 50,
    allocation: {
      stocks: "35-50%",
      options: "10-15%",
      leaps: "0-5%",
      hedges: "5-10%",
      description:
        "Complacent market. The framework holds the largest cash buffer here, and largest of all when the index is at an all-time high.",
      rationale: [
        "Cash is highest when fear is lowest — the buffer exists to be spent later, not now",
        "Limit options to defined-risk structures; premiums are thin and do not pay for naked risk",
        "Trim winners rather than add; this band is about having powder, not deploying it",
        "Defensive sector tilt (XLU/XLP) with index put hedges against a sudden reversal",
        "Keep LEAPS minimal — adding leverage at a complacent peak is the opposite of the band's purpose",
      ],
    },
  },
  {
    range: "15 - 20",
    sentiment: "Slight Fear / Normal",
    cashMin: 15,
    cashMax: 25,
    color: "text-yellow-600",
    optionsAction: "Regular put selling",
    equityAction: "Start scaling in on pullbacks",
    marginBufferPercent: 60,
    opportunityPercent: 40,
    allocation: {
      stocks: "50-60%",
      options: "15-20%",
      leaps: "5-10%",
      hedges: "3-5%",
      description: "Normal volatility. Regular put selling, with a working cash buffer still held back.",
      rationale: [
        "Healthy volatility supports routine put-selling without stretching size",
        "Begin scaling into quality names on minor pullbacks rather than all at once",
        "Premiums are adequate for income without requiring elevated risk",
        "Keep a tactical buffer — this band is the middle of the range, not the bottom",
        "Diversify across sectors and indexes rather than concentrating the deployment",
      ],
    },
  },
  {
    range: "20 - 30",
    sentiment: "Elevated Fear",
    cashMin: 5,
    cashMax: 10,
    color: "text-orange-600",
    optionsAction: "Scale up short puts; premiums are rich",
    equityAction: "Deploy the dip-buying reserve",
    marginBufferPercent: 80,
    opportunityPercent: 20,
    allocation: {
      stocks: "60-75%",
      options: "15-25%",
      leaps: "5-10%",
      hedges: "0-5%",
      description:
        "Mostly invested. The cash held back at lower VIX is spent here, and option premiums are the point of the band.",
      rationale: [
        "This is what the buffer was for — elevated fear is when the reserve gets deployed",
        "Short-put premiums expand materially; size up within a plan rather than opportunistically",
        "Buy quality on the way down in tranches, not in one decision",
        "Remaining cash is mostly margin buffer, not opportunity money",
        "Volatility is the income source in this band, not the risk to avoid",
      ],
    },
  },
  {
    range: "> 30",
    sentiment: "Market Panic",
    cashMin: 0,
    cashMax: 5,
    color: "text-red-600",
    optionsAction: "Ladder entries — premiums are extreme, so is the risk",
    equityAction: "Deploy what remains, in tranches",
    marginBufferPercent: 100,
    opportunityPercent: 0,
    allocation: {
      stocks: "70-85%",
      options: "20-30%",
      leaps: "5-10%",
      hedges: "0%",
      description: "Panic. Effectively fully invested, with cash kept only for margin.",
      rationale: [
        "Deploy in measured tranches; a laddered entry survives being early, a single one may not",
        "Premiums are at their richest and so is assignment risk — ladder rather than reach",
        "The framework's own guidance to add outside capital here is deliberately NOT implemented: bringing new money in is a different decision from rebalancing what is already invested",
        "What cash remains is for margin and liquidity, not for opportunity",
        "Panic bands are short-lived historically, but 'short-lived' is not a timeframe anyone can size a position against",
      ],
    },
  },
]

/**
 * The bands, with `invested` derived so it cannot drift from `cash`.
 */
export const VIX_LEVELS: VixLevel[] = BANDS.map((b) => ({
  ...b,
  investedMin: 100 - b.cashMax,
  investedMax: 100 - b.cashMin,
}))

/**
 * The only place a VIX reading becomes a band.
 *
 * BOUNDARIES ARE STATED, because the source's prose ("Below 15", "Between 15
 * and 20", "Between 20 and 30", "Above 30") does not settle what happens at
 * exactly 15, 20 or 30. The choice made here: a boundary reading belongs to the
 * CALMER band — 20.0 is "15 - 20", 30.0 is "20 - 30". An undocumented boundary
 * is a number nobody can reproduce.
 */
export function getVixLevel(vix: number): VixLevel {
  if (vix < 15) return VIX_LEVELS[0]
  if (vix <= 20) return VIX_LEVELS[1]
  if (vix <= 30) return VIX_LEVELS[2]
  return VIX_LEVELS[3]
}

/** The cash range as displayed, derived from the band so the two cannot disagree. */
export function cashRangeLabel(level: VixLevel): string {
  return `${level.cashMin}-${level.cashMax}%`
}

/**
 * Allocation detail for a reading — a LOOKUP on `getVixLevel`, not a second
 * threshold ladder. See the header for what this function used to be.
 */
export function getVixPortfolioAllocation(vixLevel: number): VixAllocationDetail {
  const level = getVixLevel(vixLevel)
  return { ...level.allocation, cash: cashRangeLabel(level) }
}
