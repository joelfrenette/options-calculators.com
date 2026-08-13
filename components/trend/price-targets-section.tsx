"use client"

/**
 * Price targets and the action plan.
 *
 * Split out of `components/trend-analysis.tsx` (P6-13) unchanged. What it closed
 * over is now props.
 */
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, AlertTriangle, Info, Shield, Target, TrendingUp } from "lucide-react"
import type { TrendData } from "./trend-types"

export function PriceTargetsSection({
  selectedItem,
}: {
  selectedItem: TrendData
}) {
  return (
    <>
        <Accordion type="single" collapsible defaultValue="price-targets">
          <AccordionItem value="price-targets" className="border rounded-lg shadow-sm">
            <AccordionTrigger className="px-6 py-4 bg-gray-50 hover:bg-gray-100 rounded-t-lg border-b">
              <div className="text-left">
                <h3 className="text-lg font-bold text-gray-900">{selectedItem.name} - Price Targets & Action Plan</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Click to view price targets, support/resistance, and key levels
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-green-900">1-Week Target</h3>
                  </div>
                  {/* `?? 0` here printed a **$0.00 price target** and a percentage
                      measured against it — the loudest possible version of the
                      neutral-default defect, since a price of zero is not a
                      plausible-looking wrong number, it is nonsense presented in
                      the same green as a real target. The weekly target scales by
                      momentum, so it is absent whenever momentum is. */}
                  {selectedItem.priceTarget1Week === null ? (
                    <>
                      <p className="text-2xl font-bold text-gray-400">—</p>
                      <p className="text-sm text-gray-500 mt-1">
                        No momentum reading, so no weekly target. The monthly target and stop below are structural
                        (support, resistance, ATR) and are unaffected.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-green-700">${selectedItem.priceTarget1Week.toFixed(2)}</p>
                      <p className="text-sm text-green-600 mt-1">
                        {selectedItem.priceTarget1Week >= selectedItem.currentPrice ? "+" : ""}
                        {(
                          ((selectedItem.priceTarget1Week - selectedItem.currentPrice) / selectedItem.currentPrice) *
                          100
                        ).toFixed(2)}
                        % from current
                      </p>
                    </>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">1-Month Target</h3>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">
                    ${selectedItem.priceTarget1Month.toFixed(2)}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    {((selectedItem.priceTarget1Month - selectedItem.currentPrice) /
                      (selectedItem.currentPrice ?? 1)) *
                      100 >=
                    0
                      ? "+"
                      : ""}
                    {(
                      ((selectedItem.priceTarget1Month - selectedItem.currentPrice) /
                        (selectedItem.currentPrice ?? 1)) *
                      100
                    ).toFixed(2)}
                    % from current
                  </p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-5 w-5 text-red-600" />
                    <h3 className="font-semibold text-red-900">Stop Loss</h3>
                  </div>
                  <p className="text-2xl font-bold text-red-700">${selectedItem.stopLoss.toFixed(2)}</p>
                  <p className="text-sm text-red-600 mt-1">
                    {(
                      ((selectedItem.stopLoss - selectedItem.currentPrice) /
                        (selectedItem.currentPrice ?? 1)) *
                      100
                    ).toFixed(2)}
                    % from current
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">Support Level</p>
                  <p className="text-xl font-bold text-gray-900">${selectedItem.support.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">Key buying zone</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">Resistance Level</p>
                  <p className="text-xl font-bold text-gray-900">${selectedItem.resistance.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">Key selling zone</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">Volatility (ATR)</p>
                  <p className="text-xl font-bold text-gray-900">${selectedItem.atr.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-1">Daily range</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">RSI</p>
                  <p className="text-xl font-bold text-gray-900">{selectedItem.rsi.toFixed(0)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedItem.rsi > 70
                      ? "Overbought"
                      : selectedItem.rsi < 30
                        ? "Oversold"
                        : "Neutral"}
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

    </>
  )
}
