/**
 * Pillar 1 — Momentum & Technical.
 *
 * Split out of `components/ccpi-audit-admin.tsx` (P6-13) unchanged. One file per
 * pillar rather than one file for all four: together they are 649 lines, which
 * would have replaced a module over the threshold with another one.
 */
import { PILLAR_WEIGHTS } from "@/lib/ccpi/scoring"
import { type PillarAudit, band, breach, fx, raw, src } from "../format"

export const buildMomentumPillar = (ccpi: any, prov: any): PillarAudit => {
  const i = ccpi.indicators ?? {}
  const p = prov?.momentum ?? {}
  const POLYGON = "Polygon.io daily aggregates → lib/indicators.ts"
  return {
    name: "Pillar 1 - Momentum & Technical",
    weight: Math.round(PILLAR_WEIGHTS.momentum * 100),
    score: typeof ccpi.pillars?.momentum === "number" ? ccpi.pillars.momentum : null,
    scoredMax: typeof p.scoredMax === "number" ? p.scoredMax : null,
    liveMax: typeof p.liveMax === "number" ? p.liveMax : null,
    aiMax: typeof p.aiMax === "number" ? p.aiMax : null,
    excluded: Array.isArray(p.excluded) ? p.excluded : [],
    formula: "Momentum = (Raw Points / Scored Weight) × 100, renormalized over live/AI-backed indicators",
    calculation:
      "10 indicators with maxima summing to 100: NVIDIA (9), SOX (9), QQQ Daily Return (12), QQQ Consecutive Down (7), QQQ Below SMA20 (7), QQQ Below SMA50 (10), QQQ Below SMA200 (15), QQQ Bollinger (9), VIX (13), VIX Term Structure (9). Baseline-tier or missing indicators are excluded and the pillar renormalizes; below 40 scored weight the pillar reports no score.",
    executiveSummary:
      "Momentum pillar captures price action deterioration, technical breakdown, and volatility spikes. Heavy weighting on critical support levels (SMA50/200) and the VIX complex. Scores rise dramatically when QQQ breaks key moving averages or volatility explodes above panic thresholds.",
    validation: band(ccpi.pillars?.momentum, "🔴 EXTREME RISK", "🟡 ELEVATED RISK", "🟢 NORMAL"),
    indicators: [
      {
        name: "NVIDIA Momentum Score",
        formula: "AI Bellwether = Price change % over rolling 30-day period",
        executiveSummary:
          "NVIDIA acts as leading indicator for AI/tech sentiment. Rapid drops signal sector rotation or bubble concerns.",
        // Was `|| 50`, which invented a neutral reading whenever the value was
        // missing (and also whenever it was legitimately 0).
        currentValue: raw(i.nvidiaMomentum ?? null),
        ranges: {
          safe: "Above 60 (healthy momentum)",
          warning: "40-60 (slowing growth)",
          danger: "Below 40 (severe weakness/overheating >80)",
        },
        dataSources: src(prov, "momentum", "nvidiaMomentum", "Alpha Vantage API", [
          "AI fallback chain (lib/unified-ai-fallback.ts)",
        ]),
        canaryThresholds: {
          medium: "Momentum < 40 or > 80",
          high: "Momentum < 20 (AI sector crash signal)",
        },
      },
      {
        name: "SOX Semiconductor Index",
        formula: "Chip Health = (Current Price - Baseline 5000) / 5000 × 100%",
        executiveSummary:
          "Semiconductor index tracks hardware backbone of AI economy. Chip crashes often precede broader tech selloffs.",
        currentValue: raw(i.soxIndex ?? null),
        ranges: {
          safe: "Above baseline (5000+)",
          warning: "-5% to -10% from baseline",
          danger: "Below -10% (chip sector crash)",
        },
        dataSources: src(
          prov,
          "momentum",
          "soxIndex",
          "Yahoo Finance chart API (^SOX, measured — P7-89); AI fallback chain is display-only",
          [],
        ),
        canaryThresholds: {
          medium: "Down 10-15%",
          high: "Down >15% (sector collapse)",
        },
      },
      {
        name: "QQQ Daily Return (5× downside amplifier)",
        formula: "Daily % Change = (Close - Previous Close) / Previous Close × 100",
        executiveSummary:
          "Single-day crashes are the strongest short-term crash predictor. Down days are weighted 5× more than up days to capture asymmetric risk.",
        currentValue: fx(i.qqqDailyReturn, 2, { suffix: "%" }),
        ranges: {
          safe: "Above -1%",
          warning: "-1% to -3%",
          danger: "Below -3% (crash day if <-6%)",
        },
        dataSources: src(prov, "momentum", "qqqDailyReturn", "Polygon.io daily aggregates", []),
        canaryThresholds: {
          medium: "Return < -1.5%",
          high: "Return < -6% (single-day crash)",
        },
      },
      {
        name: "QQQ Consecutive Down Days",
        formula: "Streak Counter = Number of consecutive days with negative returns",
        executiveSummary: "Extended losing streaks indicate sustained selling pressure and potential trend reversal.",
        currentValue: raw(i.qqqConsecDown ?? null, " days"),
        ranges: {
          safe: "0-1 days",
          warning: "2-3 days",
          danger: "4+ days (trend breakdown)",
        },
        dataSources: src(prov, "momentum", "qqqConsecDown", "Polygon.io daily aggregates", []),
        canaryThresholds: {
          medium: "3+ days down",
          high: "5+ days down (persistent weakness)",
        },
      },
      {
        name: "QQQ Below 20-Day SMA",
        formula: "Short-term Support = Binary (Price < SMA20) + Proximity Score (0-100%)",
        executiveSummary:
          "20-day moving average is critical short-term support. Breaches signal momentum loss and potential correction.",
        currentValue: breach(i.qqqBelowSMA20, i.qqqSMA20Proximity),
        ranges: {
          safe: "Above SMA20 (0% proximity)",
          warning: "25-50% proximity to breach",
          danger: "Below SMA20 (100% proximity = breached)",
        },
        dataSources: src(prov, "momentum", "qqqSMA20", POLYGON, []),
        canaryThresholds: {
          medium: "50%+ proximity",
          high: "Breached (100% proximity)",
        },
      },
      {
        name: "QQQ Below 50-Day SMA",
        formula: "Medium-term Support = Binary (Price < SMA50) + Proximity Score (0-100%)",
        executiveSummary:
          "50-day moving average marks intermediate trend health. Breaches often precede deeper corrections.",
        currentValue: breach(i.qqqBelowSMA50, i.qqqSMA50Proximity),
        ranges: {
          safe: "Above SMA50",
          warning: "25-50% proximity",
          danger: "Below SMA50 (medium-term trend broken)",
        },
        dataSources: src(prov, "momentum", "qqqSMA50", POLYGON, []),
        canaryThresholds: {
          medium: "50%+ proximity",
          high: "Breached (100% proximity)",
        },
      },
      {
        name: "QQQ Below 200-Day SMA",
        formula: "Long-term Support = Binary (Price < SMA200) + Proximity Score (0-100%)",
        executiveSummary:
          "200-day moving average is the ultimate bull/bear line. Breaches signal potential bear market.",
        currentValue: breach(i.qqqBelowSMA200, i.qqqSMA200Proximity),
        ranges: {
          safe: "Above SMA200 (bull market)",
          warning: "25-50% proximity (approaching danger)",
          danger: "Below SMA200 (bear market signal)",
        },
        dataSources: src(prov, "momentum", "qqqSMA200", POLYGON, []),
        canaryThresholds: {
          medium: "50%+ proximity",
          high: "Breached (100% proximity - bear market)",
        },
      },
      {
        name: "QQQ Below Bollinger Band (Lower)",
        formula: "Oversold Territory = Binary (Price < Lower Band) + Proximity Score (0-100%)",
        executiveSummary:
          "Bollinger bands mark statistical extremes. Breaches indicate oversold conditions or accelerating declines.",
        currentValue: breach(i.qqqBelowBollinger, i.qqqBollingerProximity, "YES - OVERSOLD"),
        ranges: {
          safe: "Within bands",
          warning: "25-50% proximity to lower band",
          danger: "Below lower band (extreme oversold)",
        },
        dataSources: src(prov, "momentum", "qqqBollinger", POLYGON, []),
        canaryThresholds: {
          medium: "50%+ proximity",
          high: "Breached lower band (100% proximity - panic selling)",
        },
      },
      {
        name: "VIX (Fear Gauge)",
        formula: "Implied Volatility = S&P 500 30-day expected volatility from options pricing",
        executiveSummary:
          "VIX measures market fear through options prices. Spikes above 25 indicate elevated stress; above 35 signals panic.",
        currentValue: fx(i.vix, 1),
        ranges: {
          safe: "Below 15 (calm market)",
          warning: "15-25 (elevated volatility)",
          danger: "Above 25 (fear), >35 (panic)",
        },
        dataSources: src(prov, "momentum", "vix", "FRED VIXCLS", [
          "AI fallback chain (lib/unified-ai-fallback.ts)",
        ]),
        canaryThresholds: {
          medium: "VIX > 25",
          high: "VIX > 35 (extreme fear)",
        },
      },
      {
        name: "VIX Term Structure (VIX3M / VIX)",
        formula: "Term Structure = 3-Month VIX (VIX3M) / Spot VIX — ratio convention, normal contango ≈ 1.08",
        executiveSummary:
          "Term structure shows the market's fear timeline. Backwardation (ratio < 1.0) means immediate fear exceeds future expectations - classic crash signal. Both legs come from FRED.",
        currentValue: `${fx(i.vixTermStructure, 2)}${i.vixTermInverted === true ? " (INVERTED - FEAR)" : ""}`,
        ranges: {
          safe: "Above 1.05 (normal contango, baseline ~1.08)",
          warning: "1.00-1.05 (flattening)",
          danger: "Below 1.00 (backwardation - immediate fear; <0.95 severe)",
        },
        dataSources: src(prov, "momentum", "vixTermStructure", "FRED VXVCLS ÷ FRED VIXCLS", []),
        canaryThresholds: {
          medium: "Ratio < 1.0 (mild backwardation)",
          high: "Ratio < 0.95 (severe backwardation)",
        },
      },
    ],
  }
}

