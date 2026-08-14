"use client"

/**
 * The allocation band the current score falls in, and every other band beside it.
 *
 * Split out of `components/ccpi-dashboard.tsx` (P6-13) unchanged. What it closed
 * over is now props.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { AllocationBar } from "@/components/allocation-bar"
import { CCPI_ALLOCATION, type AllocationBand } from "@/lib/allocation"

export function AllocationCard({
  currentBand,
}: {
  currentBand: AllocationBand | null | undefined
}) {
  return (
    <>
        <Accordion
          type="multiple"
          defaultValue={["portfolio-allocation"]}
          className="space-y-4 mt-8"
        >
          {/* Portfolio Allocation by CCPI Crash Risk Level */}
          <AccordionItem value="portfolio-allocation" className="border-0">
            <Card className="shadow-sm border-gray-200">
              <AccordionTrigger className="hover:no-underline px-6 py-0">
                <CardHeader className="bg-gray-50 border-b border-gray-200 w-full py-3">
                  <CardTitle className="text-lg font-bold text-gray-900 text-left">
                    Cash vs Stocks by CCPI Crash Risk Level
                  </CardTitle>
                  {/* The "stocks is everything deployed" half of this sentence moved
                      into AllocationBar, which draws the split on all three tabs. Two
                      copies of one definition is the shape this module was built to
                      remove; the bar states it wherever it renders. */}
                  <p className="text-sm text-gray-600 mt-1 text-left">One ratio per regime.</p>
                </CardHeader>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-2">
                    {CCPI_ALLOCATION.bands.map((band) => {
                      const isCurrent = currentBand?.range === band.range

                      return (
                        <div
                          key={band.range}
                          className={`p-4 rounded-lg border transition-colors ${
                            isCurrent
                              ? "border-green-500 bg-green-100 shadow-md ring-2 ring-green-300"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="font-mono text-sm font-bold text-gray-900">CCPI {band.range}</span>
                              <span className="ml-3 font-bold text-sm text-gray-700">{band.level}</span>
                            </div>
                            {isCurrent && (
                              <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">
                                CURRENT
                              </span>
                            )}
                          </div>

                          <AllocationBar band={band} />

                          <p className="text-sm text-gray-600 italic mt-3">{band.stance}</p>
                          {band.cspAction && (
                            <p className="text-sm text-gray-700 mt-2">
                              <span className="font-semibold">For CSP sellers:</span> {band.cspAction}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800 leading-relaxed">
                      <strong>Note:</strong> Stocks and cash are complements — the stocks figure is computed as 100%
                      minus cash, so the two halves cannot disagree. Diversify within the stocks half through sectors
                      and indexes (GDX, XLU, SPY) rather than by adding asset classes. Baseline guidelines only, not
                      personal advice — consult a financial advisor.
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
