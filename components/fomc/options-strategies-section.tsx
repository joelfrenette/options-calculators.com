"use client"

/**
 * The collapsed accordion of option structures for the predicted move.
 *
 * Split out of `components/fomc-predictions.tsx` (P6-13) unchanged. What it
 * closed over is now props.
 */
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertTriangle, Info, Target } from "lucide-react"
import { InfoTooltip } from "./info-tooltip"
import type { NextMeeting, OptionsStrategy } from "./fomc-types"

export function OptionsStrategiesSection({
  optionsStrategies,
  nextMeeting,
  tooltipsEnabled,
}: {
  optionsStrategies: OptionsStrategy[]
  nextMeeting: NextMeeting | null
  tooltipsEnabled: boolean
}) {
  return (
    <>
        {optionsStrategies.length > 0 && (
          <Accordion type="single" collapsible defaultValue="strategies">
            <AccordionItem value="strategies" className="border-none">
              <Card className="shadow-lg border-2 border-primary">
                <AccordionTrigger className="hover:no-underline">
                  <CardHeader className="bg-primary/5 border-b border-primary/20 w-full pb-4">
                    <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Target className="h-6 w-6 text-primary" />
                      Rate-Based Options Strategies
                      <InfoTooltip enabled={tooltipsEnabled} content="These strategies are designed for the current rate environment. Rate cut expectations favor growth stocks, small caps, and rate-sensitive sectors. Rate hike expectations favor banks and value stocks. Uncertainty favors volatility strategies like straddles." />
                    </CardTitle>
                    <CardDescription className="text-base">
                      Actionable trades based on {nextMeeting?.prediction} prediction with{" "}
                      {nextMeeting?.confidence.toFixed(0)}% confidence
                    </CardDescription>
                  </CardHeader>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="pt-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      {optionsStrategies.map((strategy, index) => (
                        <Card
                          key={index}
                          className="border-2 border-gray-200 hover:border-primary/50 transition-colors"
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-base font-bold text-gray-900">{strategy.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                    {strategy.ticker}
                                  </span>
                                  <span className="text-xs text-gray-600">{strategy.type}</span>
                                </div>
                              </div>
                              {tooltipsEnabled && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="h-4 w-4 text-gray-400 cursor-pointer" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs max-w-xs">
                                        Detailed explanation of this strategy, including entry, target, stop-loss, and
                                        risk.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div>
                              <p className="text-sm text-gray-700">{strategy.rationale}</p>
                            </div>

                            <div className="space-y-2 text-xs">
                              <div className="flex items-start gap-2">
                                <span className="font-semibold text-gray-900 min-w-[70px]">Entry:</span>
                                <span className="text-gray-700">{strategy.entry}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="font-semibold text-gray-900 min-w-[70px]">Target:</span>
                                <span className="text-gray-700">{strategy.target}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="font-semibold text-gray-900 min-w-[70px]">Stop Loss:</span>
                                <span className="text-gray-700">{strategy.stopLoss}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="font-semibold text-gray-900 min-w-[70px]">Timeframe:</span>
                                <span className="text-gray-700">{strategy.timeframe}</span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-gray-200">
                              <div className="flex items-start gap-2 text-xs">
                                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-orange-600" />
                                <p className="text-gray-600">
                                  <span className="font-semibold">Risk:</span> {strategy.risk}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <span className="font-semibold">⚠️ Important Disclaimer:</span> These strategies are for
                        educational purposes only and do not constitute financial advice. Options trading involves
                        substantial risk and is not suitable for all investors. Always conduct your own research,
                        understand the risks, and consider consulting with a licensed financial advisor before making
                        any investment decisions. Past performance does not guarantee future results.
                      </p>
                    </div>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        )}
    </>
  )
}
