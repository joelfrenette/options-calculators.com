"use client"

/**
 * What each VIX band implies for options hedging.
 *
 * Split out of `components/risk-calculator.tsx` (P6-13) unchanged. It reads the
 * VIX bands directly rather than taking a level as a prop, because the band is
 * decided once in `./vix-allocation` and every reader looks it up there.
 */
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart } from "lucide-react"
import { VIX_LEVELS, type VixLevel } from "./vix-allocation"

export function OptionsHedgingSection({ currentLevel }: { currentLevel: VixLevel | null }) {
  return (
    <>
        <Accordion type="single" collapsible defaultValue="options-hedging">
          <AccordionItem value="options-hedging" className="border-0">
            <Card className="shadow-sm border-gray-200">
              <AccordionTrigger className="hover:no-underline [&[data-state=open]>div]:rounded-b-none">
                <CardHeader className="bg-gray-50 border-b border-gray-200 w-full py-4">
                  <CardTitle className="text-lg font-bold text-gray-900">
                    Cash-On Hand Suggestions Based on VIX Levels
                  </CardTitle>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-2">
                    {VIX_LEVELS.map((level, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border transition-colors ${
                          currentLevel === level
                            ? "border-primary bg-green-50 shadow-sm"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <div className="font-mono text-sm font-bold text-gray-900">VIX {level.range}</div>
                            <div className={`font-bold text-sm ${level.color}`}>{level.sentiment}</div>
                            <div className="text-xs text-gray-600 font-medium mt-2">
                              {level.cashMin}-{level.cashMax}% Cash
                            </div>
                            <div className="text-xs text-gray-600 font-medium">
                              {level.investedMin}-{level.investedMax}% Invested
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-purple-900 uppercase">Options Seller</div>
                            <div className="text-sm text-gray-700">{level.optionsAction}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-teal-900 uppercase">Equity Buyer</div>
                            <div className="text-sm text-gray-700">{level.equityAction}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
    </>
  )
}
