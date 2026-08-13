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
      "7 indicators with maxima summing to 100: S&P P/E (18), S&P P/S (12), Buffett Indicator (16), QQQ P/E (16), Mag7 Concentration (15), Shiller CAPE (13), Equity Risk Premium (10).",
    executiveSummary:
      "Valuation pillar identifies bubble conditions and structural fragility. High P/E ratios, extreme concentration in Mag7, and negative equity risk premiums signal overvalued markets vulnerable to sharp corrections.",
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
        name: "Buffett Indicator (Market Cap / GDP)",
        formula: "Total Market Valuation = Wilshire 5000 Market Cap / US GDP × 100",
        executiveSummary:
          "Warren Buffett's favorite metric. Above 120% is fairly valued; above 150% is overvalued; above 200% is bubble territory.",
        currentValue: fx(i.buffettIndicator, 0, { suffix: "%" }),
        ranges: {
          safe: "Below 100% (undervalued)",
          warning: "100-150% (fairly valued)",
          danger: "Above 150% (overvalued), >180% (bubble)",
        },
        dataSources: src(prov, "valuation", "buffettIndicator", "ScrapingBee scrape", [
          "AI fallback chain (lib/unified-ai-fallback.ts)",
        ]),
        canaryThresholds: {
          medium: ">150%",
          high: ">180% (significantly overvalued)",
        },
      },
      {
        name: "QQQ Forward P/E (AI-Specific Valuation)",
        formula: "Tech Valuation = QQQ Price / Weighted Average Forward Earnings",
        executiveSummary:
          "QQQ P/E above 30 indicates AI/tech bubble; above 40 signals extreme speculation. More sensitive than S&P 500.",
        currentValue: fx(i.qqqPE, 1),
        ranges: {
          safe: "Below 25",
          warning: "25-35",
          danger: "Above 35 (bubble if >40)",
        },
        dataSources: src(
          prov,
          "valuation",
          "qqqPE",
          "AI fallback chain (lib/unified-ai-fallback.ts) — no live provider is wired for QQQ P/E",
          [],
        ),
        canaryThresholds: {
          medium: ">30",
          high: ">40 (AI bubble territory)",
        },
      },
      {
        name: "Magnificent 7 Concentration (Crash Contagion Risk)",
        formula:
          "Top-Heavy Risk = (AAPL + MSFT + GOOGL + AMZN + NVDA + META + TSLA Market Cap) / Total QQQ Market Cap × 100",
        executiveSummary:
          "Extreme concentration amplifies crash risk. If Mag7 falls, entire index collapses. Above 60% is dangerous top-heaviness.",
        currentValue: fx(i.mag7Concentration, 1, { suffix: "%" }),
        ranges: {
          safe: "Below 45% (diversified)",
          warning: "45-55%",
          danger: "Above 55% (concentrated), >60% (extreme)",
        },
        dataSources: src(
          prov,
          "valuation",
          "mag7Concentration",
          "AI fallback chain (lib/unified-ai-fallback.ts) — no live provider is wired for Mag7 weight",
          [],
        ),
        canaryThresholds: {
          medium: ">50%",
          high: ">60% (severe concentration risk)",
        },
      },
      {
        name: "Shiller CAPE Ratio (10-Year Cyclical Valuation)",
        formula: "Cyclically-Adjusted P/E = Price / 10-Year Average Inflation-Adjusted Earnings",
        executiveSummary:
          "CAPE above 30 has historically preceded major market declines. Smooths earnings volatility for long-term valuation view.",
        currentValue: fx(i.shillerCAPE, 1),
        ranges: {
          safe: "Below 20 (historical average ~16)",
          warning: "20-30",
          danger: "Above 30 (overvalued), >35 (extreme)",
        },
        dataSources: src(
          prov,
          "valuation",
          "shillerCAPE",
          "AI fallback chain (lib/unified-ai-fallback.ts) — no live provider is wired for CAPE",
          [],
        ),
        canaryThresholds: {
          medium: ">28",
          high: ">35 (historic overvaluation)",
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

