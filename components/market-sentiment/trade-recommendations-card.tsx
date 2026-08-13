"use client"

/**
 * The Trade Recommendations accordion: portfolio allocation, strategies and
 * risk notes for the band the score currently sits in.
 *
 * Split out of `components/market-sentiment.tsx` (P6-13) unchanged. Positions
 * are shares/LEAPS/options/cash and diversification is expressed through
 * sectors and indexes — see `./trade-recommendations.ts`, which holds the copy
 * this renders.
 */
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { AllocationBar } from "@/components/allocation-bar"
import { DollarSignIcon, LightbulbIcon, ShieldIcon, TargetIcon, TrendingUpIcon } from "./icons"
import { getScoreBackground, getScoreColor } from "./score-colors"
import type { AllocationBand } from "@/lib/allocation"
import { type getTradeRecommendations } from "./trade-recommendations"
import type { MarketData } from "./market-data"

export function TradeRecommendationsCard({
  marketData,
  recommendations,
  sentimentBand,
  refreshing,
}: {
  marketData: MarketData
  recommendations: ReturnType<typeof getTradeRecommendations>
  sentimentBand: AllocationBand | null | undefined
  refreshing: boolean
}) {
  return (
        <Accordion type="multiple" defaultValue={["trade-recommendations"]} className="space-y-0">
          <AccordionItem value="trade-recommendations" className="border-0">
            <Card className="shadow-sm border-gray-200">
              <AccordionTrigger className="hover:no-underline px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <TargetIcon className="h-5 w-5 text-primary" />
                  Trade Recommendations & Portfolio Guidance
                  {refreshing && (
                    <span className="text-xs font-normal text-primary animate-pulse">(Recalculating...)</span>
                  )}
                </CardTitle>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4">
                  <div className={`transition-opacity duration-300 ${refreshing ? "opacity-50" : "opacity-100"}`}>
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Portfolio Allocation */}
                      <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <DollarSignIcon className="h-5 w-5 text-primary" />
                          <h3 className="font-bold text-gray-900">Portfolio Allocation</h3>
                        </div>
                        <div className="space-y-3">
                          {/*
                            Cash and stocks come from lib/allocation.ts, where cash is the
                            only stored figure and stocks is its complement. Storing both is
                            what let this card drift from the (now deleted) second table in
                            this same component.
                          */}
                          {sentimentBand ? (
                            <AllocationBar band={sentimentBand} />
                          ) : (
                            <p className="text-sm text-gray-500 italic">
                              No sentiment reading — allocation not shown.
                            </p>
                          )}
                          <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                            <span className="text-sm font-medium text-gray-700">Position Size</span>
                            <span className="text-sm font-bold text-primary">{recommendations.positionSize}</span>
                          </div>
                        </div>
                      </div>

                      {/* Recommended Strategies */}
                      <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <LightbulbIcon className="h-5 w-5 text-primary" />
                          <h3 className="font-bold text-gray-900">Recommended Strategies</h3>
                        </div>
                        <ul className="space-y-2">
                          {recommendations.strategies.map((strategy, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                              <span className="text-primary mt-1 flex-shrink-0">•</span>
                              <span>{strategy}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Risk Management */}
                    <div className={`mt-4 p-4 rounded-lg border-2 ${getScoreBackground(marketData.overallScore)}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <ShieldIcon className="h-5 w-5 text-primary" />
                        <h3 className={`font-bold ${getScoreColor(marketData.overallScore)}`}>
                          Risk Management Guidelines
                        </h3>
                      </div>
                      <ul className="space-y-2">
                        {recommendations.riskManagement.map((tip, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-primary">
                            <span className="text-primary mt-1">✓</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Coach Tips */}
                    <div className={`mt-4 p-4 rounded-lg border-2 ${getScoreBackground(marketData.overallScore)}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUpIcon className={`h-5 w-5 ${getScoreColor(marketData.overallScore)}`} />
                        <h3 className={`font-bold ${getScoreColor(marketData.overallScore)}`}>Expert Coach Insight</h3>
                      </div>
                      <p className={`text-sm ${getScoreColor(marketData.overallScore)}`}>{recommendations.coachTips}</p>
                    </div>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
  )
}
