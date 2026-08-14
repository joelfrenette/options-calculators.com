/**
 * Pillar 4 — Macro.
 *
 * Split out of `components/ccpi-audit-admin.tsx` (P6-13) unchanged.
 */
import { PILLAR_WEIGHTS } from "@/lib/ccpi/scoring"
import { type PillarAudit, band, breach, fx, raw, src } from "../format"

export const buildMacroPillar = (ccpi: any, prov: any): PillarAudit => {
  const i = ccpi.indicators ?? {}
  const p = prov?.macro ?? {}
  const FRED = "FRED API"
  return {
    name: "Pillar 4 - Macro",
    weight: Math.round(PILLAR_WEIGHTS.macro * 100),
    score: typeof ccpi.pillars?.macro === "number" ? ccpi.pillars.macro : null,
    scoredMax: typeof p.scoredMax === "number" ? p.scoredMax : null,
    liveMax: typeof p.liveMax === "number" ? p.liveMax : null,
    aiMax: typeof p.aiMax === "number" ? p.aiMax : null,
    excluded: Array.isArray(p.excluded) ? p.excluded : [],
    formula: "Macro = (Raw Points / Scored Weight) × 100, renormalized over live/AI-backed indicators",
    calculation:
      "6 indicators with maxima summing to 100: DXY Dollar Index (17), Fed Funds Rate (21), Fed Reverse Repo (15), Junk Bond Spread (14), US Debt-to-GDP (14), Yield Curve (19). TED Spread (13) was retired by P7-87 — FRED discontinued the series in 2022 — and ISM PMI (15) was dropped by P7-89 as LLM-only. The 10Y-2Y yield curve is scored once, here — its former duplicates in Pillars 1 and 2 and the crash-amplifier bonus were removed.",
    executiveSummary:
      "Macro pillar captures systemic economic and financial conditions. Policy tightness (Fed funds), credit stress (junk spreads) and curve inversion signal macro headwinds that can trigger crashes.",
    validation: band(ccpi.pillars?.macro, "🔴 MACRO CRISIS", "🟡 RESTRICTIVE", "🟢 STABLE"),
    indicators: [
      {
        name: "US Dollar Index (DXY) - Tech Headwind",
        formula: "Dollar Strength = Weighted basket vs EUR, JPY, GBP, CAD, SEK, CHF",
        executiveSummary:
          "Strong dollar (>110) hurts tech earnings from overseas and tightens global financial conditions. Dollar rallies often precede crashes.",
        currentValue: fx(i.dxyIndex, 1),
        ranges: {
          safe: "Below 100 (weak dollar helps tech)",
          warning: "100-110 (normal range)",
          danger: "Above 110 (strong dollar hurts tech), >115 (extreme)",
        },
        dataSources: src(prov, "macro", "dxyIndex", FRED, []),
        canaryThresholds: {
          medium: ">105",
          high: ">110 (extreme dollar strength)",
        },
      },
      {
        name: "Fed Funds Rate - Restrictive Policy",
        formula: "Policy Rate = Federal Reserve target rate for overnight bank lending",
        executiveSummary:
          "Rates above 5% are restrictive and slow economy. Aggressive rate hikes have triggered past recessions and crashes.",
        currentValue: fx(i.fedFundsRate, 2, { suffix: "%" }),
        ranges: {
          safe: "Below 4% (accommodative)",
          warning: "4-5% (neutral)",
          danger: "Above 5% (restrictive), >6% (extreme)",
        },
        dataSources: src(prov, "macro", "fedFundsRate", FRED, []),
        canaryThresholds: {
          medium: ">4.5%",
          high: ">6.0% (severely restrictive)",
        },
      },
      {
        name: "Fed Reverse Repo (Liquidity Conditions)",
        formula: "Liquidity Drain = $ parked at Fed overnight (removes money from markets)",
        executiveSummary:
          "High RRP (>$1T) means tight liquidity. Money market funds choosing Fed over lending to markets reduces available capital.",
        currentValue: fx(i.fedReverseRepo, 0, { prefix: "$", suffix: "B" }),
        ranges: {
          safe: "Below $500B (loose liquidity)",
          warning: "$500B-$1000B",
          danger: "Above $1000B (tight), >$1500B (severe drain)",
        },
        dataSources: src(prov, "macro", "fedReverseRepo", FRED, []),
        canaryThresholds: {
          medium: ">$1000B",
          high: ">$2000B (extreme liquidity drain)",
        },
      },
      {
        name: "Junk Bond Spread",
        formula: "Credit Stress = High-Yield Corporate Bonds - 10Y Treasury Yield",
        executiveSummary:
          "Spread above 6% signals credit stress; above 8% indicates corporate distress. Widens dramatically before recessions.",
        currentValue: fx(i.junkSpread, 2, { suffix: "%" }),
        ranges: {
          safe: "Below 3.5% (tight credit)",
          warning: "3.5-6%",
          danger: "Above 6% (stress), >8% (crisis)",
        },
        dataSources: src(prov, "macro", "junkSpread", FRED, []),
        canaryThresholds: {
          medium: ">5%",
          high: ">8% (credit crisis)",
        },
      },
      {
        name: "US Debt-to-GDP Ratio",
        formula: "Fiscal Burden = Total Federal Debt / Annual GDP × 100",
        executiveSummary:
          "Debt above 120% raises sovereign risk concerns; above 130% approaches fiscal crisis. Limits government crisis response capacity.",
        currentValue: fx(i.debtToGDP, 0, { suffix: "%" }),
        ranges: {
          safe: "Below 100% (healthy)",
          warning: "100-120% (elevated)",
          danger: "Above 120% (high risk), >130% (crisis risk)",
        },
        dataSources: src(prov, "macro", "debtToGDP", FRED, []),
        canaryThresholds: {
          medium: ">110%",
          high: ">130% (fiscal crisis risk)",
        },
      },
      {
        name: "Yield Curve (10Y-2Y)",
        formula: "Recession Signal = 10-Year Treasury Yield - 2-Year Treasury Yield",
        executiveSummary:
          "Inverted yield curve (negative spread) has preceded every recession since 1950. Scored once, in this pillar (max 14 points).",
        currentValue: fx(i.yieldCurve, 2, { suffix: "%", signed: true }),
        ranges: {
          safe: "Above 0% (normal curve)",
          warning: "0% to -0.5% (inverted)",
          danger: "Below -0.5% (deep inversion - recession signal)",
        },
        dataSources: src(prov, "macro", "yieldCurve", FRED, []),
        canaryThresholds: {
          medium: "Curve inverted (-0.2% to -0.5%)",
          high: "Deep inversion (< -0.5%)",
        },
      },
    ],
  }
}
