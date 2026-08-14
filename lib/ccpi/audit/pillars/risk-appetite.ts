/**
 * Pillar 2 — Risk Appetite & Sentiment.
 *
 * Split out of `components/ccpi-audit-admin.tsx` (P6-13) unchanged.
 */
import { PILLAR_WEIGHTS } from "@/lib/ccpi/scoring"
import { type PillarAudit, band, breach, fx, raw, src } from "../format"

export const buildRiskAppetitePillar = (ccpi: any, prov: any): PillarAudit => {
  const i = ccpi.indicators ?? {}
  const p = prov?.riskAppetite ?? {}
  return {
    name: "Pillar 2 - Risk Appetite & Sentiment",
    weight: Math.round(PILLAR_WEIGHTS.riskAppetite * 100),
    score: typeof ccpi.pillars?.riskAppetite === "number" ? ccpi.pillars.riskAppetite : null,
    scoredMax: typeof p.scoredMax === "number" ? p.scoredMax : null,
    liveMax: typeof p.liveMax === "number" ? p.liveMax : null,
    aiMax: typeof p.aiMax === "number" ? p.aiMax : null,
    excluded: Array.isArray(p.excluded) ? p.excluded : [],
    formula: "Risk Appetite = (Raw Points / Scored Weight) × 100, renormalized over live/AI-backed indicators",
    calculation:
      "3 indicators with maxima summing to 100: Put/Call (37), Fear & Greed (30), AAII Bullish (33). Short Interest (21) was dropped by P7-89 â€” its only source was an LLM, so it could never score. A null Fear & Greed is excluded AND renormalized rather than silently deflating the pillar.",
    executiveSummary:
      "Risk appetite pillar detects euphoria (complacency) and panic (capitulation) through sentiment and positioning indicators. Low put/call ratios and high bullish sentiment signal dangerous complacency, while extreme fear can be contrarian opportunity.",
    validation: band(ccpi.pillars?.riskAppetite, "🔴 EXTREME COMPLACENCY", "🟡 ELEVATED RISK", "🟢 HEALTHY"),
    indicators: [
      {
        name: "Put/Call Ratio",
        formula: "Hedging Activity = Put Options Volume / Call Options Volume",
        executiveSummary:
          "Measures market hedging behavior. Ratios below 0.7 signal complacency (too few hedges), above 1.3 signals panic.",
        currentValue: fx(i.putCallRatio, 2),
        ranges: {
          safe: "0.85-1.10 (balanced hedging)",
          warning: "0.70-0.85 or 1.10-1.30",
          danger: "Below 0.70 (complacency) or Above 1.30 (panic)",
        },
        dataSources: src(prov, "riskAppetite", "putCallRatio", "ScrapingBee scrape", [
          "AI fallback chain (lib/unified-ai-fallback.ts)",
        ]),
        canaryThresholds: {
          medium: "<0.85 or >1.10",
          high: "<0.60 (extreme complacency) or >1.30 (panic)",
        },
      },
      {
        name: "Fear & Greed Index",
        formula:
          "CNN Composite: 7 indicators (Market Momentum [S&P vs 125-MA], Stock Strength [52-wk highs/lows], Breadth [McClellan Vol], Put/Call [5-day avg], VIX [vs 50-MA], Safe Haven [stock vs bond 20d], Junk Bond [HY spread])",
        executiveSummary:
          "CNN's official 7-indicator equity sentiment composite. Scores 0-24 = Extreme Fear, 75-100 = Extreme Greed. Equal-weighted and updated continuously during market hours. (The crypto Fear & Greed index that previously stood in for it was replaced in the provenance rework.)",
        currentValue: raw(i.fearGreedIndex ?? null),
        ranges: {
          safe: "45-55 (neutral - balanced market)",
          warning: "25-44 (fear - cautious) or 56-74 (greed - elevated)",
          danger: "0-24 (extreme fear - max opportunity) or 75-100 (extreme greed - correction risk)",
        },
        dataSources: {
          ...src(
            prov,
            "riskAppetite",
            "fearGreedIndex",
            "CNN Fear & Greed API (production.dataviz.cnn.io/index/fearandgreed/graphdata)",
            [],
          ),
          updateFrequency: "Continuous during market hours",
          methodology:
            "Each of 7 indicators scores 0-100 independently, then averaged with equal weighting against historical ranges.",
        },
        canaryThresholds: {
          medium: "Score >70 (greed building) or <30 (fear building)",
          high: "Score >80 (extreme greed - contrarian sell signal) or <20 (extreme fear - contrarian buy signal)",
        },
      },
      {
        name: "AAII Bullish Sentiment",
        formula: "Retail Optimism = % of AAII members bullish on stocks (6-month outlook)",
        executiveSummary:
          "Retail investor sentiment survey. Values above 50% indicate excessive optimism; sustained highs precede corrections.",
        currentValue: fx(i.aaiiBullish, 1, { suffix: "%" }),
        ranges: {
          safe: "30-45% (historical average ~38%)",
          warning: "45-55%",
          danger: "Above 55% (retail euphoria) or Below 25% (capitulation)",
        },
        dataSources: src(prov, "riskAppetite", "aaiiBullish", "ScrapingBee scrape", [
          "AI fallback chain (lib/unified-ai-fallback.ts)",
        ]),
        canaryThresholds: {
          medium: ">45% or <30%",
          high: ">55% (euphoria warning)",
        },
      },
    ],
  }
}

