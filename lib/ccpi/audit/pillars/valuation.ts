/**
 * Pillar 3 — Valuation & Market Structure.
 *
 * Split out of `components/ccpi-audit-admin.tsx` (P6-13) unchanged.
 */
import { PILLAR_WEIGHTS } from "@/lib/ccpi/scoring"
import { type PillarAudit, band, breach, fx, raw, src } from "../format"

export const buildValuationPillar = (ccpi: any, prov: any): PillarAudit => {
  const i = ccpi.indicators ?? {}
  const p = prov?.valuation ?? {}
  const APIFY = "Apify Yahoo Finance"
  return {
    name: "Pillar 3 - Valuation & Market Structure",
    weight: Math.round(PILLAR_WEIGHTS.valuation * 100),
    score: typeof ccpi.pillars?.valuation === "number" ? ccpi.pillars.valuation : null,
    scoredMax: typeof p.scoredMax === "number" ? p.scoredMax : null,
    liveMax: typeof p.liveMax === "number" ? p.liveMax : null,
    aiMax: typeof p.aiMax === "number" ? p.aiMax : null,
    excluded: Array.isArray(p.excluded) ? p.excluded : [],
    formula: "Valuation = (Raw Points / Scored Weight) × 100, renormalized over live/AI-backed indicators",
    calculation:
      "4 indicators with maxima summing to 100: S&P P/E (32), S&P P/S (21), Buffett Indicator (29), Equity Risk Premium (18). QQQ P/E, Mag7 Concentration and Shiller CAPE were dropped by P7-89 — LLM-only inputs that could never score.",
    executiveSummary:
      "Valuation pillar identifies bubble conditions and structural fragility. High earnings and sales multiples, an extreme Buffett reading and a thin equity risk premium signal overvalued markets vulnerable to sharp corrections.",
    validation: band(ccpi.pillars?.valuation, "🔴 BUBBLE TERRITORY", "🟡 OVERVALUED", "🟢 REASONABLE"),
    indicators: [
      {
        name: "S&P 500 Forward P/E",
        formula: "Valuation Multiple = Current Price / Next 12 Months Estimated Earnings",
        executiveSummary:
          "Forward P/E above 22 indicates expensive market; above 25 signals bubble risk. Historical average is ~16-18.",
        currentValue: fx(i.spxPE, 1),
        ranges: {
          safe: "Below 18 (undervalued)",
          warning: "18-25 (fair to expensive)",
          danger: "Above 25 (overvalued), >30 (bubble)",
        },
        dataSources: src(prov, "valuation", "spxPE", APIFY, ["FMP key-metrics"]),
        canaryThresholds: {
          medium: "P/E > 22",
          high: "P/E > 30 (extreme overvaluation)",
        },
      },
      {
        name: "S&P 500 Price-to-Sales",
        formula: "Revenue Multiple = Market Cap / Total Revenue",
        executiveSummary:
          "P/S above 2.5 indicates expensive market; above 3.0 signals bubble conditions. Less manipulable than P/E.",
        currentValue: fx(i.spxPS, 1),
        ranges: {
          safe: "Below 2.0",
          warning: "2.0-2.8",
          danger: "Above 2.8 (expensive if >3.5)",
        },
        dataSources: src(prov, "valuation", "spxPS", APIFY, ["FMP key-metrics"]),
        canaryThresholds: {
          medium: "P/S > 2.5",
          high: "P/S > 3.5 (extreme)",
        },
      },
      {
        name: "Buffett Indicator (Corporate Equities / GDP)",
        formula: "NCBEILQ027S (nonfinancial corporate equities, FRED) / GDP × 100 — see lib/ccpi/buffett-indicator.ts",
        executiveSummary:
          "The FRED basis adopted by P7-73a. Bands are percentile-matched to this series' own 55-year history (lib/ccpi/buffett-bands.ts), not to the retired total-market-cap scrape — the two bases are not interchangeable at a fixed threshold.",
        currentValue: fx(i.buffettIndicator, 0, { suffix: "%" }),
        ranges: {
          safe: "Below 120% (under the modern-era median)",
          warning: "120-195% (median to ~p90)",
          danger: "Above 195% (~p90), >210% (top 5% of readings since 1995)",
        },
        dataSources: src(prov, "valuation", "buffettIndicator", "FRED (store-first, live fallback)", [
          "AI fallback chain (display only — ai-estimate never scores)",
        ]),
        canaryThresholds: {
          medium: ">150%",
          high: ">210% (top band of the recalibrated ladder)",
        },
      },
      {
        name: "Equity Risk Premium (Earnings Yield - 10Y Treasury)",
        formula: "Stock vs Bond Attractiveness = (1 / S&P P/E × 100) - 10Y Treasury Yield",
        executiveSummary:
          "Negative or near-zero premiums mean bonds are more attractive than stocks. Below 2% signals stocks are overpriced relative to risk-free rates.",
        currentValue: fx(i.equityRiskPremium, 2, { suffix: "%" }),
        ranges: {
          safe: "Above 4% (stocks attractive)",
          warning: "2-4% (fair)",
          danger: "Below 2% (stocks overpriced), <0% (bonds dominate)",
        },
        dataSources: src(
          prov,
          "valuation",
          "equityRiskPremium",
          "Derived: S&P earnings yield − FRED 10Y (tier = weaker of the two)",
          [],
        ),
        canaryThresholds: {
          medium: "<3%",
          high: "<1.5% (severely overpriced)",
        },
      },
    ],
  }
}

