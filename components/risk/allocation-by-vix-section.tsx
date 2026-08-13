"use client"

/**
 * Portfolio allocation at every VIX band, with the current one marked.
 *
 * Split out of `components/risk-calculator.tsx` (P6-13) unchanged. It reads the
 * VIX bands directly rather than taking a level as a prop, because the band is
 * decided once in `./vix-allocation` and every reader looks it up there.
 */
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart } from "lucide-react"
import { VIX_LEVELS, getVixLevel, getVixPortfolioAllocation } from "./vix-allocation"

export function AllocationByVixSection({ vixValue }: { vixValue: number | null }) {
  return (
    <>
        <Accordion type="single" collapsible defaultValue="portfolio-allocation">
          <AccordionItem value="portfolio-allocation" className="border-0">
            <Card className="shadow-sm border-gray-200">
              <AccordionTrigger className="hover:no-underline [&[data-state=open]>div]:rounded-b-none">
                <CardHeader className="bg-gray-50 border-b border-gray-200 w-full py-4">
                  <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-primary" />
                    Portfolio Allocation Guidance by VIX Level
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-2 text-left">
                    Complete allocation strategies across all volatility regimes — cash vs. deployed shares, LEAPS, and options
                  </p>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-3">
                    {[
                      { range: "≤ 12", vix: 10 },
                      { range: "12-15", vix: 13.5 },
                      { range: "15-20", vix: 17.5 },
                      { range: "20-25", vix: 22.5 },
                      { range: "25-30", vix: 27.5 },
                      { range: "≥ 30", vix: 35 },
                    ].map((item, index) => {
                      const levelData = getVixPortfolioAllocation(item.vix)
                      const levelInfo = getVixLevel(item.vix)
                      const isCurrent =
                        vixValue &&
                        vixValue >=
                          (index === 0
                            ? 0
                            : index === 1
                              ? 12
                              : index === 2
                                ? 15
                                : index === 3
                                  ? 20
                                  : index === 4
                                    ? 25
                                    : 30) &&
                        vixValue <
                          (index === 5
                            ? 999
                            : index === 4
                              ? 30
                              : index === 3
                                ? 25
                                : index === 2
                                  ? 20
                                  : index === 1
                                    ? 15
                                    : 12)

                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border transition-colors ${
                            isCurrent
                              ? "border-green-500 bg-green-100 shadow-md ring-2 ring-green-300"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-mono text-sm font-bold text-gray-900">VIX {item.range}</span>
                                <span className={`ml-3 font-bold text-sm ${levelInfo.color}`}>
                                  {levelInfo.sentiment}
                                </span>
                              </div>
                              {isCurrent && (
                                <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">
                                  CURRENT
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 italic">{levelData.description}</p>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                            <div className="p-3 bg-blue-50 rounded border border-blue-200">
                              <div className="text-xs font-semibold text-blue-900 uppercase mb-1">Stocks/ETFs</div>
                              <div className="text-lg font-bold text-blue-900">{levelData.stocks}</div>
                            </div>
                            <div className="p-3 bg-purple-50 rounded border border-purple-200">
                              <div className="text-xs font-semibold text-purple-900 uppercase mb-1">Options</div>
                              <div className="text-lg font-bold text-purple-900">{levelData.options}</div>
                            </div>
                            <div className="p-3 bg-orange-50 rounded border border-orange-200">
                              <div className="text-xs font-semibold text-orange-900 uppercase mb-1">LEAPS</div>
                              <div className="text-lg font-bold text-orange-900">{levelData.leaps}</div>
                            </div>
                            <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                              <div className="text-xs font-semibold text-yellow-900 uppercase mb-1">Hedges/Puts</div>
                              <div className="text-lg font-bold text-yellow-900">{levelData.hedges}</div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded border border-gray-300">
                              <div className="text-xs font-semibold text-gray-900 uppercase mb-1">Cash Reserve</div>
                              <div className="text-lg font-bold text-gray-900">{levelData.cash}</div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {levelData.rationale.map((point, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                <span className="text-primary mt-1 flex-shrink-0">•</span>
                                <span>{point}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800 leading-relaxed">
                      <strong>Note:</strong> These allocations are strategic guidelines based on historical VIX patterns
                      and market behavior. Always adjust based on your personal risk tolerance, investment timeline, and
                      financial objectives. VIX levels are forward-looking volatility expectations and should be
                      combined with other market indicators for comprehensive decision-making.
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
