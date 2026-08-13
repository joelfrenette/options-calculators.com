"use client"

/**
 * Every band of guidance at once, with the current one marked.
 *
 * Split out of `components/panic-euphoria.tsx` (P6-13) unchanged. What it closed
 * over is now props.
 */
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { AllocationBar } from "@/components/allocation-bar"
import { PANIC_EUPHORIA_ALLOCATION, type AllocationBand } from "@/lib/allocation"
import type { getAllLevelGuidance, getTradeRecommendations } from "./trade-guidance"

export function AllLevelGuidanceSection({
  allLevelGuidance,
  allocationBand,
  recommendations,
}: {
  allLevelGuidance: ReturnType<typeof getAllLevelGuidance>
  allocationBand: AllocationBand | null | undefined
  recommendations: ReturnType<typeof getTradeRecommendations>
}) {
  return (
    <>
        <Accordion type="multiple" className="space-y-0">
          <AccordionItem value="options-strategy-guide" className="border-0">
            <Card className="shadow-sm border-gray-200">
              <AccordionTrigger className="hover:no-underline px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                <CardTitle className="text-lg font-bold text-gray-900">
                  Options Strategy Guide by Panic/Euphoria Level
                </CardTitle>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-2">
                    {allLevelGuidance.map((item, index) => {
                      const isCurrent = item.level === recommendations.level

                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border transition-colors ${
                            isCurrent
                              ? "border-purple-600 bg-purple-50 shadow-sm"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-mono text-sm font-bold text-gray-900">Score: {item.range}</span>
                                <span
                                  className={`ml-3 font-bold text-sm ${
                                    index === 0
                                      ? "text-green-700" // Extreme Panic
                                      : index === 1
                                        ? "text-green-600" // Panic
                                        : index === 2
                                          ? "text-yellow-600" // Neutral/Complacent
                                          : index === 3
                                            ? "text-red-500" // Euphoria
                                            : "text-red-700" // Extreme Euphoria
                                  }`}
                                >
                                  {item.level}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {isCurrent && (
                                  <span className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">
                                    CURRENT
                                  </span>
                                )}
                                <span
                                  className={`px-3 py-1 text-xs font-bold rounded-full ${
                                    item.signal === "STRONG BUY"
                                      ? "bg-green-100 text-green-800"
                                      : item.signal === "BUY"
                                        ? "bg-green-100 text-green-700"
                                        : item.signal === "HOLD"
                                          ? "bg-gray-100 text-gray-700"
                                          : item.signal === "CAUTION/SELL"
                                            ? "bg-red-100 text-red-700"
                                            : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {item.signal}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 italic">{item.description}</p>
                          </div>

                          {(() => {
                            // Matched on the level the row already names, so this list and
                            // the live card above can never show different splits.
                            const rowBand = PANIC_EUPHORIA_ALLOCATION.bands.find(
                              (b) => b.level === item.guidance.level,
                            )
                            return rowBand ? <AllocationBar band={rowBand} className="mb-3" /> : null
                          })()}

                          <div className="mb-3">
                            <div className="text-xs font-bold text-gray-900 uppercase mb-2">Top Strategies</div>
                            <div className="space-y-1">
                              {item.guidance.strategies.slice(0, 3).map((strategy, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                  <span className="text-purple-600 mt-1 flex-shrink-0">•</span>
                                  <span>{strategy}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800 leading-relaxed">
                      <strong>Note:</strong> This model is most powerful when combined with price trend analysis (S&P
                      500 vs 200-week MA). Panic readings below -0.10 (official Citi threshold) with SPX above its
                      200-week MA have historically produced the strongest forward returns. Always size positions
                      appropriately and maintain strict risk management.
                    </p>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
    </>
  )
}
