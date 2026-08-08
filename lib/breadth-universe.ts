/**
 * Breadth universe — E-6a.
 *
 * ~100 largest, most liquid US large-caps (S&P 100-style membership). Breadth
 * is computed as the % of THIS list above its own 200-DMA.
 *
 * MAINTAINED CONSTANT, AND LABELED AS ONE. Index membership drifts a few names
 * a year; that drift is immaterial to a breadth divergence signal, but the
 * as-of date below travels with the data so nobody mistakes the list for a
 * live constituent feed. Review roughly quarterly.
 *
 * This is a UNIVERSE DEFINITION, not market data — a fixed membership list is
 * the standard construction for breadth indicators (e.g. S5TH/OEXA200R are
 * "% of S&P constituents above 200-DMA" against defined membership).
 */

export const BREADTH_UNIVERSE_AS_OF = "2026-08"

export const BREADTH_UNIVERSE: string[] = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "BRK.B", "JPM",
  "V", "UNH", "XOM", "LLY", "MA", "HD", "PG", "COST", "JNJ", "ABBV",
  "BAC", "CRM", "KO", "MRK", "CVX", "WMT", "PEP", "TMO", "ORCL", "AMD",
  "ACN", "MCD", "ABT", "CSCO", "ADBE", "PM", "WFC", "IBM", "GE", "TXN",
  "QCOM", "DHR", "INTU", "CAT", "VZ", "AMGN", "PFE", "NEE", "CMCSA", "UNP",
  "LOW", "RTX", "SPGI", "HON", "T", "COP", "BLK", "NFLX", "BA", "UPS",
  "SCHW", "AXP", "MS", "GS", "DE", "ELV", "LMT", "BKNG", "SYK", "ADI",
  "PLD", "MDT", "TJX", "GILD", "MMC", "VRTX", "C", "CB", "SBUX", "MO",
  "AMT", "ISRG", "SO", "PGR", "REGN", "DUK", "ZTS", "CI", "BMY", "TGT",
  "USB", "APD", "CL", "EMR", "FDX", "NSC", "BSX", "ITW", "ETN", "AON",
]
