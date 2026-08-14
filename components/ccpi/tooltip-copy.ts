/**
 * Plain-English tooltip copy for CCPI canary signals and crash amplifiers.
 *
 * Long string maps — no JSX, no imports, and the single largest mechanical
 * block in what was a 3,196-line component. Lifted verbatim.
 */

export function getSignalTooltip(signal: string): string {
  const signalLower = signal.toLowerCase()

  // Dollar Index
  if (signalLower.includes("dollar index") || signalLower.includes("dxy")) {
    return "The Dollar Index measures the US dollar's strength against other major currencies. When it's extremely high (above 110), it makes US exports more expensive and hurts multinational companies' profits. For investors, a strong dollar often leads to lower stock prices, especially for tech companies that earn revenue overseas."
  }

  // QQQ / Nasdaq signals
  if (signalLower.includes("qqq") && signalLower.includes("50-day")) {
    return "QQQ tracks the Nasdaq-100 index (top 100 tech stocks). When it falls below its 50-day moving average, it signals that the medium-term trend has turned negative. This is often an early warning that tech stocks may continue falling. Investors often reduce tech exposure when this happens."
  }
  if (signalLower.includes("qqq") && signalLower.includes("20-day")) {
    return "When QQQ drops below its 20-day moving average, short-term momentum has turned bearish. This is a faster-moving signal than the 50-day and often indicates near-term weakness. Traders may use this as a signal to tighten stop-losses or reduce positions."
  }
  if (signalLower.includes("qqq") && signalLower.includes("bollinger")) {
    return "Bollinger Bands measure how far a stock has moved from its average price. When QQQ approaches the lower band, it's either oversold (potentially a buying opportunity) or showing extreme weakness. Context matters - in a crash, touching the lower band often leads to more downside."
  }

  // SOX / Semiconductors
  if (signalLower.includes("sox") || signalLower.includes("chip") || signalLower.includes("semiconductor")) {
    return "The SOX index tracks semiconductor stocks (chipmakers like NVIDIA, AMD, Intel). Semiconductors are considered a leading indicator because chips go into everything from phones to cars. A crashing chip sector often predicts broader market weakness 2-3 months ahead."
  }

  // Equity Risk Premium
  if (signalLower.includes("equity risk premium") || signalLower.includes("erp")) {
    return "The Equity Risk Premium compares stock earnings yields to bond yields. When it's very low (below 1%), stocks are expensive relative to bonds. This means investors aren't being compensated enough for the extra risk of owning stocks, making bonds more attractive."
  }

  // Put/Call Ratio
  if (signalLower.includes("put/call") || signalLower.includes("put call")) {
    return "The Put/Call ratio shows how many bearish bets (puts) versus bullish bets (calls) traders are making. A low ratio (below 0.7) means excessive optimism - everyone is betting on stocks going up. This is often a contrarian warning sign that a pullback is coming."
  }

  // AAII Sentiment
  if (signalLower.includes("aaii") || signalLower.includes("retail optimism")) {
    return "AAII tracks how individual investors feel about the market. When bullish sentiment exceeds 45-50%, it often signals excessive optimism. Historically, the market tends to underperform after periods of extreme retail bullishness because there are fewer new buyers left."
  }

  // P/E Ratio
  if (signalLower.includes("p/e") || signalLower.includes("pe ratio")) {
    return "The Price-to-Earnings ratio shows how much investors pay for each dollar of company earnings. The S&P 500 historical average is around 16. When it's above 22, stocks are considered expensive. High P/E markets are more vulnerable to sharp corrections."
  }

  // Buffett Indicator
  if (signalLower.includes("buffett indicator")) {
    return "Warren Buffett's favorite valuation metric: total stock market value divided by GDP. Above 150% is considered significantly overvalued. When stocks are worth more than the entire economy produces, it suggests prices have gotten ahead of reality."
  }

  // Debt-to-GDP
  if (signalLower.includes("debt-to-gdp") || signalLower.includes("debt to gdp") || signalLower.includes("fiscal")) {
    return "This measures government debt relative to the economy's size. High debt levels (above 100% of GDP) can lead to higher interest rates, inflation concerns, and reduced government spending flexibility. This creates headwinds for economic growth and stock returns."
  }

  // P/S Ratio
  if (signalLower.includes("p/s") || signalLower.includes("price-to-sales") || signalLower.includes("price to sales")) {
    return "Price-to-Sales ratio compares stock prices to company revenues. Unlike earnings, sales are harder to manipulate. When P/S is elevated (above 2.5 for S&P 500), it suggests investors are paying a premium for revenue, which may not be sustainable."
  }

  // VIX
  if (signalLower.includes("vix") || signalLower.includes("volatility")) {
    return "The VIX measures expected market volatility over the next 30 days. Low VIX (below 15) signals complacency - investors aren't worried. Historically, extended periods of low volatility are often followed by sharp spikes and market pullbacks."
  }

  // Yield Curve
  if (signalLower.includes("yield curve") || signalLower.includes("inversion")) {
    return "The yield curve compares short-term and long-term interest rates. When short-term rates exceed long-term rates (inversion), it signals that investors expect economic weakness ahead. Inversions have preceded every US recession in the past 50 years."
  }

  // Default
  return "This indicator helps measure market risk. When it flashes a warning, it suggests conditions that have historically preceded market weakness. Consider reducing risk exposure or hedging your portfolio when multiple warnings appear together."
}

// Helper function to get crash amplifier tooltip
export function getCrashAmplifierTooltip(reason: string): string {
  const reasonLower = reason.toLowerCase()

  if (reasonLower.includes("50-day") || reasonLower.includes("50 day")) {
    return "When a major index breaks below its 50-day moving average, it confirms that the medium-term trend has turned bearish. This is a significant technical breakdown that often leads to further selling as algorithmic traders and trend-followers exit positions."
  }
  if (reasonLower.includes("200-day") || reasonLower.includes("200 day")) {
    return "The 200-day moving average is the most important long-term trend indicator. Breaking below it signals a potential shift from bull to bear market. Institutional investors often reduce exposure when this level breaks."
  }
  if (reasonLower.includes("death cross")) {
    return "A death cross occurs when the 50-day average crosses below the 200-day average. It's a powerful bearish signal that has preceded major market declines. The opposite (golden cross) signals bullish conditions."
  }
  if (reasonLower.includes("vix") && reasonLower.includes("spike")) {
    return "A VIX spike indicates sudden fear in the market. Large VIX moves often coincide with rapid market selloffs. When volatility explodes, it can trigger margin calls and forced selling, accelerating the decline."
  }
  if (reasonLower.includes("volume") || reasonLower.includes("selling")) {
    return "High-volume selling indicates institutional investors are exiting. When big money sells aggressively, prices can fall quickly. This is different from low-volume pullbacks, which are less concerning."
  }

  return "Crash amplifiers are extreme technical signals that historically appear before or during major market corrections. When active, they add bonus points to the CCPI score because they significantly increase the probability of further downside."
}
