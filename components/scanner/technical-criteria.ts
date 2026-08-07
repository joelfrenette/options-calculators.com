// Technical gate evaluation shared by the scan flow and the results tables.
// Extracted from components/wheel-scanner.tsx (Phase 4) — logic verbatim; the
// component's slider/toggle state is passed in as a settings object.

import type { QualifyingStock } from "./types"

export interface TechnicalFilterSettings {
  maxRSI: number
  maxStochastic: number
  minATR: number
  maxATR: number
  requireBollingerBands: boolean
  requireAbove200SMA: boolean
  requireAbove50SMA: boolean
  requireGoldenCross: boolean
  requireMACDBullish: boolean
  requireRedDay: boolean
  minYield: number
  minVolumeTechnicals: number
}

export const checkTechnicalCriteria = (stock: QualifyingStock, f: TechnicalFilterSettings) => {
  // Null indicator = insufficient history = the gate FAILS-SAFE (a stock with
  // an unknown RSI/SMA cannot pass a filter that requires knowing it).
  const criteria = {
    rsiCheck: stock.rsi !== null && stock.rsi <= f.maxRSI,
    stochasticCheck: stock.stochastic !== null && stock.stochastic <= f.maxStochastic,
    sma200Check: !f.requireAbove200SMA || (stock.sma200 !== null && stock.currentPrice >= stock.sma200),
    sma50Check: !f.requireAbove50SMA || (stock.sma50 !== null && stock.currentPrice >= stock.sma50),
    goldenCrossCheck: !f.requireGoldenCross || stock.uptrend,
    macdCheck: !f.requireMACDBullish || stock.macdSignal === "Bullish",
    atrCheck: stock.atrPercent >= f.minATR && stock.atrPercent <= f.maxATR,
    bollingerCheck:
      !f.requireBollingerBands || stock.bollingerPosition === "Below" || stock.bollingerPosition === "Lower Half",
    redDayCheck: !f.requireRedDay || stock.redDay,
    // FIX: Add yield check to criteria
    yieldCheck: stock.yield >= f.minYield,
    // FIX: Add volume check to criteria
    volumeCheck: stock.avgVolume >= f.minVolumeTechnicals,
  }
  return criteria
}

// Helper function to evaluate all technical criteria for relaxed results table
export const evaluateCriteria = (stock: QualifyingStock, f: TechnicalFilterSettings) => {
  // Same fail-safe null handling as checkTechnicalCriteria above.
  return {
    rsiCheck: stock.rsi !== null && stock.rsi <= f.maxRSI,
    sma200Check: !f.requireAbove200SMA || (stock.sma200 !== null && stock.currentPrice >= stock.sma200),
    sma50Check: !f.requireAbove50SMA || (stock.sma50 !== null && stock.currentPrice >= stock.sma50),
    goldenCrossCheck: !f.requireGoldenCross || stock.uptrend,
    macdCheck: !f.requireMACDBullish || stock.macdSignal === "Bullish",
    stochasticCheck: stock.stochastic !== null && stock.stochastic <= f.maxStochastic,
    atrCheck: stock.atrPercent >= f.minATR && stock.atrPercent <= f.maxATR,
    bollingerCheck:
      !f.requireBollingerBands || stock.bollingerPosition === "Below" || stock.bollingerPosition === "Lower Half",
    redDayCheck: !f.requireRedDay || stock.redDay,
    yieldCheck: stock.yield >= f.minYield,
    volumeCheck: stock.avgVolume >= f.minVolumeTechnicals,
  }
}
