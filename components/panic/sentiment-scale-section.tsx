"use client"

/**
 * The contrarian sentiment scale, the component breakdown bars and the historical context.
 *
 * Split out of `components/panic-euphoria.tsx` (P6-13) unchanged. What it closed
 * over is now props.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshButton } from "@/components/ui/refresh-button"
import { TooltipsToggle } from "@/components/ui/tooltips-toggle"
import { BarChart3, Info } from "lucide-react"
import { PanicIndicator } from "./panic-indicator"
import { PanicTooltip } from "./panic-tooltip"
import { getScoreLabel } from "./score-bands"
import type { PanicEuphoriaData } from "./panic-types"

export function SentimentScaleSection({
  data,
  refreshing,
  handleRefresh,
  tooltipsEnabled,
  setTooltipsEnabled,
}: {
  data: PanicEuphoriaData
  refreshing: boolean
  handleRefresh: () => void
  tooltipsEnabled: boolean
  setTooltipsEnabled: (v: boolean) => void
}) {
  return (
    <>
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  Panic/Euphoria Historical Scale
                  {tooltipsEnabled && (
                    <PanicTooltip enabled={tooltipsEnabled} content="The Citibank Panic/Euphoria Model is a contrarian indicator measuring extreme sentiment. For options traders: readings below -0.17 (panic) historically signal buying opportunities - consider selling puts or buying calls. Readings above +0.41 (euphoria) suggest caution - consider protective puts or bear call spreads. Extreme readings have 80%+ accuracy predicting reversals within 1 year.">
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </PanicTooltip>
                  )}
                </CardTitle>
                <CardDescription className="text-sm text-gray-600 mt-1">
                  Visual representation of sentiment zones from extreme panic to extreme euphoria
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <TooltipsToggle enabled={tooltipsEnabled} onChange={setTooltipsEnabled} />
                <RefreshButton onClick={handleRefresh} loading={refreshing} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Main sentiment scale */}
              <div className="relative">
                <div className="h-24 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-lg shadow-inner" />

                {/* Zone labels - repositioned for contrarian scale */}
                <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-bold">
                  <div className="text-center text-white drop-shadow-lg">
                    <div className="text-base">EXTREME</div>
                    <div>PANIC</div>
                    <div className="text-[10px] mt-1 text-green-100">≤ -0.45</div>
                    <div className="text-[9px] text-green-200">BUY</div>
                  </div>
                  <div className="text-center text-gray-800 drop-shadow">
                    <div>PANIC</div>
                    <div className="text-[10px] mt-1">-0.17</div>
                    <div className="text-[9px] text-green-700">Bullish</div>
                  </div>
                  <div className="text-center text-gray-800 drop-shadow">
                    <div>NEUTRAL</div>
                    <div className="text-[10px] mt-1">0.0</div>
                  </div>
                  <div className="text-center text-gray-800 drop-shadow">
                    <div>EUPHORIA</div>
                    <div className="text-[10px] mt-1">+0.41</div>
                    <div className="text-[9px] text-red-700">Bearish</div>
                  </div>
                  <div className="text-center text-white drop-shadow-lg">
                    <div className="text-base">EXTREME</div>
                    <div>EUPHORIA</div>
                    <div className="text-[10px] mt-1">≥ +0.70</div>
                    <div className="text-[9px] text-red-200">SELL</div>
                  </div>
                </div>

                {/* Current level indicator */}
                {data && (
                  <div
                    className="absolute top-0 bottom-0 w-2 bg-black shadow-lg transition-all duration-500"
                    style={{
                      left: `calc(${((data.overallScore + 1) / 2) * 100}% - 4px)`,
                    }}
                  >
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <div className="bg-black text-white px-4 py-2 rounded-lg shadow-xl">
                        <div className="text-xs font-semibold">TODAY</div>
                        <div className="text-2xl font-bold">
                          {data.overallScore >= 0 ? "+" : ""}
                          {data.overallScore.toFixed(3)}
                        </div>
                        <div className="text-xs text-center">{getScoreLabel(data.overallScore)}</div>
                      </div>
                      <div className="w-0 h-0 border-l-8 border-r-8 border-transparent border-t-black mx-auto" />
                    </div>
                  </div>
                )}
              </div>

              {/* Component breakdown horizontal bars */}

              {/* Historical context */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-bold text-blue-900 text-sm mb-2">Historical Reference Points</h4>
                <div className="space-y-2 text-xs text-blue-800">
                  <div className="flex justify-between">
                    <span>• 2009 Financial Crisis Bottom:</span>
                    <span className="font-bold">-0.85 {`(\u003e95% gain rate)`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• 2020 COVID-19 March Low:</span>
                    <span className="font-bold">-0.72 {`(\u003e95% gain rate)`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• 2021 Meme Stock Peak:</span>
                    <span className="font-bold">+0.81 {`(\u003e80% drop rate)`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• 2024 AI Rally Peak:</span>
                    <span className="font-bold">+0.73 {`(\u003e80% drop rate)`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Nov 2025 (Latest Official Citi):</span>
                    <span className="font-bold">+0.72 (Euphoria Territory)</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-600" />9 Levkovich Indicators (Citibank Model)
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-gray-600">
              Live data from FINRA, FRED, Yahoo Finance, and AI estimates • Updated every 60 seconds
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {data && (
              <>
                <PanicIndicator
                  label="Off-Exchange Short Volume %"
                  value={data.componentScores?.shortInterest ?? null}
                  rawValue={data.nyseShortInterest !== null ? `${data.nyseShortInterest}%` : "—"}
                  tooltip={
                    tooltipsEnabled
                      ? "Off-Exchange Short Volume % — share of FINRA off-exchange (dark pool/OTC) volume marked short, aggregated across ~5,000 tickers. SOURCE: Quiver Quantitative (FINRA data), stored daily and scored as the percentile of its own history; the score bar reads 0.00 until 8 days accumulate. INTERPRETATION: high short share = bearish positioning building (contrarian panic side); low = complacency."
                      : ""
                  }
                />
                <PanicIndicator
                  label="Margin Debt"
                  // P6-8. This read `?? (data.marginDebt - 700) / 150`, and the
                  // fallback is the defect: the server now returns a null score
                  // when the FRED series is unavailable, and `??` answered that
                  // null by RECOMPUTING the score on the client from the
                  // synthetic proxy — silently undoing the removal in the only
                  // place a user looks. Introducing a null is half a change;
                  // the other half is every guard downstream of it (P6-34).
                  value={data.componentScores?.marginDebt ?? null}
                  rawValue={`$${data.marginDebt}B`}
                  tooltip={
                    tooltipsEnabled
                      ? data.componentScores?.marginDebt !== null && data.componentScores?.marginDebt !== undefined
                        ? "Margin Debt tracks total borrowed money used for stock purchases. SOURCE: FRED series BOGZ1FL663067003Q, scored as a percentile of its own history. INTERPRETATION: High readings suggest leveraged speculation/euphoria; low readings suggest fear."
                        : "DISPLAY ONLY — not scored. Margin Debt tracks total borrowed money used for stock purchases. SOURCE: SYNTHETIC PROXY — derived from SPX momentum and VIX, NOT real FINRA statistics (FINRA publishes monthly with no free API). The real FRED series did not answer on this request, so the figure is a model of what margin debt might be and casts no vote in the composite. Modeled range: $600-$850B."
                      : ""
                  }
                />
                <PanicIndicator
                  label="Nasdaq/NYSE Volume Ratio"
                  value={(data.volumeRatio - 1.0) / 0.5}
                  rawValue={`${data.volumeRatio.toFixed(2)}x`}
                  tooltip={
                    tooltipsEnabled
                      ? "Nasdaq/NYSE Volume Ratio compares trading volume between tech-heavy Nasdaq and value-oriented NYSE. SOURCE: Real-time exchange volume data. INTERPRETATION: High ratio (>1.3x) indicates speculative tech/growth trading—euphoria signal. Low ratio (<0.9x) suggests rotation to value/safety—defensive positioning. Current range: 0.8-1.5x."
                      : ""
                  }
                />
                <PanicIndicator
                  label="Investor Intelligence Survey"
                  value={(data.investorIntelligence - 50) / 20}
                  rawValue={`${data.investorIntelligence}% bulls`}
                  tooltip={
                    tooltipsEnabled
                      ? "DISPLAY ONLY — not scored. Citi's model uses the Investor Intelligence survey of newsletter writers. This site does not have that survey. SOURCE: derived from VIX — the reading is 100 − ((VIX − 10) / 40) × 60, clamped to 30-70, so it is a volatility measure on a sentiment scale, not a poll of anybody. INTERPRETATION: the contrarian reading still applies (high = complacency, low = fear), but treat it as VIX wearing a survey's name. Removed from the composite (P6-8): a component that cannot disagree with VIX is not a second piece of evidence about the market."
                      : ""
                  }
                />
                <PanicIndicator
                  label="AAII Bullish Sentiment"
                  value={(data.aaiiBullish - 40) / 25}
                  rawValue={`${data.aaiiBullish}%`}
                  tooltip={
                    tooltipsEnabled
                      ? "DISPLAY ONLY — not scored. SOURCE: this is not the AAII survey. The figure is the Investor Intelligence row above multiplied by 0.9, and that row is itself derived from VIX — so this number cannot disagree with it at any VIX level. It was removed from the composite for that reason: two names for one measurement gave VIX double weight in an equal-weight mean. Shown because the row is part of Citi's published model, kept unscored because this site cannot source it."
                      : ""
                  }
                />
                <PanicIndicator
                  label="Money Market Funds"
                  value={data.componentScores?.moneyMarketFunds ?? null}
                  rawValue={data.moneyMarketFunds !== null ? `${data.moneyMarketFunds}T` : "—"}
                  tooltip={
                    tooltipsEnabled
                      ? "Money Market Fund Assets tracks cash sitting on the sidelines in low-risk money market accounts. SOURCE: Investment Company Institute (ICI) via FRED. INTERPRETATION: High cash levels (>$6T) indicate fear/caution—this is 'dry powder' that could fuel a rally (bullish). Low cash (<$5T) means investors are fully invested—euphoria/risk. Current range: $5-7T."
                      : ""
                  }
                />
                <PanicIndicator
                  label="VIX Momentum (5d vs 50d avg)"
                  value={(1.0 - data.vixMomentumRatio) / 0.3}
                  rawValue={`${data.vixMomentumRatio.toFixed(2)}`}
                  tooltip={
                    tooltipsEnabled
                      ? "The 5-day average of VIX divided by its 50-day average — how stretched fear is against its own recent norm. NOT a term structure: that compares different MATURITIES (VIX3M vs VIX, shown on the CCPI tab), and this compares two lookbacks of the same spot series. SOURCE: measured VIX history from Yahoo — no options data of any kind (this row was previously labelled 'Put/Call Ratio', naming an instrument this site does not source). INTERPRETATION: above 1.0 means near-term volatility is bid above longer-dated — fear and hedging demand, contrarian bullish. Below 1.0 is a calm front end — complacency. Clamped to 0.8-1.3. It IS scored: shape can disagree with level, which is why it survived the cull that removed the VIX-derived sentiment proxies."
                      : ""
                  }
                />
                <PanicIndicator
                  label="Commodity Prices (CRB)"
                  value={data.commodityPrices !== null ? (data.commodityPrices - 280) / 40 : 0}
                  rawValue={data.commodityPrices !== null ? `${data.commodityPrices.toFixed(1)}` : "—"}
                  tooltip={
                    tooltipsEnabled
                      ? "CRB Commodity Index tracks a basket of raw materials including energy, metals, and agriculture. SOURCE: Live commodity futures data. INTERPRETATION: High prices (>300) indicate inflation/speculation—economic overheating and euphoria. Low prices (<260) suggest deflation fears/recession—panic territory. Current range: 250-320."
                      : ""
                  }
                />
                <PanicIndicator
                  label="Retail Gas Prices"
                  value={data.gasPrices !== null ? (3.25 - data.gasPrices) / 1.0 : 0}
                  rawValue={data.gasPrices !== null ? `$${data.gasPrices.toFixed(2)}/gal` : "—"}
                  tooltip={
                    tooltipsEnabled
                      ? "Retail Gas Prices track national average gasoline costs that directly impact consumer spending. SOURCE: EIA (Energy Information Administration) weekly data. INTERPRETATION: High prices (>$4.00) create consumer stress and economic drag—bearish for markets. Low prices (<$3.00) act as a 'tax cut' for consumers—bullish. Current range: $2.50-$4.50/gal."
                      : ""
                  }
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <BarChart3 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-3">Official Citibank vs. Real-Time Proxy</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-3 bg-white rounded-lg border border-blue-200">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Latest Official Citi Reading</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {data.latestCitiReading != null
                        ? `${data.latestCitiReading >= 0 ? "+" : ""}${data.latestCitiReading.toFixed(2)}`
                        : "—"}
                    </div>
                    {/* Date always from the API — the old `|| "Nov 7, 2025"` default
                        could stamp a wrong date on a reading (P6-8). */}
                    <div className="text-xs text-gray-600 mt-1">
                      {data.latestCitiDate ? `${data.latestCitiDate} (last published reading)` : "—"}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-purple-200">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Your Real-Time Proxy</div>
                    <div className="text-2xl font-bold text-purple-900">
                      {data.overallScore >= 0 ? "+" : ""}
                      {data.overallScore.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">Live calculation</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <div className="text-xs font-semibold text-gray-600 mb-1">2025 YTD Average</div>
                    <div className="text-2xl font-bold text-gray-900">+{data.ytdAverage?.toFixed(2) || "0.44"}</div>
                    <div className="text-xs text-gray-600 mt-1">Elevated euphoria year</div>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  <strong>Note:</strong> Your proxy uses real-time market data to approximate the official Citibank
                  model. The official reading is updated periodically, while your proxy updates live.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
    </>
  )
}
