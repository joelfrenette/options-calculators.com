"use client"

/**
 * The trade recommendations accordion for the current band.
 *
 * Split out of `components/panic-euphoria.tsx` (P6-13) unchanged. What it closed
 * over is now props.
 */
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { AllocationBar } from "@/components/allocation-bar"
import { DollarSign, Lightbulb, Shield, Target, TrendingUp } from "lucide-react"
import { getScoreBackground, getScoreColor } from "./score-bands"
import type { AllocationBand } from "@/lib/allocation"
import type { getTradeRecommendations } from "./trade-guidance"
import type { PanicEuphoriaData } from "./panic-types"

export function TradeRecommendationsSection({
  data,
  recommendations,
  allocationBand,
  refreshing,
}: {
  data: PanicEuphoriaData
  recommendations: ReturnType<typeof getTradeRecommendations>
  allocationBand: AllocationBand | null | undefined
  refreshing: boolean
}) {
  return (
    <>
        <Accordion type="multiple" className="space-y-0">
          <AccordionItem value="options-trading-strategy" className="border-0">
            <Card className="shadow-sm border-gray-200">
              <AccordionTrigger className="hover:no-underline px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  Options Trading Strategy for Current Level
                </CardTitle>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4">
                  <div className={`transition-opacity duration-300 ${refreshing ? "opacity-50" : "opacity-100"}`}>
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Portfolio Allocation */}
                      <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <DollarSign className="h-5 w-5 text-purple-600" />
                          <h3 className="font-bold text-gray-900">Recommended Allocation</h3>
                        </div>
                        {/*
                          From lib/allocation.ts, where cash is the only stored figure
                          and stocks is its complement. The three columns this replaced
                          summed to between 90 and 115.
                        */}
                        {allocationBand ? (
                          <div className="space-y-3">
                            <AllocationBar band={allocationBand} />
                            <p className="text-sm text-gray-600 italic">{allocationBand.stance}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            No panic/euphoria reading — allocation not shown.
                          </p>
                        )}
                      </div>

                      {/* Recommended Strategies */}
                      <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <Lightbulb className="h-5 w-5 text-purple-600" />
                          <h3 className="font-bold text-gray-900">Top Strategies</h3>
                        </div>
                        <ul className="space-y-2">
                          {recommendations.strategies.map((strategy, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                              <span className="text-purple-600 mt-1 flex-shrink-0">•</span>
                              <span>{strategy}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Risk Management */}
                    <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-5 w-5 text-blue-700" />
                        <h3 className="font-bold text-blue-900">Risk Management & Historical Context</h3>
                      </div>
                      <ul className="space-y-2">
                        {recommendations.riskManagement.map((tip, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-blue-800">
                            <span className="text-blue-600 mt-1">✓</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Coach Tips */}
                    <div className={`mt-4 p-4 rounded-lg border-2 ${getScoreBackground(data.overallScore)}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className={`h-5 w-5 ${getScoreColor(data.overallScore)}`} />
                        <h3 className={`font-bold ${getScoreColor(data.overallScore)}`}>
                          Historical Performance Insight
                        </h3>
                      </div>
                      <p className={`text-sm ${getScoreColor(data.overallScore)}`}>{recommendations.coachTips}</p>
                    </div>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
    </>
  )
}
